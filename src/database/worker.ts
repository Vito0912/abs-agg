import { errorAttributes, logger } from '../telemetry/logger'
import { Kysely, SqliteDialect, sql } from 'kysely'
import { parentPort, workerData } from 'node:worker_threads'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { databaseRequestSchema } from './protocol'
import type { DatabaseCommand } from './protocol'
import type { DatabaseTables, MetadataDatabase } from './tables'
import { migrateDatabase, openSqlite } from './migration-runner'
import { CacheRepository } from './cache'
import { CatalogRepository } from './catalog'
import { DatabaseMaintenance } from './maintenance'
import { EntityRepository } from './entities'

async function openDatabase(dbPath: string): Promise<MetadataDatabase> {
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const sqlite = openSqlite(dbPath)
  try {
    const result = await migrateDatabase(sqlite, dbPath)
    sqlite.pragma('optimize = 0x10002')
    if (result.applied.length > 0) {
      logger.info('Database migrations completed', { count: result.applied.length, rebuilt: result.rebuilt })
    }
    return new Kysely<DatabaseTables>({ dialect: new SqliteDialect({ database: sqlite }) })
  } catch (error) {
    sqlite.close()
    throw error
  }
}

class DatabaseOperations {
  private readonly cache: CacheRepository
  private readonly catalog: CatalogRepository
  private readonly maintenance: DatabaseMaintenance
  private readonly entities: EntityRepository

  constructor(private readonly database: MetadataDatabase) {
    this.cache = new CacheRepository(database)
    this.catalog = new CatalogRepository(database)
    this.maintenance = new DatabaseMaintenance(database)
    this.entities = new EntityRepository(database)
  }

  async execute(command: DatabaseCommand): Promise<unknown> {
    switch (command.operation) {
      case 'generation':
        return this.cache.generation()
      case 'readBundle':
        return this.cache.readBundle(command.key)
      case 'storeBundle':
        return this.cache.storeBundle(command)
      case 'ingestMetadata':
        return this.entities.ingestMetadata(command.bundle, command.generation, command.startedAt)
      case 'deleteEntry':
        return this.cache.deleteEntry(command.key)
      case 'readCatalog':
        return this.cache.readCatalog(command.key)
      case 'claimCatalogRefresh':
        return this.cache.claimCatalogRefresh(command.key, command.provider, command.now, command.nextAllowedAt)
      case 'storeCatalog':
        return this.cache.storeCatalog(command)
      case 'searchCandidates':
        return this.catalog.searchCandidates(command)
      case 'loadEntities':
        return this.catalog.loadEntities(command.ids, command.providers)
      case 'findIdentifier':
        return this.catalog.findIdentifier(command.identifier, command.providers)
      case 'clear':
        return this.maintenance.clear(command)
      case 'prune':
        return this.maintenance.prune(command)
      case 'stats':
        return this.stats()
      case 'catalogProviders':
        return this.catalog.providers()
      case 'catalogEntityCounts':
        return this.catalog.entityCounts()
      case 'close':
        await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(this.database)
        await this.database.destroy()
        return true
    }
  }

  private async stats() {
    const entries = await this.database
      .selectFrom('search_cache')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    const entities = await this.database
      .selectFrom('catalog_entities')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    const snapshots = await this.database
      .selectFrom('entity_versions')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    const catalogs = await this.database
      .selectFrom('collection_cache')
      .select((expression) => expression.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()

    return { entries: entries.count, entities: entities.count, snapshots: snapshots.count, catalogs: catalogs.count }
  }
}

async function startWorker(): Promise<void> {
  const port = parentPort
  if (!port) throw new Error('Database worker requires a parent port')

  const settings = z.object({ dbPath: z.string() }).parse(workerData)
  const database = await openDatabase(settings.dbPath)
  const operations = new DatabaseOperations(database)

  port.postMessage({ type: 'database-ready' })

  port.on('message', (input: unknown) => {
    void handleMessage(input).catch((error: unknown) => {
      logger.error('Database worker transport failed', { ...errorAttributes(error) })
      process.exitCode = 1
      port.close()
    })
  })

  async function handleMessage(input: unknown): Promise<void> {
    const request = databaseRequestSchema.parse(input)

    try {
      const value = await operations.execute(request.command)
      port?.postMessage({ id: request.id, ok: true, value })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof z.ZodError || error instanceof SyntaxError ? 'invalid-cache' : 'database'
      port?.postMessage({ id: request.id, ok: false, error: message, code })
    }

    if (request.command.operation === 'close') port?.close()
  }
}

void startWorker().catch((error: unknown) => {
  logger.error('Database worker startup failed', { ...errorAttributes(error) })
  process.exitCode = 1
  parentPort?.close()
})
