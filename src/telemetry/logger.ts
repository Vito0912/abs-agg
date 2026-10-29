import { context, isSpanContextValid, logs, ROOT_CONTEXT, SeverityNumber, trace } from '@opentelemetry/api'
import type { Attributes } from '@opentelemetry/api'
import { isMainThread, parentPort } from 'node:worker_threads'
import { z } from 'zod'
import { requestLogAttributes, requestTraceId, runWithRequestLogContext } from './context'

const severity = { info: SeverityNumber.INFO, warn: SeverityNumber.WARN, error: SeverityNumber.ERROR }
const otelLogger = logs.getLogger('abs-agg')
const logAttributeSchema = z.union([z.string(), z.number(), z.boolean()])
const workerLogSchema = z.object({
  type: z.literal('abs-agg.log'),
  level: z.enum(['info', 'warn', 'error']),
  message: z.string(),
  attributes: z.record(z.string(), z.union([logAttributeSchema, z.array(logAttributeSchema.nullable())]).optional())
})

function write(level: keyof typeof severity, message: string, attributes: Attributes = {}): void {
  if (!isMainThread && parentPort) {
    parentPort.postMessage({ type: 'abs-agg.log', level, message, attributes })
    return
  }

  const activeContext = context.active()
  const spanContext = trace.getSpanContext(activeContext)
  const hasSpanContext = spanContext !== undefined && isSpanContextValid(spanContext)
  const traceId = hasSpanContext ? spanContext.traceId : requestTraceId()
  const correlation = traceId ? { trace_id: traceId } : {}
  const logAttributes = { ...requestLogAttributes(), ...attributes }

  console[level](
    JSON.stringify({
      ...logAttributes,
      ...correlation,
      timestamp: new Date().toISOString(),
      level,
      message
    })
  )
  otelLogger.emit({
    context: activeContext,
    severityNumber: severity[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes: hasSpanContext ? logAttributes : { ...logAttributes, ...correlation }
  })
}

export function handleWorkerLog(input: unknown): boolean {
  const result = workerLogSchema.safeParse(input)
  if (!result.success) return false

  const { level, message, attributes } = result.data
  runWithRequestLogContext(undefined, () => context.with(ROOT_CONTEXT, () => write(level, message, attributes)))
  return true
}

export const logger = {
  info: (message: string, attributes?: Attributes): void => write('info', message, attributes),
  warn: (message: string, attributes?: Attributes): void => write('warn', message, attributes),
  error: (message: string, attributes?: Attributes): void => write('error', message, attributes)
}

export function errorType(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError'
}

export function errorAttributes(error: unknown): Attributes {
  const attributes: Attributes = { 'error.type': errorType(error) }
  if (typeof error !== 'object' || error === null) return attributes

  if ('status' in error && typeof error.status === 'number' && Number.isInteger(error.status)) {
    if (error.status >= 100 && error.status <= 599) attributes['http.response.status_code'] = error.status
  }

  if ('code' in error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)) {
    attributes['error.code'] = error.code
  }

  if (error instanceof z.ZodError) {
    attributes['validation.issue_count'] = error.issues.length
    attributes['validation.codes'] = [...new Set(error.issues.map((issue) => issue.code))]
  }

  return attributes
}
