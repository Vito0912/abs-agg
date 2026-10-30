import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('scopes')
    .addColumn('scope_key', 'integer', (column) => column.primaryKey())
    .addColumn('fingerprint', 'text', (column) => column.notNull().unique())
    .execute()
}
