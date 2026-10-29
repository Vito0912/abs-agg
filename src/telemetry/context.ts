import { AsyncLocalStorage } from 'node:async_hooks'
import type { Attributes } from '@opentelemetry/api'

export interface RequestLogContext {
  traceId: string
  attributes: Attributes
}

const storage = new AsyncLocalStorage<RequestLogContext | undefined>()

export function runWithRequestLogContext<T>(context: RequestLogContext | undefined, callback: () => T): T {
  return storage.run(context, callback)
}

export function setRequestLogAttributes(attributes: Attributes): void {
  const context = storage.getStore()
  if (context && process.env.LOG_REQUESTS === 'true') Object.assign(context.attributes, attributes)
}

export function requestLogAttributes(): Attributes {
  const context = storage.getStore()
  if (!context) return {}

  if (process.env.LOG_REQUESTS !== 'true') return {}

  return { ...context.attributes }
}

export function requestTraceId(): string | undefined {
  return storage.getStore()?.traceId
}
