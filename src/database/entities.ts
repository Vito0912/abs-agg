import type { MetadataBundle, MetadataEntity } from '../types'
import type { MetadataDatabase } from './tables'
import { stableHash } from '../metadata/identity'

export class EntityRepository {
  constructor(private readonly database: MetadataDatabase) {}

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

  async storeSnapshot(entity: MetadataEntity): Promise<string> {
    const payload = JSON.stringify(entity)
    const revision = stableHash({ ...entity, source: { ...entity.source, fetchedAt: 0 } })

    await this.database
      .insertInto('snapshots')
      .values({
        revision,
        entity_id: entity.id,
        payload,
        created_at: Date.now()
      })
      .onConflict((conflict) => conflict.doNothing())
      .execute()

    return revision
  }

  async updateCatalog(entity: MetadataEntity, startedAt: number): Promise<void> {
    const quality = entity.source.quality === 'detail' ? 1 : 0
    const observationStartedAt = Math.min(entity.source.fetchedAt, startedAt)
    const previous = await this.database
      .selectFrom('entities')
      .select(['quality', 'fetched_at'])
      .where('id', '=', entity.id)
      .executeTakeFirst()

    if (previous && (previous.fetched_at > observationStartedAt || previous.quality > quality)) return

    const contributors = 'contributors' in entity ? entity.contributors : []
    const values = {
      id: entity.id,
      provider: entity.source.provider,
      kind: entity.kind,
      name: entity.name,
      authors: contributors.map((person) => person.name).join(' '),
      scope: entity.source.scope,
      payload: JSON.stringify(entity),
      quality,
      fetched_at: observationStartedAt,
      stored_at: Date.now()
    }

    await this.database
      .insertInto('entities')
      .values(values)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(values))
      .execute()
    await this.replaceIdentifiers(entity)
  }

  private async replaceIdentifiers(entity: MetadataEntity): Promise<void> {
    await this.database.deleteFrom('identifiers').where('entity_id', '=', entity.id).execute()
    if (entity.identifiers.length === 0) return

    const identifiers = entity.identifiers.map((identifier) => ({
      entity_id: entity.id,
      scheme: identifier.scheme,
      value: identifier.value,
      namespace: identifier.namespace || '',
      marketplace: identifier.marketplace || ''
    }))

    await this.database
      .insertInto('identifiers')
      .values(identifiers)
      .onConflict((conflict) => conflict.doNothing())
      .execute()
  }
}
