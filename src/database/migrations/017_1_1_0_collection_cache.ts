import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('collection_cache')
    .addColumn('collection_key', 'integer', (column) => column.primaryKey())
    .addColumn('key', 'text', (column) => column.notNull().unique())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('entity_count', 'integer', (column) => column.notNull())
    .addColumn('match_count', 'integer', (column) => column.notNull())
    .addColumn('complete', 'integer', (column) => column.notNull())
    .addColumn('started_at', 'integer', (column) => column.notNull())
    .addColumn('fresh_until', 'integer', (column) => column.notNull())
    .addColumn('error_until', 'integer', (column) => column.notNull())
    .execute()
}
