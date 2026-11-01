import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { MigrationDatabase } from './types'
import type { DatabaseTables, MetadataDatabase, NamedValueCategory } from '../tables'
import type { Version4Tables } from './schema-v4'
import { normalizeSharedName, stableHash } from '../../metadata/identity'
import { MetadataVersionReader } from '../version-reader'

type TransitionalTables = Omit<
  DatabaseTables,
  'people' | 'entity_versions' | 'version_terms' | 'version_contributors'
> & {
  people: Version4Tables['people']
  people_shared: DatabaseTables['people']
  entity_versions: DatabaseTables['entity_versions'] & { publisher: string | null }
  version_terms: DatabaseTables['version_terms'] & { value: string }
  version_contributors: DatabaseTables['version_contributors']
}

export async function up(db: MigrationDatabase): Promise<void> {
  await createSharedTables(db)
  const database = db.withTables<{ [Name in keyof TransitionalTables]: TransitionalTables[Name] }>()
  await addReferences(database)
  await consolidatePeople(database)
  await consolidateNamedValues(database)
  await database.schema.dropTable('people').execute()
  await database.schema.alterTable('people_shared').renameTo('people').execute()

  const current = db.withTables<{ [Name in keyof DatabaseTables]: DatabaseTables[Name] }>()
  await rehashVersions(current)
  await sql`PRAGMA user_version = 5`.execute(db)
}

