import { metrics, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import type { Attributes } from '@opentelemetry/api'
import { errorAttributes } from './logger'

const meter = metrics.getMeter('abs-agg')
const tracer = trace.getTracer('abs-agg')
const operationNames = ['provider.search', 'upstream.request', 'database.command'] as const
const instruments = new Map(
  operationNames.map((name) => [
    name,
    {
      duration: meter.createHistogram(`abs_agg.${name}.duration`, { unit: 's' }),
      count: meter.createCounter(`abs_agg.${name}.count`)
    }
  ])
)
const cacheEvents = meter.createCounter('abs_agg.cache.events')
const searchResults = meter.createHistogram('abs_agg.provider.search.results', { unit: '{match}' })

export async function observeOperation<T>(
  name: (typeof operationNames)[number],
  attributes: Attributes,
  callback: () => Promise<T>,
  kind = SpanKind.INTERNAL
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes, kind }, async (span) => {
    const startedAt = performance.now()
    let outcome = 'success'

    try {
      return await callback()
    } catch (error) {
      outcome = 'error'
      span.setStatus({ code: SpanStatusCode.ERROR })
      span.setAttributes(errorAttributes(error))
      throw error
    } finally {
      const measurement = { ...attributes, outcome }
      const instrument = instruments.get(name)
      instrument?.duration.record((performance.now() - startedAt) / 1000, measurement)
      instrument?.count.add(1, measurement)
      span.end()
    }
  })
}

export function recordSearchResults(provider: string, count: number, complete: boolean): void {
  searchResults.record(count, { provider, complete })
  trace.getActiveSpan()?.setAttributes({ 'search.results': count, 'search.complete': complete })
}

type CacheOutcome = 'fresh' | 'stale' | 'miss' | 'disabled' | 'coalesced' | 'refreshError' | 'corrupt'

export function recordCacheEvent(
  provider: string,
  outcome: CacheOutcome,
  cache: 'metadata' | 'catalog' = 'metadata'
): void {
  cacheEvents.add(1, { provider, outcome, cache })
}
