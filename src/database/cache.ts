import type { MetadataDatabase } from './tables'
import type { MetadataEntity } from '../types'
import type { StoreBundleCommand, StoreCatalogCommand } from './protocol'
import { metadataBundleSchema, metadataEntitySchema } from '../types/metadata'
import { EntityRepository } from './entities'
import { catalogManifestSchema } from './protocol'
import { CatalogRepository } from './catalog'

export class CacheRepository {
  constructor(private readonly database: MetadataDatabase) {}

  async generation(): Promise<number> {
    const state = await this.database
      .selectFrom('state')
      .select('generation')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow()
    return state.generation
  }

  async readBundle(key: string) {
    const entry = await this.database.selectFrom('cache_entries').selectAll().where('key', '=', key).executeTakeFirst()
    if (!entry) return null

    const snapshots = await this.database
      .selectFrom('cache_references')
      .innerJoin('snapshots', 'snapshots.revision', 'cache_references.revision')
      .select(['snapshots.payload', 'cache_references.fetched_at'])
      .where('cache_references.key', '=', key)
      .orderBy('cache_references.position')
      .execute()

    const entities = snapshots.map((snapshot) => {
      const entity = metadataEntitySchema.parse(JSON.parse(snapshot.payload))
      if (snapshot.fetched_at !== null) entity.source.fetchedAt = snapshot.fetched_at

      return entity
    })
    const bundle = metadataBundleSchema.parse({
      schemaVersion: 1,
      matches: JSON.parse(entry.matches),
      entities,
      complete: Boolean(entry.complete)
    })

    return {
      bundle,
      freshUntil: entry.fresh_until,
      staleUntil: entry.stale_until,
      errorUntil: entry.error_until
    }
  }

  async storeBundle(command: StoreBundleCommand): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const cache = new CacheRepository(transaction)
      if (!(await cache.canStore(command))) return false

      await cache.upsertEntry(command)
      await transaction.deleteFrom('cache_references').where('key', '=', command.key).execute()

      const entities = new EntityRepository(transaction)
      for (const [position, entity] of command.bundle.entities.entries()) {
        const revision = await entities.storeSnapshot(entity)
        await transaction
          .insertInto('cache_references')
          .values({ key: command.key, position, revision, fetched_at: entity.source.fetchedAt })
          .execute()
        await entities.updateCatalog(entity, command.startedAt)
      }

      return true
    })
  }

  async deleteEntry(key: string): Promise<void> {
    await this.database.deleteFrom('cache_entries').where('key', '=', key).execute()
  }

  async readCatalog(key: string) {
    const row = await this.database
      .selectFrom('catalog_cache')
      .select(['provider', 'payload', 'fresh_until', 'error_until'])
      .where('key', '=', key)
      .executeTakeFirst()

    if (!row) return null

    const manifest = catalogManifestSchema.safeParse(JSON.parse(row.payload))
    if (!manifest.success) return null

    const members = await this.database
      .selectFrom('catalog_memberships')
      .innerJoin('entities', 'entities.id', 'catalog_memberships.entity_id')
      .select(['entities.payload', 'catalog_memberships.entity_id', 'catalog_memberships.match_position'])
      .where('catalog_memberships.key', '=', key)
      .orderBy('catalog_memberships.position')
      .execute()
    const matches = members
      .filter((member) => member.match_position !== null)
      .sort((left, right) => (left.match_position ?? 0) - (right.match_position ?? 0))
      .map((member) => member.entity_id)

    if (members.length !== manifest.data.entityCount || matches.length !== manifest.data.matchCount) return null

    const entities = members.map((member) => metadataEntitySchema.parse(JSON.parse(member.payload)))
    const related = await this.loadCatalogRelations(entities, row.provider)
    const bundle = metadataBundleSchema.parse({
      schemaVersion: 1,
      matches,
      entities: [...entities, ...related],
      complete: manifest.data.complete
    })

    return { bundle, fresh_until: row.fresh_until, error_until: row.error_until }
  }

  private async loadCatalogRelations(entities: MetadataEntity[], provider: string) {
    const ids = new Set(entities.map((entity) => entity.id))
    const missing = new Set<string>()

    for (const entity of entities) {
      for (const relation of entity.relations) {
        if (!ids.has(relation.targetId)) missing.add(relation.targetId)
      }
      if ('contributors' in entity) {
        for (const contributor of entity.contributors) {
          if (contributor.authorId && !ids.has(contributor.authorId)) missing.add(contributor.authorId)
        }
      }
    }

    if (missing.size === 0) return []
    const catalog = new CatalogRepository(this.database)
    const related = await catalog.loadEntities([...missing], [provider])

    return related.filter((entity) => !ids.has(entity.id))
  }

  async claimCatalogRefresh(key: string, provider: string, now: number, nextAllowedAt: number): Promise<boolean> {
    const result = await this.database
      .insertInto('catalog_refreshes')
      .values({ key, provider, next_allowed_at: nextAllowedAt })
      .onConflict((conflict) =>
        conflict.column('key').doUpdateSet({ next_allowed_at: nextAllowedAt }).where('next_allowed_at', '<=', now)
      )
      .executeTakeFirst()

    return (result.numInsertedOrUpdatedRows ?? 0n) > 0n
  }

  async storeCatalog(command: StoreCatalogCommand): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const cache = new CacheRepository(transaction)
      if ((await cache.generation()) !== command.generation) return false

      const previous = await transaction
        .selectFrom('catalog_cache')
        .select('started_at')
        .where('key', '=', command.key)
        .executeTakeFirst()
      if (previous && previous.started_at > command.startedAt) return false

      const values = {
        key: command.key,
        provider: command.provider,
        payload: JSON.stringify({
          normalized: true,
          entityCount: command.bundle.entities.length,
          matchCount: command.bundle.matches.length,
          complete: command.bundle.complete
        }),
        started_at: command.startedAt,
        fresh_until: command.freshUntil,
        error_until: command.errorUntil
      }

      await transaction
        .insertInto('catalog_cache')
        .values(values)
        .onConflict((conflict) => conflict.column('key').doUpdateSet(values))
        .execute()

      await transaction.deleteFrom('catalog_memberships').where('key', '=', command.key).execute()
      const entities = new EntityRepository(transaction)
      const matches = new Map(command.bundle.matches.map((id, position) => [id, position]))

      for (const [position, entity] of command.bundle.entities.entries()) {
        await entities.updateCatalog(entity, command.startedAt)
        await transaction
          .insertInto('catalog_memberships')
          .values({
            key: command.key,
            entity_id: entity.id,
            position,
            match_position: matches.get(entity.id) ?? null
          })
          .execute()
      }

      return true
    })
  }

  private async canStore(command: StoreBundleCommand): Promise<boolean> {
    if ((await this.generation()) !== command.generation) return false

    const previous = await this.database
      .selectFrom('cache_entries')
      .select('started_at')
      .where('key', '=', command.key)
      .executeTakeFirst()

    return !previous || previous.started_at <= command.startedAt
  }

  private async upsertEntry(command: StoreBundleCommand): Promise<void> {
    const values = {
      key: command.key,
      provider: command.provider,
      matches: JSON.stringify(command.bundle.matches),
      complete: Number(command.bundle.complete),
      started_at: command.startedAt,
      fresh_until: command.freshUntil,
      stale_until: command.staleUntil,
      error_until: command.errorUntil
    }

    await this.database
      .insertInto('cache_entries')
      .values(values)
      .onConflict((conflict) => conflict.column('key').doUpdateSet(values))
      .execute()
  }
}
