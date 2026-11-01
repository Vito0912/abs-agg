import { sql } from 'kysely'
import type { MigrationDatabase } from './types'
import type { Version4Tables as DatabaseTables, Version4Database as MetadataDatabase } from './schema-v4'

import { Version4Maintenance as DatabaseMaintenance } from './maintenance-v4'

import { entityId, stableHash } from '../../metadata/identity'

async function inferredAuthors(database: MetadataDatabase) {
  return database
    .selectFrom('source_entities as entity')
    .innerJoin('identifier_values as identifier', 'identifier.identifier_key', 'entity.source_identifier')
    .innerJoin('people as person', 'person.entity_key', 'entity.entity_key')
    .select(['entity.entity_key', 'entity.provider', 'entity.scope_key', 'entity.public_id', 'person.name'])
    .where('entity.kind', '=', 'author')
    .where('identifier.value', 'like', 'name:%')
    .where((expression) =>
      expression.not(
        expression.exists(
          expression
            .selectFrom('entity_versions')
            .select('version_key')
            .whereRef('entity_versions.entity_key', '=', 'entity.entity_key')
            .where('stable', '=', 1)
        )
      )
    )
    .orderBy('entity.entity_key')
    .execute()
}

type InferredAuthor = Awaited<ReturnType<typeof inferredAuthors>>[number]

export async function up(db: MigrationDatabase): Promise<void> {
  const database = db.withTables<{ [Name in keyof DatabaseTables]: DatabaseTables[Name] }>()
  await invalidateAffectedCaches(database)
  await new DatabaseMaintenance(database).deleteUnusedVersions()

  const authors = await inferredAuthors(database)
  const scopes = await loadScopes(database)
  const groups = groupAuthors(authors)
  for (const group of groups.values()) await mergeAuthors(database, group, scopes)

  await new DatabaseMaintenance(database).deleteUnusedVersions()
  await sql`PRAGMA user_version = 4`.execute(database)
}

async function invalidateAffectedCaches(database: MetadataDatabase): Promise<void> {
  const inferredVersions = database
    .selectFrom('entity_versions as version')
    .innerJoin('source_entities as entity', 'entity.entity_key', 'version.entity_key')
    .innerJoin('identifier_values as identifier', 'identifier.identifier_key', 'entity.source_identifier')
    .select('version.version_key')
    .where('entity.kind', '=', 'author')
    .where('identifier.value', 'like', 'name:%')
  const affectedSearches = database
    .selectFrom('search_cache_members')
    .select('cache_key')
    .where('version_key', 'in', inferredVersions)

  await database
    .deleteFrom('search_cache')
    .where((expression) =>
      expression.or([expression('provider', '=', 'goodreads'), expression('cache_key', 'in', affectedSearches)])
    )
    .execute()

  const inferredEntities = database
    .selectFrom('source_entities as entity')
    .innerJoin('identifier_values as identifier', 'identifier.identifier_key', 'entity.source_identifier')
    .select('entity.entity_key')
    .where('entity.kind', '=', 'author')
    .where('identifier.value', 'like', 'name:%')
  const affectedCollections = database
    .selectFrom('collection_members')
    .select('collection_key')
    .where('entity_key', 'in', inferredEntities)

  await database
    .deleteFrom('collection_cache')
    .where((expression) =>
      expression.or([expression('provider', '=', 'goodreads'), expression('collection_key', 'in', affectedCollections)])
    )
    .execute()

  await database
    .deleteFrom('catalog_entities')
    .where(
      'entity_key',
      'in',
      database.selectFrom('source_entities').select('entity_key').where('provider', '=', 'goodreads')
    )
    .execute()
}

async function loadScopes(database: MetadataDatabase): Promise<Map<number, string>> {
  const rows = await database.selectFrom('scope_parameters').selectAll().orderBy('position').execute()
  const parameters = new Map<number, [string, string | number | boolean][]>()
  for (const row of rows) {
    let value: string | number | boolean = row.value
    if (row.value_type === 'number') value = Number(row.value)
    if (row.value_type === 'boolean') value = row.value === 'true'

    const entries = parameters.get(row.scope_key) || []
    entries.push([row.name, value])
    parameters.set(row.scope_key, entries)
  }

  return new Map([...parameters].map(([key, entries]) => [key, JSON.stringify(entries)]))
}

function groupAuthors(authors: InferredAuthor[]): Map<string, InferredAuthor[]> {
  const identities = new Map<number, Set<string>>()
  for (const author of authors) {
    const names = identities.get(author.entity_key) || new Set<string>()
    names.add(legacyAuthorSourceId(author.name))
    identities.set(author.entity_key, names)
  }

  const groups = new Map<string, InferredAuthor[]>()
  for (const author of authors) {
    if (author.scope_key === null || identities.get(author.entity_key)?.size !== 1) continue

    const key = JSON.stringify([author.provider, author.scope_key, legacyAuthorSourceId(author.name)])
    const group = groups.get(key) || []
    if (!group.some((existing) => existing.entity_key === author.entity_key)) group.push(author)
    groups.set(key, group)
  }

  return groups
}

