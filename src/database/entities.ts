import type { MetadataBundle, MetadataEntity } from '../types'
import type { MetadataDatabase } from './tables'
import { MetadataVersionWriter } from './version-writer'

export class EntityRepository {
  private readonly versions: MetadataVersionWriter

  constructor(private readonly database: MetadataDatabase) {
    this.versions = new MetadataVersionWriter(database)
  }

  async ingestMetadata(bundle: MetadataBundle, generation: number, startedAt: number): Promise<boolean> {
    return this.database.transaction().execute(async (transaction) => {
      const state = await transaction
        .selectFrom('state')
        .select('generation')
        .where('id', '=', 1)
        .executeTakeFirstOrThrow()
      if (state.generation !== generation) return false

      const entities = new EntityRepository(transaction)
      for (const entity of bundle.entities) await entities.updateCatalog(entity, startedAt)

      return true
    })
  }

  async storeVersion(entity: MetadataEntity): Promise<number> {
    return this.versions.store(entity)
  }

  async updateCatalog(entity: MetadataEntity, startedAt: number, storedAt = Date.now()): Promise<void> {
    const previous = await this.database
      .selectFrom('source_entities as entity')
      .innerJoin('catalog_entities as catalog', 'catalog.entity_key', 'entity.entity_key')
      .innerJoin('entity_versions as version', 'version.version_key', 'catalog.version_key')
      .select(['catalog.observed_at', 'version.detail_level'])
      .where('entity.public_id', '=', entity.id)
      .executeTakeFirst()
    const observedAt = Math.min(entity.source.fetchedAt, startedAt)
    if (
      previous &&
      (previous.observed_at > observedAt || (previous.detail_level === 'detail' && entity.source.quality === 'summary'))
    )
      return

    const versionKey = await this.versions.store(entity)
    const version = await this.database
      .selectFrom('entity_versions')
      .select('entity_key')
      .where('version_key', '=', versionKey)
      .executeTakeFirstOrThrow()
    const values = {
      entity_key: version.entity_key,
      version_key: versionKey,
      observed_at: observedAt,
      fetched_at: entity.source.fetchedAt,
      stored_at: storedAt
    }
    await this.database
      .insertInto('catalog_entities')
      .values(values)
      .onConflict((conflict) => conflict.column('entity_key').doUpdateSet(values))
      .execute()
    await this.updateSearchIndex(version.entity_key, entity)
  }

  private async updateSearchIndex(entityKey: number, entity: MetadataEntity): Promise<void> {
    const contributors = 'contributors' in entity ? entity.contributors : []
    const authors = [...new Set(contributors.map((person) => person.name))].join(' ')
    await this.database.deleteFrom('metadata_fts').where('rowid', '=', entityKey).execute()
    await this.database.deleteFrom('metadata_trigrams').where('rowid', '=', entityKey).execute()
    await this.database.insertInto('metadata_fts').values({ rowid: entityKey, name: entity.name, authors }).execute()
    await this.database.insertInto('metadata_trigrams').values({ rowid: entityKey, name: entity.name }).execute()
  }
}
