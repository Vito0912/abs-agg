import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('scope_parameters')
    .addColumn('scope_key', 'integer', (column) => column.notNull().references('scopes.scope_key').onDelete('cascade'))
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .addColumn('value_type', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('scope_parameter_pk', ['scope_key', 'position'])
    .execute()
}
