import { sql } from 'kysely'
import type { MetadataDatabase } from './tables'

async function createEntityTables(db: MetadataDatabase): Promise<void> {
  await db.schema
    .createTable('state')
    .ifNotExists()
    .addColumn('id', 'integer', (column) => column.primaryKey())
    .addColumn('generation', 'integer', (column) => column.notNull())
    .execute()

  await db
    .insertInto('state')
    .values({ id: 1, generation: 0 })
    .onConflict((conflict) => conflict.doNothing())
    .execute()

  await db.schema
    .createTable('snapshots')
    .ifNotExists()
    .addColumn('revision', 'text', (column) => column.primaryKey())
    .addColumn('entity_id', 'text', (column) => column.notNull())
    .addColumn('payload', 'text', (column) => column.notNull())
    .addColumn('created_at', 'integer', (column) => column.notNull())
    .execute()

  await db.schema
    .createTable('entities')
    .ifNotExists()
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('kind', 'text', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('authors', 'text', (column) => column.notNull())
    .addColumn('scope', 'text', (column) => column.notNull())
    .addColumn('payload', 'text', (column) => column.notNull())
    .addColumn('quality', 'integer', (column) => column.notNull())
    .addColumn('fetched_at', 'integer', (column) => column.notNull())
    .addColumn('stored_at', 'integer', (column) => column.notNull())
    .execute()

  await db.schema
    .createTable('identifiers')
    .ifNotExists()
    .addColumn('entity_id', 'text', (column) => column.notNull().references('entities.id').onDelete('cascade'))
    .addColumn('scheme', 'text', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .addColumn('namespace', 'text', (column) => column.notNull())
    .addColumn('marketplace', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('identifiers_pk', ['entity_id', 'scheme', 'value', 'namespace', 'marketplace'])
    .execute()
}

async function createCacheTables(db: MetadataDatabase): Promise<void> {
  await db.schema
    .createTable('catalog_refreshes')
    .ifNotExists()
    .addColumn('key', 'text', (column) => column.primaryKey())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('next_allowed_at', 'integer', (column) => column.notNull())
    .execute()

  await db.schema
    .createTable('cache_entries')
    .ifNotExists()
    .addColumn('key', 'text', (column) => column.primaryKey())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('matches', 'text', (column) => column.notNull())
    .addColumn('complete', 'integer', (column) => column.notNull())
    .addColumn('started_at', 'integer', (column) => column.notNull())
    .addColumn('fresh_until', 'integer', (column) => column.notNull())
    .addColumn('stale_until', 'integer', (column) => column.notNull())
    .addColumn('error_until', 'integer', (column) => column.notNull())
    .execute()

  await db.schema
    .createTable('cache_references')
    .ifNotExists()
    .addColumn('key', 'text', (column) => column.notNull().references('cache_entries.key').onDelete('cascade'))
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('revision', 'text', (column) => column.notNull().references('snapshots.revision'))
    .addColumn('fetched_at', 'integer')
    .addPrimaryKeyConstraint('cache_references_pk', ['key', 'position'])
    .execute()

  await db.schema
    .createTable('catalog_cache')
    .ifNotExists()
    .addColumn('key', 'text', (column) => column.primaryKey())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('payload', 'text', (column) => column.notNull())
    .addColumn('started_at', 'integer', (column) => column.notNull())
    .addColumn('fresh_until', 'integer', (column) => column.notNull())
    .addColumn('error_until', 'integer', (column) => column.notNull())
    .execute()
}

async function createCatalogMemberships(db: MetadataDatabase): Promise<void> {
  await db.schema
    .createTable('catalog_memberships')
    .ifNotExists()
    .addColumn('key', 'text', (column) => column.notNull().references('catalog_cache.key').onDelete('cascade'))
    .addColumn('entity_id', 'text', (column) => column.notNull().references('entities.id').onDelete('cascade'))
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('match_position', 'integer')
    .addPrimaryKeyConstraint('catalog_memberships_pk', ['key', 'entity_id'])
    .execute()
}

async function createIndexes(db: MetadataDatabase): Promise<void> {
  await db.schema
    .createIndex('catalog_membership_entity')
    .ifNotExists()
    .on('catalog_memberships')
    .column('entity_id')
    .execute()
  await db.schema.createIndex('entities_provider').ifNotExists().on('entities').columns(['provider', 'kind']).execute()
  await db.schema.createIndex('entities_retention').ifNotExists().on('entities').column('stored_at').execute()
  await db.schema
    .createIndex('identifier_lookup')
    .ifNotExists()
    .on('identifiers')
    .columns(['scheme', 'value', 'namespace', 'marketplace'])
    .execute()
  await db.schema.createIndex('cache_expiry').ifNotExists().on('cache_entries').column('error_until').execute()
  await db.schema.createIndex('catalog_expiry').ifNotExists().on('catalog_cache').column('error_until').execute()
}

async function createSearchIndexes(db: MetadataDatabase): Promise<void> {
  // Kysely's schema builder does not expose SQLite virtual tables or triggers.
  await sql`CREATE VIRTUAL TABLE IF NOT EXISTS entity_fts USING fts5(
    name, authors, content='entities', content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2', prefix='2 3 4'
  )`.execute(db)

  await sql`CREATE VIRTUAL TABLE IF NOT EXISTS entity_trigrams USING fts5(
    name, content='entities', content_rowid='rowid', tokenize='trigram'
  )`.execute(db)

  await sql`CREATE TRIGGER IF NOT EXISTS entities_insert AFTER INSERT ON entities BEGIN
    INSERT INTO entity_fts(rowid, name, authors) VALUES (new.rowid, new.name, new.authors);
    INSERT INTO entity_trigrams(rowid, name) VALUES (new.rowid, new.name);
  END`.execute(db)

  await sql`CREATE TRIGGER IF NOT EXISTS entities_delete AFTER DELETE ON entities BEGIN
    INSERT INTO entity_fts(entity_fts, rowid, name, authors) VALUES ('delete', old.rowid, old.name, old.authors);
    INSERT INTO entity_trigrams(entity_trigrams, rowid, name) VALUES ('delete', old.rowid, old.name);
  END`.execute(db)

  await sql`CREATE TRIGGER IF NOT EXISTS entities_update AFTER UPDATE ON entities BEGIN
    INSERT INTO entity_fts(entity_fts, rowid, name, authors) VALUES ('delete', old.rowid, old.name, old.authors);
    INSERT INTO entity_trigrams(entity_trigrams, rowid, name) VALUES ('delete', old.rowid, old.name);
    INSERT INTO entity_fts(rowid, name, authors) VALUES (new.rowid, new.name, new.authors);
    INSERT INTO entity_trigrams(rowid, name) VALUES (new.rowid, new.name);
  END`.execute(db)
}

async function ensureReferenceObservationColumn(db: MetadataDatabase): Promise<void> {
  const tables = await db.introspection.getTables()
  const references = tables.find((table) => table.name === 'cache_references')
  if (references && !references.columns.some((column) => column.name === 'fetched_at')) {
    await db.schema.alterTable('cache_references').addColumn('fetched_at', 'integer').execute()
  }
}

export async function initializeSchema(db: MetadataDatabase): Promise<void> {
  await createEntityTables(db)
  await createCacheTables(db)
  await createCatalogMemberships(db)
  await ensureReferenceObservationColumn(db)
  await createIndexes(db)
  await createSearchIndexes(db)
}