async function mergeAuthors(
  database: MetadataDatabase,
  authors: InferredAuthor[],
  scopes: Map<number, string>
): Promise<void> {
  const first = authors[0]
  if (!first || first.scope_key === null) return

  const sourceId = legacyAuthorSourceId(first.name)
  const scope = scopes.get(first.scope_key) || '[]'
  const publicId = entityId(first.provider, 'author', sourceId, scope)
  const existing = await database
    .selectFrom('source_entities')
    .select('entity_key')
    .where('public_id', '=', publicId)
    .executeTakeFirst()
  const targetKey = existing?.entity_key ?? first.entity_key
  const keys = [...new Set([targetKey, ...authors.map((author) => author.entity_key)])]
  const catalog = await database
    .selectFrom('catalog_entities as catalog')
    .innerJoin('entity_versions as version', 'version.version_key', 'catalog.version_key')
    .selectAll('catalog')
    .where('catalog.entity_key', 'in', keys)
    .orderBy('version.detail_level', 'asc')
    .orderBy('catalog.observed_at', 'desc')
    .orderBy('catalog.entity_key')
    .executeTakeFirst()

  const identities = legacyIdentities(database)
  const sourceIdentifier = await identities.identifier({
    scheme: 'provider',
    namespace: first.provider,
    value: sourceId
  })
  await database
    .updateTable('source_entities')
    .set({ public_id: publicId, source_identifier: sourceIdentifier, scope_key: first.scope_key })
    .where('entity_key', '=', targetKey)
    .execute()

  for (const author of authors) {
    if (author.entity_key === targetKey) continue
    await mergeAuthorReferences(database, author.entity_key, targetKey)
  }

  await database.deleteFrom('catalog_entities').where('entity_key', 'in', keys).execute()
  if (catalog) {
    await database
      .insertInto('catalog_entities')
      .values({ ...catalog, entity_key: targetKey })
      .execute()
    const person = await database
      .selectFrom('entity_versions as version')
      .innerJoin('people as person', 'person.person_key', 'version.person_key')
      .select('person.name')
      .where('version.version_key', '=', catalog.version_key)
      .executeTakeFirstOrThrow()
    await database.insertInto('metadata_fts').values({ rowid: targetKey, name: person.name, authors: '' }).execute()
    await database.insertInto('metadata_trigrams').values({ rowid: targetKey, name: person.name }).execute()
  }

  for (const key of keys) {
    if (key !== targetKey) await database.deleteFrom('source_entities').where('entity_key', '=', key).execute()
  }
}

async function mergeAuthorReferences(database: MetadataDatabase, sourceKey: number, targetKey: number): Promise<void> {
  const people = await database.selectFrom('people').selectAll().where('entity_key', '=', sourceKey).execute()
  const identities = legacyIdentities(database)
  for (const person of people) {
    const personKey = await identities.person(targetKey, person.name)
    await database
      .updateTable('version_contributors')
      .set({ person_key: personKey })
      .where('person_key', '=', person.person_key)
      .execute()
    await database
      .updateTable('entity_versions')
      .set({ person_key: personKey })
      .where('person_key', '=', person.person_key)
      .execute()
    await database.deleteFrom('people').where('person_key', '=', person.person_key).execute()
  }

  await database
    .updateTable('entity_versions')
    .set({ entity_key: targetKey })
    .where('entity_key', '=', sourceKey)
    .execute()
  await database
    .updateTable('version_relations')
    .set({ target_key: targetKey })
    .where('target_key', '=', sourceKey)
    .execute()
  await database
    .updateTable('version_provenance')
    .set({ donor_key: targetKey })
    .where('donor_key', '=', sourceKey)
    .execute()
}

function legacyIdentities(database: MetadataDatabase) {
  return {
    async person(entityKey: number, name: string): Promise<number> {
      const row = await database
        .insertInto('people')
        .values({ entity_key: entityKey, name })
        .onConflict((conflict) => conflict.columns(['entity_key', 'name']).doUpdateSet({ name }))
        .returning('person_key')
        .executeTakeFirstOrThrow()
      return row.person_key
    },
    async identifier(identifier: { scheme: 'provider'; namespace: string; value: string }): Promise<number> {
      const values = { ...identifier, value_type: 'inferred' as const, marketplace: '' }
      const row = await database
        .insertInto('identifier_values')
        .values(values)
        .onConflict((conflict) => conflict.columns(['scheme', 'value', 'namespace', 'marketplace']).doUpdateSet(values))
        .returning('identifier_key')
        .executeTakeFirstOrThrow()
      return row.identifier_key
    }
  }
}

function legacyAuthorSourceId(name: string): string {
  const normalizedName = name.normalize('NFC').trim().replace(/\s+/g, ' ')
  return `name:${stableHash(normalizedName)}`
}
