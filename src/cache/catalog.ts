import { dbManager } from '../database/manager'
import { recordCacheEvent } from '../telemetry/operations'
import { errorAttributes, logger } from '../telemetry/logger'
import { DatabaseError } from '../database/errors'
import { cacheMode, markPartialResult } from '../utils/requestContext'
import { metadataBundleSchema } from '../types/metadata'
import type { MetadataBundle } from '../types'
import { mergeMetadataBundles } from '../metadata/bundle'
import { permanentExpiry } from './policy'
import { buildCacheKey } from './key'
import type { CacheIdentity } from './types'

interface CatalogRequest {
  key: string
  refreshKey: string
  provider: string
  ttlMs: number
  minimumRefreshIntervalMs?: number
  load: () => Promise<MetadataBundle>
  previous?: MetadataBundle
}

const pending = new Map<string, Promise<MetadataBundle>>()
const failures = new Map<string, { until: number; error: unknown }>()

async function ingestCatalog(request: CatalogRequest): Promise<MetadataBundle> {
  const generation = await dbManager.generation()
  const startedAt = Date.now()
  if (request.minimumRefreshIntervalMs !== undefined) {
    const allowed = await dbManager.claimCatalogRefresh(
      request.refreshKey,
      request.provider,
      request.minimumRefreshIntervalMs
    )
    if (!allowed) throw new Error(`${request.provider} catalog refresh is limited to once per interval`)
  }

  const loaded = metadataBundleSchema.parse(await request.load())
  const bundle = request.previous ? mergeMetadataBundles([request.previous, loaded]) : loaded

  const stored = await dbManager.storeCatalog({
    key: request.key,
    provider: request.provider,
    bundle,
    generation,
    startedAt,
    freshUntil: Date.now() + request.ttlMs,
    errorUntil: permanentExpiry
  })
  if (!stored) throw new Error(`${request.provider} catalog ingestion was invalidated`)

  return bundle
}

function pruneFailures(): void {
  for (const [key, failure] of failures) {
    if (failure.until < Date.now()) failures.delete(key)
  }
}

async function refreshCatalog(request: CatalogRequest): Promise<MetadataBundle> {
  const existing = pending.get(request.key)
  if (existing) {
    recordCacheEvent(request.provider, 'coalesced', 'catalog')
    return structuredClone(await existing)
  }

  pruneFailures()
  const failure = failures.get(request.key)
  if (failure) throw failure.error

  const refresh = ingestCatalog(request)
  pending.set(request.key, refresh)

  try {
    return await refresh
  } catch (error) {
    recordCacheEvent(request.provider, 'refreshError', 'catalog')
    failures.set(request.key, { until: Date.now() + (request.minimumRefreshIntervalMs ?? 10000), error })
    throw error
  } finally {
    pending.delete(request.key)
  }
}

async function readCatalog(key: string, provider: string) {
  try {
    return await dbManager.readCatalog(key)
  } catch (error) {
    if (!(error instanceof DatabaseError) || error.code !== 'invalid-cache') throw error

    recordCacheEvent(provider, 'corrupt', 'catalog')
    logger.warn('Discarding invalid catalog membership', { provider })
    return null
  }
}

export async function storedCatalog(
  identity: CacheIdentity,
  name: string,
  ttlMs: number,
  load: () => Promise<MetadataBundle>,
  options: { minimumRefreshIntervalMs?: number } = {}
): Promise<MetadataBundle> {
  const key = buildCacheKey({ ...identity, type: 'catalog', name })
  const refreshKey = buildCacheKey({ ...identity, version: 0, type: 'catalog', name })
  const provider = identity.provider
  const forceRefresh = options.minimumRefreshIntervalMs === undefined && cacheMode() === 'refresh'
  const cached = await readCatalog(key, provider)
  if (!forceRefresh && cached && Date.now() < cached.fresh_until) {
    recordCacheEvent(provider, 'fresh', 'catalog')
    return cached.bundle
  }

  recordCacheEvent(provider, 'miss', 'catalog')

  try {
    return await refreshCatalog({ key, refreshKey, provider, ttlMs, load, previous: cached?.bundle, ...options })
  } catch (error) {
    if (!cached) throw error

    markPartialResult()
    recordCacheEvent(provider, 'stale', 'catalog')
    logger.warn('Serving stored catalog after refresh failed', { provider, ...errorAttributes(error) })
    return { ...cached.bundle, complete: false }
  }
}

export async function closeCatalogCache(): Promise<void> {
  await Promise.allSettled(pending.values())
}
