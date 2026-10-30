import { z } from 'zod'
import type { EntityKind, Identifier, MetadataEntity } from '../types'
import { entityKindSchema } from '../types/metadata'
import { stableHash } from '../metadata/identity'
import type { MetadataDatabase } from './tables'

const parametersSchema = z.array(z.tuple([z.string(), z.union([z.string(), z.number(), z.boolean()])]))

export class IdentityRepository {
  constructor(private readonly database: MetadataDatabase) {}

  async person(entityKey: number, name: string): Promise<number> {
    const row = await this.database
      .insertInto('people')
      .values({ entity_key: entityKey, name })
      .onConflict((conflict) => conflict.columns(['entity_key', 'name']).doUpdateSet({ name }))
      .returning('person_key')
      .executeTakeFirstOrThrow()

    return row.person_key
  }

  async identifier(identifier: Identifier): Promise<number> {
    const values = {
      value_type: identifierType(identifier),
      scheme: identifier.scheme,
      value: identifier.value,
      namespace: identifier.namespace ?? '',
      marketplace: identifier.marketplace ?? ''
    }
    const row = await this.database
      .insertInto('identifier_values')
      .values(values)
      .onConflict((conflict) => conflict.columns(['scheme', 'value', 'namespace', 'marketplace']).doUpdateSet(values))
      .returning('identifier_key')
      .executeTakeFirstOrThrow()

    return row.identifier_key
  }

  async reference(id: string, provider: string, kind: EntityKind): Promise<number> {
    const existing = await this.database
      .selectFrom('source_entities')
      .select('entity_key')
      .where('public_id', '=', id)
      .executeTakeFirst()
    if (existing) return existing.entity_key

    const parts = id.split(':')
    const parsedKind = entityKindSchema.safeParse(parts[1])
    const row = await this.database
      .insertInto('source_entities')
      .values({
        public_id: id,
        provider: parsedKind.success ? parts[0] : provider,
        kind: parsedKind.success ? parsedKind.data : kind,
        source_identifier: null,
        scope_key: null
      })
      .returning('entity_key')
      .executeTakeFirstOrThrow()

    return row.entity_key
  }

  async register(entity: MetadataEntity): Promise<number> {
    const sourceIdentifier = await this.identifier({
      scheme: 'provider',
      namespace: entity.source.provider,
      value: entity.source.sourceId
    })
    const scopeKey = await this.scope(entity.source.scope)
    const sourceRows = await this.database
      .selectFrom('source_entities')
      .select(['entity_key', 'public_id', 'scope_key'])
      .where('provider', '=', entity.source.provider)
      .where('kind', '=', entity.kind)
      .where('source_identifier', '=', sourceIdentifier)
      .execute()
    const exactMatches = sourceRows.filter((row) => row.scope_key === scopeKey)

    if (exactMatches.length > 1) {
      throw new Error(
        `Multiple catalog identities already exist for ${entity.source.provider} ${entity.kind} ${entity.source.sourceId}`
      )
    }

    const existingById = await this.database
      .selectFrom('source_entities')
      .select(['entity_key', 'source_identifier', 'scope_key'])
      .where('public_id', '=', entity.id)
      .executeTakeFirst()

    let entityKey: number
    if (exactMatches.length === 1) {
      entityKey = exactMatches[0].entity_key
      if (existingById && existingById.entity_key !== entityKey) {
        throw new Error(`Catalog identity ${entity.id} conflicts with an existing entity`)
      }
    } else {
      const scopeParameters = parametersSchema.parse(JSON.parse(entity.source.scope))
      const legacyMatches = scopeParameters.length === 0 ? sourceRows : []

      if (legacyMatches.length > 1) {
        throw new Error(
          `Cannot reconcile ambiguous scoped identities for ${entity.source.provider} ${entity.kind} ${entity.source.sourceId}`
        )
      }

      if (legacyMatches.length === 1) {
        entityKey = legacyMatches[0].entity_key
        if (existingById && existingById.entity_key !== entityKey) {
          throw new Error(`Catalog identity ${entity.id} conflicts with an existing entity`)
        }
      } else if (existingById) {
        if (existingById.source_identifier !== null || existingById.scope_key !== null) {
          throw new Error(`Catalog identity ${entity.id} is already assigned to a different source record`)
        }
        entityKey = existingById.entity_key
      } else {
        entityKey = await this.reference(entity.id, entity.source.provider, entity.kind)
      }
    }

    await this.database
      .updateTable('source_entities')
      .set({
        provider: entity.source.provider,
        kind: entity.kind,
        source_identifier: sourceIdentifier,
        scope_key: scopeKey
      })
      .where('entity_key', '=', entityKey)
      .execute()

    return entityKey
  }

  private async scope(scope: string): Promise<number> {
    const parameters = parametersSchema.parse(JSON.parse(scope))
    const fingerprint = stableHash(parameters)
    const existing = await this.database
      .selectFrom('scopes')
      .select('scope_key')
      .where('fingerprint', '=', fingerprint)
      .executeTakeFirst()
    if (existing) return existing.scope_key

    const row = await this.database
      .insertInto('scopes')
      .values({ fingerprint })
      .returning('scope_key')
      .executeTakeFirstOrThrow()
    for (const [position, [name, value]] of parameters.entries()) {
      const valueType = parameterType(value)
      await this.database
        .insertInto('scope_parameters')
        .values({
          scope_key: row.scope_key,
          position,
          name,
          value: String(value),
          value_type: valueType
        })
        .execute()
    }

    return row.scope_key
  }
}

function parameterType(value: string | number | boolean): 'string' | 'number' | 'boolean' {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

function identifierType(identifier: Identifier): 'identifier' | 'url' | 'inferred' {
  if (identifier.scheme !== 'provider') return 'identifier'
  if (/^https?:\/\//.test(identifier.value)) return 'url'
  if (identifier.value.startsWith('name:') || identifier.value.startsWith('unresolved:')) return 'inferred'
  return 'identifier'
}