async function createSharedTables(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('people_shared')
    .addColumn('person_key', 'integer', (column) => column.primaryKey())
    .addColumn('normalized_name', 'text', (column) => column.notNull().unique())
    .addColumn('name', 'text', (column) => column.notNull())
    .execute()
  await db.schema
    .createTable('named_values')
    .addColumn('value_key', 'integer', (column) => column.primaryKey())
    .addColumn('category', 'text', (column) => column.notNull())
    .addColumn('normalized_name', 'text', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .addUniqueConstraint('named_value_unique', ['category', 'normalized_name'])
    .execute()
}

async function addReferences(database: Kysely<TransitionalTables>): Promise<void> {
  await database.schema.alterTable('entity_versions').addColumn('person_name', 'text').execute()
  await database.schema
    .alterTable('entity_versions')
    .addColumn('series_key', 'integer', (column) => column.references('named_values.value_key'))
    .execute()
  await database.schema
    .alterTable('entity_versions')
    .addColumn('publisher_key', 'integer', (column) => column.references('named_values.value_key'))
    .execute()
  await database.schema
    .alterTable('version_terms')
    .addColumn('value_key', 'integer', (column) => column.references('named_values.value_key'))
    .execute()
  await database.schema
    .alterTable('version_contributors')
    .addColumn('author_key', 'integer', (column) => column.references('source_entities.entity_key'))
    .execute()
  await database.schema.alterTable('version_contributors').addColumn('name', 'text').execute()
  await database.schema
    .createIndex('version_credit_source_author')
    .on('version_contributors')
    .column('author_key')
    .execute()
  await database.schema.createIndex('version_series').on('entity_versions').column('series_key').execute()
  await database.schema.createIndex('version_publisher').on('entity_versions').column('publisher_key').execute()
  await database.schema.createIndex('version_term_value').on('version_terms').column('value_key').execute()
}

async function consolidatePeople(database: Kysely<TransitionalTables>): Promise<void> {
  const people = await database.selectFrom('people').selectAll().orderBy('person_key').execute()
  const names = new Map<string, number>()
  const replacements = new Map<number, number>()

  for (const person of people) {
    const normalizedName = normalizeSharedName(person.name)
    let personKey = names.get(normalizedName)
    if (personKey === undefined) {
      personKey = person.person_key
      await database
        .insertInto('people_shared')
        .values({ person_key: personKey, normalized_name: normalizedName, name: person.name })
        .execute()
      names.set(normalizedName, personKey)
    }
    replacements.set(person.person_key, personKey)
    await database
      .updateTable('version_contributors')
      .set({ author_key: person.entity_key, name: person.name })
      .where('person_key', '=', person.person_key)
      .execute()
    await database
      .updateTable('entity_versions')
      .set({ person_name: person.name })
      .where('person_key', '=', person.person_key)
      .execute()
  }

  for (const [previous, personKey] of replacements) {
    if (previous === personKey) continue
    await database
      .updateTable('version_contributors')
      .set({ person_key: personKey })
      .where('person_key', '=', previous)
      .execute()
    await database
      .updateTable('entity_versions')
      .set({ person_key: personKey })
      .where('person_key', '=', previous)
      .execute()
  }
}

async function consolidateNamedValues(database: Kysely<TransitionalTables>): Promise<void> {
  const keys = new Map<string, number>()
  const intern = async (category: NamedValueCategory, value: string): Promise<number> => {
    const normalizedName = normalizeSharedName(value)
    const identity = JSON.stringify([category, normalizedName])
    const previous = keys.get(identity)
    if (previous !== undefined) return previous

    const row = await database
      .insertInto('named_values')
      .values({ category, normalized_name: normalizedName, value })
      .returning('value_key')
      .executeTakeFirstOrThrow()
    keys.set(identity, row.value_key)
    return row.value_key
  }

  const versions = await database
    .selectFrom('entity_versions as version')
    .innerJoin('source_entities as entity', 'entity.entity_key', 'version.entity_key')
    .select(['version.version_key', 'version.name', 'version.publisher', 'entity.kind'])
    .orderBy('version.version_key')
    .execute()
  for (const version of versions) {
    if (version.kind === 'series' && version.name !== null) {
      const seriesKey = await intern('series', version.name)
      await database
        .updateTable('entity_versions')
        .set({ series_key: seriesKey })
        .where('version_key', '=', version.version_key)
        .execute()
    }
    if (version.publisher !== null) {
      const publisherKey = await intern('publisher', version.publisher)
      await database
        .updateTable('entity_versions')
        .set({ publisher_key: publisherKey })
        .where('version_key', '=', version.version_key)
        .execute()
    }
  }

  const terms = await database
    .selectFrom('version_terms')
    .selectAll()
    .orderBy('version_key')
    .orderBy('position')
    .execute()
  for (const term of terms) {
    const valueKey = await intern(term.category, term.value)
    await database
      .updateTable('version_terms')
      .set({ value_key: valueKey })
      .where('version_key', '=', term.version_key)
      .where('category', '=', term.category)
      .where('position', '=', term.position)
      .execute()
  }
}

async function rehashVersions(database: MetadataDatabase): Promise<void> {
  const versions = await database.selectFrom('entity_versions').select('version_key').orderBy('version_key').execute()
  for (const version of versions) {
    await database
      .updateTable('entity_versions')
      .set({ revision: `shared-metadata-migration:${version.version_key}` })
      .where('version_key', '=', version.version_key)
      .execute()
  }

  const reader = new MetadataVersionReader(database)
  const revisions = new Map<string, number>()
  for (let offset = 0; offset < versions.length; offset += 200) {
    const entities = await reader.load(versions.slice(offset, offset + 200).map((version) => version.version_key))
    for (const [key, entity] of entities) {
      const revision = stableHash({ ...entity, source: { ...entity.source, fetchedAt: 0 } })
      const previous = revisions.get(revision)
      if (previous === undefined) {
        await database.updateTable('entity_versions').set({ revision }).where('version_key', '=', key).execute()
        revisions.set(revision, key)
        continue
      }

      await database
        .updateTable('search_cache_members')
        .set({ version_key: previous })
        .where('version_key', '=', key)
        .execute()
      await database
        .updateTable('catalog_entities')
        .set({ version_key: previous })
        .where('version_key', '=', key)
        .execute()
      await deleteVersion(database, key)
    }
  }
}

async function deleteVersion(database: MetadataDatabase, key: number): Promise<void> {
  await database.deleteFrom('version_contributors').where('version_key', '=', key).execute()
  await database.deleteFrom('version_identifiers').where('version_key', '=', key).execute()
  await database.deleteFrom('version_relations').where('version_key', '=', key).execute()
  await database.deleteFrom('version_provenance').where('version_key', '=', key).execute()
  await database.deleteFrom('version_ratings').where('version_key', '=', key).execute()
  await database.deleteFrom('version_terms').where('version_key', '=', key).execute()
  await database.deleteFrom('entity_versions').where('version_key', '=', key).execute()
}
