import type { MigrationDatabase } from './types'
import { sql } from 'kysely'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('entity_versions')
    .addColumn('version_key', 'integer', (column) => column.primaryKey())
    .addColumn('revision', 'text', (column) => column.notNull().unique())
    .addColumn('entity_key', 'integer', (column) => column.notNull().references('source_entities.entity_key'))
    .addColumn('name', 'text')
    .addColumn('person_key', 'integer', (column) => column.references('people.person_key'))
    .addColumn('description', 'text')
    .addColumn('language', 'text')
    .addColumn('stable', 'integer', (column) => column.notNull())
    .addColumn('detail_level', 'text', (column) => column.notNull())
    .addColumn('source_url', 'text')
    .addColumn('source_url_is_key', 'integer', (column) => column.notNull())
    .addColumn('fetched_at', 'integer', (column) => column.notNull())
    .addColumn('created_at', 'integer', (column) => column.notNull())
    .addColumn('subtitle', 'text')
    .addColumn('image', 'text')
    .addColumn('format', 'text')
    .addColumn('publisher', 'text')
    .addColumn('publication_date', 'text')
    .addColumn('publication_precision', 'text')
    .addColumn('duration_seconds', 'real')
    .addColumn('page_count', 'integer')
    .addColumn('abridged', 'integer')
    .addColumn('sort_name', 'text')
    .addColumn('birth_date', 'text')
    .addColumn('birth_precision', 'text')
    .addColumn('death_date', 'text')
    .addColumn('death_precision', 'text')
    .addColumn('total_books', 'integer')
    .addColumn('sequence', 'integer')
    .addColumn('start_seconds', 'real')
    .addColumn('end_seconds', 'real')
    .addColumn('timeline', 'text')
    .addColumn('file_id', 'text')
    .addCheckConstraint(
      'entity_version_name_owner',
      sql`(name IS NOT NULL AND person_key IS NULL) OR (name IS NULL AND person_key IS NOT NULL)`
    )
    .execute()

  await db.schema.createIndex('version_entity').on('entity_versions').column('entity_key').execute()
  await db.schema.createIndex('version_person').on('entity_versions').column('person_key').execute()
}
