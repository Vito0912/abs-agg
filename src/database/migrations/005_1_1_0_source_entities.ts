import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('source_entities')
    .addColumn('entity_key', 'integer', (column) => column.primaryKey())
    .addColumn('public_id', 'text', (column) => column.notNull().unique())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('kind', 'text', (column) => column.notNull())
    .addColumn('source_identifier', 'integer', (column) => column.references('identifier_values.identifier_key'))
    .addColumn('scope_key', 'integer', (column) => column.references('scopes.scope_key'))
    .execute()

  await db.schema.createIndex('source_provider_kind').on('source_entities').columns(['provider', 'kind']).execute()
  await db.schema.createIndex('source_identifier_value').on('source_entities').column('source_identifier').execute()
  await db.schema.createIndex('source_scope').on('source_entities').column('scope_key').execute()
}
