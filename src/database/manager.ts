import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { z } from 'zod'
import { cacheSettings } from '../config'
import { cachedBundleSchema, cachedCatalogSchema, databaseStatsSchema, databaseReplySchema } from './protocol'
import { metadataEntitySchema } from '../types/metadata'
import type { DatabaseCommand, SearchCandidatesCommand, StoreCatalogCommand } from './protocol'
import { DatabaseError } from './errors'
import type { Identifier, MetadataBundle } from '../types'

interface PendingCommand {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class DatabaseManager {
  private worker?: Worker
  private failure?: Error
  private closing = false
  private nextId = 0
  private readonly pending = new Map<number, PendingCommand>()

  constructor(private readonly dbPath = cacheSettings.databasePath) {}

  private async execute(command: DatabaseCommand): Promise<unknown> {
    if (this.failure) throw this.failure
    if (this.closing && command.operation !== 'close') throw new Error('Metadata database is closing')

    const worker = this.getWorker()
    const id = ++this.nextId
    worker.ref()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.fail(new Error('Metadata database command timed out'))
        void worker.terminate()
      }, 30000)

      this.pending.set(id, { resolve, reject, timeout })
      worker.postMessage({ id, command })
    })
  }

  async generation(): Promise<number> {
    const value = await this.execute({ operation: 'generation' })
    return z.number().parse(value)
  }

  async deleteEntry(key: string): Promise<void> {
    await this.execute({ operation: 'deleteEntry', key })
  }

  async readCatalog(key: string) {
    const value = await this.execute({ operation: 'readCatalog', key })
    return cachedCatalogSchema.nullable().parse(value)
  }

  async claimCatalogRefresh(key: string, provider: string, intervalMs: number): Promise<boolean> {
    const now = Date.now()
    const value = await this.execute({
      operation: 'claimCatalogRefresh',
      key,
      provider,
      now,
      nextAllowedAt: now + intervalMs
    })

    return z.boolean().parse(value)
  }

  async storeCatalog(command: Omit<StoreCatalogCommand, 'operation'>): Promise<boolean> {
    return z.boolean().parse(await this.execute({ operation: 'storeCatalog', ...command }))
  }

  async searchCandidates(command: Omit<SearchCandidatesCommand, 'operation'>) {
    const value = await this.execute({ operation: 'searchCandidates', ...command })
    return z.array(metadataEntitySchema).parse(value)
  }

  async loadEntities(ids: string[], providers: string[]) {
    const value = await this.execute({ operation: 'loadEntities', ids, providers })
    return z.array(metadataEntitySchema).parse(value)
  }

  async findIdentifier(identifier: Identifier, providers: string[]) {
    const value = await this.execute({ operation: 'findIdentifier', identifier, providers })
    return z.array(metadataEntitySchema).parse(value)
  }

  async catalogProviders(): Promise<string[]> {
    const value = await this.execute({ operation: 'catalogProviders' })

    return z.array(z.string()).parse(value)
  }

  async stats() {
    return databaseStatsSchema.parse(await this.execute({ operation: 'stats' }))
  }

  async readBundle(key: string): Promise<z.infer<typeof cachedBundleSchema> | null> {
    const value = await this.execute({ operation: 'readBundle', key })
    return cachedBundleSchema.nullable().parse(value)
  }

  async storeBundle(command: Omit<Extract<DatabaseCommand, { operation: 'storeBundle' }>, 'operation'>): Promise<void> {
    await this.execute({ operation: 'storeBundle', ...command })
  }

  async ingestMetadata(
    command: Omit<Extract<DatabaseCommand, { operation: 'ingestMetadata' }>, 'operation'>
  ): Promise<boolean> {
    return z.boolean().parse(await this.execute({ operation: 'ingestMetadata', ...command }))
  }

  async clearCache(provider?: string, catalog = false): Promise<void> {
    await this.execute({ operation: 'clear', provider, catalog })
  }

  async prune(): Promise<void> {
    await this.execute({
      operation: 'prune',
      now: Date.now()
    })
  }

  async close(): Promise<void> {
    if (this.closing) return
    this.closing = true
    if (!this.worker) return

    try {
      await this.execute({ operation: 'close' })
    } finally {
      await this.worker.terminate()
      this.worker = undefined
    }
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker

    const compiledPath = path.join(__dirname, 'worker.js')
    const options = { workerData: { dbPath: this.dbPath } }
    if (existsSync(compiledPath)) {
      this.worker = new Worker(compiledPath, options)
    } else {
      const sourcePath = path.join(__dirname, 'worker.ts')
      const script = `require('tsx/cjs'); require(${JSON.stringify(sourcePath)})`
      this.worker = new Worker(script, { ...options, eval: true })
    }

    this.worker.on('message', (input: unknown) => this.receive(input))
    this.worker.on('error', (error) => this.fail(error))
    this.worker.on('exit', (code) => {
      if (!this.closing || this.pending.size > 0) {
        this.fail(new Error(`Metadata database worker exited (${code})`))
      }
    })
    this.worker.unref()
    return this.worker
  }

  private receive(input: unknown): void {
    const result = databaseReplySchema.safeParse(input)
    if (!result.success) {
      this.fail(new Error('Invalid metadata database reply'))
      return
    }

    const reply = result.data
    const pending = this.pending.get(reply.id)
    if (!pending) return
    clearTimeout(pending.timeout)
    this.pending.delete(reply.id)

    if (reply.ok) pending.resolve(reply.value)
    else pending.reject(new DatabaseError(reply.error, reply.code))
    if (this.pending.size === 0) this.worker?.unref()
  }

  private fail(error: Error): void {
    this.failure = error
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    this.pending.clear()
  }
}

export const dbManager = new DatabaseManager()

export function emptyBundle(): MetadataBundle {
  return { schemaVersion: 1, matches: [], entities: [], complete: true }
}
