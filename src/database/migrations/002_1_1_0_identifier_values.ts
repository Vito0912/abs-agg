import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('identifier_values')
    .addColumn('identifier_key', 'integer', (column) => column.primaryKey())
    .addColumn('value_type', 'text', (column) => column.notNull())
    .addColumn('scheme', 'text', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .addColumn('namespace', 'text', (column) => column.notNull())
    .addColumn('marketplace', 'text', (column) => column.notNull())
    .addUniqueConstraint('identifier_value_unique', ['scheme', 'value', 'namespace', 'marketplace'])
    .execute()
}
