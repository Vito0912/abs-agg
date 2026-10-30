import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('people')
    .addColumn('person_key', 'integer', (column) => column.primaryKey())
    .addColumn('entity_key', 'integer', (column) => column.notNull().references('source_entities.entity_key'))
    .addColumn('name', 'text', (column) => column.notNull())
    .addUniqueConstraint('person_name_version', ['entity_key', 'name'])
    .execute()
}
