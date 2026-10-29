import { dbManager } from '../database/manager'
import { recordCacheEvent } from '../telemetry/operations'
import { errorAttributes, logger } from '../telemetry/logger'
import type { DatabaseManager } from '../database/manager'
import type { CacheMode, MetadataBundle } from '../types'
import { metadataBundleSchema } from '../types/metadata'
import { cacheMode, isPartialResult, markPartialResult, runWithContext } from '../utils/requestContext'
import { DatabaseError } from '../database/errors'
import { bundleExpiry } from './policy'

interface CacheRequest {
  key: string
  provider: string
  ttlMs: number
  mode?: CacheMode
  load: () => Promise<MetadataBundle>
}

export class MetadataCache {
  private readonly pending = new Map<string, Promise<MetadataBundle>>()
  private readonly failures = new Map<string, { error: unknown; until: number }>()
  private closed = false
  private readonly cleanup: NodeJS.Timeout
  readonly metrics = { fresh: 0, stale: 0, miss: 0, coalesced: 0, refreshError: 0, corrupt: 0 }

  constructor(private readonly database: DatabaseManager = dbManager) {
    this.cleanup = setInterval(() => {
      void this.database
        .prune()
        .catch((error: unknown) => logger.error('Cache cleanup failed', { ...errorAttributes(error) }))
    }, 60000)
    this.cleanup.unref()
  }

  async getOrLoad(request: CacheRequest): Promise<MetadataBundle> {
    if (this.closed) throw new Error('Metadata cache is closing')
    const mode = request.mode || cacheMode()
    if (mode === 'disabled') {
      recordCacheEvent(request.provider, 'disabled')
      return this.fetchAndStore(request, false)
    }

    const cached = await this.read(request.key, request.provider)
    const now = Date.now()
    if (mode !== 'refresh' && cached && now < cached.freshUntil) {
      this.metrics.fresh++
      recordCacheEvent(request.provider, 'fresh')
      return cached.bundle
    }

    if (mode !== 'refresh' && cached && cached.bundle.matches.length > 0) {
      this.metrics.stale++
      recordCacheEvent(request.provider, 'stale')
      markPartialResult()
      void this.refresh(request, mode, cached.bundle).catch(() => undefined)
      return cached.bundle
    }

    this.metrics.miss++
    recordCacheEvent(request.provider, 'miss')
    try {
      return await this.refresh(request, mode, cached?.bundle)
    } catch (error) {
      if (cached && cached.bundle.matches.length > 0) {
        this.metrics.stale++
        recordCacheEvent(request.provider, 'stale')
        markPartialResult()
        return cached.bundle
      }
      throw error
    }
  }

  async close(): Promise<void> {
    this.closed = true
    clearInterval(this.cleanup)
    await Promise.allSettled(this.pending.values())
    await this.database.close()
  }

  private async read(key: string, provider: string) {
    try {
      return await this.database.readBundle(key)
    } catch (error) {
      if (!(error instanceof DatabaseError) || error.code !== 'invalid-cache') throw error
      this.metrics.corrupt++
      recordCacheEvent(provider, 'corrupt')
      logger.warn('Discarding invalid cache entry', { provider })
      await this.database.deleteEntry(key)
      return null
    }
  }

  private async loadValidated(request: CacheRequest): Promise<MetadataBundle> {
    const bundle = metadataBundleSchema.parse(await request.load())
    if (isPartialResult()) bundle.complete = false
    return bundle
  }

  private refresh(request: CacheRequest, mode: CacheMode, previous?: MetadataBundle): Promise<MetadataBundle> {
    const pendingKey = `${request.key}:${mode}`
    const pending = this.pending.get(pendingKey)
    if (pending) {
      this.metrics.coalesced++
      recordCacheEvent(request.provider, 'coalesced')
      return pending.then((bundle) => structuredClone(bundle))
    }

    this.pruneFailures()
    const failed = this.failures.get(request.key)
    if (failed && failed.until > Date.now()) return Promise.reject(failed.error)
    const promise = runWithContext(mode, () => this.fetchAndStore(request, true, previous))
    this.pending.set(pendingKey, promise)
    void promise.finally(() => this.pending.delete(pendingKey)).catch(() => undefined)
    return promise.then((bundle) => structuredClone(bundle))
  }

  private async fetchAndStore(
    request: CacheRequest,
    cacheResponse = true,
    previous?: MetadataBundle
  ): Promise<MetadataBundle> {
    const generation = await this.database.generation()
    const startedAt = Date.now()

    try {
      let bundle = await this.loadValidated(request)
      if (bundle.matches.length === 0 && previous && previous.matches.length > 0) {
        markPartialResult()
        bundle = { ...previous, complete: false }
      }

      if (cacheResponse) {
        await this.database.storeBundle({
          key: request.key,
          provider: request.provider,
          bundle,
          generation,
          startedAt,
          ...bundleExpiry(bundle, request.ttlMs)
        })
      } else {
        await this.database.ingestMetadata({ bundle, generation, startedAt })
      }

      return bundle
    } catch (error) {
      if (cacheResponse) {
        this.metrics.refreshError++
        recordCacheEvent(request.provider, 'refreshError')
        this.failures.set(request.key, { error, until: Date.now() + 10000 })
        logger.warn('Metadata refresh failed', { provider: request.provider, ...errorAttributes(error) })
      }
      throw error
    }
  }

  private pruneFailures(): void {
    for (const [key, failure] of this.failures) {
      if (failure.until < Date.now()) this.failures.delete(key)
    }
  }
}

export const metadataCache = new MetadataCache()
