import 'dotenv/config'
import { context, logs, metrics, propagation, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { z } from 'zod'

const endpointSchema = z.url({ protocol: /^https?$/ }).refine((value) => {
  const url = new URL(value)
  return !url.username && !url.password && !url.search && !url.hash
}, 'Collector URL must not contain credentials, a query, or a fragment')

interface TelemetryProviders {
  tracer?: TracerProvider
  meter?: MeterProvider
  logger?: LoggerProvider
  contextManager: AsyncLocalStorageContextManager
}

function startTelemetry(): TelemetryProviders | undefined {
  if (process.env.OTEL_ENABLED !== 'true') return undefined

  const signals = z
    .object({
      OTEL_TRACES_ENABLED: z.enum(['true', 'false']).default('false'),
      OTEL_METRICS_ENABLED: z.enum(['true', 'false']).default('true'),
      OTEL_LOGS_ENABLED: z.enum(['true', 'false']).default('true')
    })
    .parse(process.env)
  const tracesEnabled = signals.OTEL_TRACES_ENABLED === 'true'
  const metricsEnabled = signals.OTEL_METRICS_ENABLED === 'true'
  const logsEnabled = signals.OTEL_LOGS_ENABLED === 'true'

  if (!tracesEnabled && !metricsEnabled && !logsEnabled) return undefined

  const config = z
    .object({
      OTEL_EXPORTER_OTLP_ENDPOINT: endpointSchema,
      OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().int().positive().default(60000)
    })
    .parse(process.env)
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, '')
  const resource = defaultResource().merge(
    resourceFromAttributes({ 'service.name': process.env.OTEL_SERVICE_NAME || 'abs-agg' })
  )

  const tracer = tracesEnabled ? createTracerProvider() : undefined
  const meter = metricsEnabled ? createMeterProvider() : undefined
  const logger = logsEnabled ? createLoggerProvider() : undefined
  const contextManager = new AsyncLocalStorageContextManager().enable()

  context.setGlobalContextManager(contextManager)
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  if (tracer) trace.setGlobalTracerProvider(tracer)
  if (meter) metrics.setGlobalMeterProvider(meter)
  if (logger) logs.setGlobalLoggerProvider(logger)

  return { tracer, meter, logger, contextManager }

  function createTracerProvider(): TracerProvider {
    return new TracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor({ exporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }) })]
    })
  }

  function createMeterProvider(): MeterProvider {
    return new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis: config.OTEL_METRIC_EXPORT_INTERVAL,
          exportTimeoutMillis: Math.min(config.OTEL_METRIC_EXPORT_INTERVAL, 30000)
        })
      ]
    })
  }

  function createLoggerProvider(): LoggerProvider {
    return new LoggerProvider({
      resource,
      processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }) })]
    })
  }
}

const providers = startTelemetry()

export async function shutdownTelemetry(): Promise<void> {
  if (!providers) return

  try {
    await Promise.all([providers.tracer?.shutdown(), providers.meter?.shutdown(), providers.logger?.shutdown()])
  } finally {
    providers.contextManager.disable()
  }
}
