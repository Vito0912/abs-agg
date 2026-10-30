import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('catalog_refreshes')
    .addColumn('key', 'text', (column) => column.primaryKey())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('next_allowed_at', 'integer', (column) => column.notNull())
    .execute()
}
