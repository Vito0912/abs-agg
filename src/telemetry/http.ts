import {
  context,
  isSpanContextValid,
  metrics,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace
} from '@opentelemetry/api'
import type { RequestHandler } from 'express'
import { randomBytes } from 'node:crypto'
import { logger } from './logger'
import { runWithRequestLogContext } from './context'
import type { RequestLogContext } from './context'

const meter = metrics.getMeter('abs-agg')
const tracer = trace.getTracer('abs-agg')
const duration = meter.createHistogram('http.server.request.duration', { unit: 's' })
const requests = meter.createCounter('abs_agg.http.server.requests')
const activeRequests = meter.createUpDownCounter('http.server.active_requests', { unit: '{request}' })
const standardMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE'])

export const observeHttpRequest: RequestHandler = (req, res, next) => {
  const method = standardMethods.has(req.method) ? req.method : '_OTHER'
  const parentContext = propagation.extract(ROOT_CONTEXT, req.headers)
  const span = tracer.startSpan(
    'HTTP request',
    {
      kind: SpanKind.SERVER,
      attributes: { 'http.request.method': method }
    },
    parentContext
  )
  const spanContext = span.spanContext()
  const logContext: RequestLogContext = {
    traceId: isSpanContextValid(spanContext) ? spanContext.traceId : randomBytes(16).toString('hex'),
    attributes: {}
  }
  const requestContext = trace.setSpan(parentContext, span)
  const startedAt = performance.now()
  let completed = false
  activeRequests.add(1, { 'http.request.method': method })

  const finish = (aborted: boolean): void => {
    if (completed) return
    completed = true

    runWithRequestLogContext(logContext, () =>
      context.with(requestContext, () => {
        const status = res.statusCode
        let route = 'unmatched'
        if (typeof req.route?.path === 'string') route = req.route.path
        else if (status === 401) route = 'unauthorized'

        const provider = req.provider?.getConfig().id || 'none'
        const durationSeconds = (performance.now() - startedAt) / 1000
        const attributes = {
          'http.request.method': method,
          'http.route': route,
          'http.response.status_code': status,
          provider,
          aborted
        }

        span.updateName(`${method} ${route}`)
        span.setAttributes(attributes)
        if (status >= 500 || aborted) span.setStatus({ code: SpanStatusCode.ERROR })
        duration.record(durationSeconds, attributes)
        requests.add(1, attributes)
        activeRequests.add(-1, { 'http.request.method': method })
        if (process.env.LOG_REQUESTS === 'true') {
          const logAttributes = { ...attributes, duration_seconds: durationSeconds }
          if (status >= 500 || aborted) logger.error('HTTP request completed', logAttributes)
          else if (status >= 400) logger.warn('HTTP request completed', logAttributes)
          else logger.info('HTTP request completed', logAttributes)
        }
        span.end()
      })
    )
  }

  res.once('finish', () => finish(false))
  res.once('close', () => finish(!res.writableFinished))
  runWithRequestLogContext(logContext, () => context.with(requestContext, next))
}
