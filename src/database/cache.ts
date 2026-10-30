import type { MetadataDatabase } from './tables'
import type { MetadataEntity } from '../types'
import type { StoreBundleCommand, StoreCatalogCommand } from './protocol'
import { metadataBundleSchema } from '../types/metadata'
import { EntityRepository } from './entities'
import { CatalogRepository } from './catalog'
import { MetadataVersionReader } from './version-reader'

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
    const entry = await this.database.selectFrom('search_cache').selectAll().where('key', '=', key).executeTakeFirst()
    if (!entry) return null

    const members = await this.database
      .selectFrom('search_cache_members')
      .selectAll()
      .where('cache_key', '=', entry.cache_key)
      .orderBy('position')
      .execute()
    const versions = await new MetadataVersionReader(this.database).load(members.map((member) => member.version_key))
    const entities: MetadataEntity[] = []
    for (const member of members) {
      const entity = versions.get(member.version_key)
      if (!entity) throw new SyntaxError('Cached metadata version is missing')
      const observed = structuredClone(entity)
      if (member.fetched_at !== null) observed.source.fetchedAt = member.fetched_at
      entities.push(observed)
    }
    const matches = members
      .filter((member) => member.match_position !== null)
      .sort((left, right) => (left.match_position ?? 0) - (right.match_position ?? 0))
      .map((member) => {
        const entity = versions.get(member.version_key)
        if (!entity) throw new SyntaxError('Cached match version is missing')
        return entity.id
      })
    if (entities.length !== entry.entity_count || matches.length !== entry.match_count) {
      throw new SyntaxError('Cached metadata membership is incomplete')
    }
    const bundle = metadataBundleSchema.parse({
      schemaVersion: 1,
      matches,
      entities,
      complete: Boolean(entry.complete)
    })

    return { bundle, freshUntil: entry.fresh_until, staleUntil: entry.stale_until, errorUntil: entry.error_until }
  }

  async storeBundle(command: StoreBundleCommand): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const cache = new CacheRepository(transaction)
      if (!(await cache.canStore(command))) return false

      const cacheKey = await cache.upsertEntry(command)
      await transaction.deleteFrom('search_cache_members').where('cache_key', '=', cacheKey).execute()
      const entities = new EntityRepository(transaction)
      const matches = new Map(command.bundle.matches.map((id, position) => [id, position]))

      for (const [position, entity] of command.bundle.entities.entries()) {
        const versionKey = await entities.storeVersion(entity)
        await transaction
          .insertInto('search_cache_members')
          .values({
            cache_key: cacheKey,
            position,
            version_key: versionKey,
            match_position: matches.get(entity.id) ?? null,
            fetched_at: entity.source.fetchedAt
          })
          .execute()
        await entities.updateCatalog(entity, command.startedAt)
      }

      return true
    })
  }

  async deleteEntry(key: string): Promise<void> {
    await this.database.deleteFrom('search_cache').where('key', '=', key).execute()
  }

  async readCatalog(key: string) {
    const row = await this.database.selectFrom('collection_cache').selectAll().where('key', '=', key).executeTakeFirst()
    if (!row) return null

    const members = await this.database
      .selectFrom('collection_members as member')
      .innerJoin('catalog_entities as catalog', 'catalog.entity_key', 'member.entity_key')
      .innerJoin('source_entities as entity', 'entity.entity_key', 'member.entity_key')
      .select(['catalog.version_key', 'catalog.fetched_at', 'member.match_position', 'entity.public_id'])
      .where('member.collection_key', '=', row.collection_key)
      .orderBy('member.position')
      .execute()
    const matches = members
      .filter((member) => member.match_position !== null)
      .sort((left, right) => (left.match_position ?? 0) - (right.match_position ?? 0))
      .map((member) => member.public_id)
    if (members.length !== row.entity_count || matches.length !== row.match_count) return null

    const versions = await new MetadataVersionReader(this.database).load(members.map((member) => member.version_key))
    const entities = members.flatMap((member) => {
      const entity = versions.get(member.version_key)
      if (!entity) return []
      const observed = structuredClone(entity)
      observed.source.fetchedAt = member.fetched_at
      return [observed]
    })
    const related = await this.loadCatalogRelations(entities, row.provider)
    const bundle = metadataBundleSchema.parse({
      schemaVersion: 1,
      matches,
      entities: [...entities, ...related],
      complete: Boolean(row.complete)
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

    const related = await new CatalogRepository(this.database).loadEntities([...missing], [provider])
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
        .selectFrom('collection_cache')
        .select('started_at')
        .where('key', '=', command.key)
        .executeTakeFirst()
      if (previous && previous.started_at > command.startedAt) return false

      const values = {
        key: command.key,
        provider: command.provider,
        entity_count: command.bundle.entities.length,
        match_count: command.bundle.matches.length,
        complete: Number(command.bundle.complete),
        started_at: command.startedAt,
        fresh_until: command.freshUntil,
        error_until: command.errorUntil
      }
      const collection = await transaction
        .insertInto('collection_cache')
        .values(values)
        .onConflict((conflict) => conflict.column('key').doUpdateSet(values))
        .returning('collection_key')
        .executeTakeFirstOrThrow()
      await transaction
        .deleteFrom('collection_members')
        .where('collection_key', '=', collection.collection_key)
        .execute()
      const entities = new EntityRepository(transaction)
      const matches = new Map(command.bundle.matches.map((id, position) => [id, position]))

      for (const [position, entity] of command.bundle.entities.entries()) {
        await entities.updateCatalog(entity, command.startedAt)
        const identity = await transaction
          .selectFrom('source_entities')
          .select('entity_key')
          .where('public_id', '=', entity.id)
          .executeTakeFirstOrThrow()
        await transaction
          .insertInto('collection_members')
          .values({
            collection_key: collection.collection_key,
            entity_key: identity.entity_key,
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
      .selectFrom('search_cache')
      .select('started_at')
      .where('key', '=', command.key)
      .executeTakeFirst()
    return !previous || previous.started_at <= command.startedAt
  }

  private async upsertEntry(command: StoreBundleCommand): Promise<number> {
    const values = {
      key: command.key,
      provider: command.provider,
      complete: Number(command.bundle.complete),
      entity_count: command.bundle.entities.length,
      match_count: command.bundle.matches.length,
      started_at: command.startedAt,
      fresh_until: command.freshUntil,
      stale_until: command.staleUntil,
      error_until: command.errorUntil
    }
    const row = await this.database
      .insertInto('search_cache')
      .values(values)
      .onConflict((conflict) => conflict.column('key').doUpdateSet(values))
      .returning('cache_key')
      .executeTakeFirstOrThrow()
    return row.cache_key
  }
}
