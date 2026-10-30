import type { MigrationDatabase } from './types'
import { sql } from 'kysely'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('catalog_entities')
    .addColumn('entity_key', 'integer', (column) => column.primaryKey().references('source_entities.entity_key'))
    .addColumn('version_key', 'integer', (column) => column.notNull().references('entity_versions.version_key'))
    .addColumn('observed_at', 'integer', (column) => column.notNull())
    .addColumn('fetched_at', 'integer', (column) => column.notNull())
    .addColumn('stored_at', 'integer', (column) => column.notNull())
    .execute()

  await db.schema.createIndex('catalog_version').on('catalog_entities').column('version_key').execute()

  await sql`CREATE TRIGGER catalog_index_delete AFTER DELETE ON catalog_entities BEGIN
      DELETE FROM metadata_fts WHERE rowid = old.entity_key;
      DELETE FROM metadata_trigrams WHERE rowid = old.entity_key;
    END`.execute(db)
}
