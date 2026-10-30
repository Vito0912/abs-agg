import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('version_relations')
    .addColumn('version_key', 'integer', (column) =>
      column.notNull().references('entity_versions.version_key').onDelete('cascade')
    )
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('target_key', 'integer', (column) => column.notNull().references('source_entities.entity_key'))
    .addColumn('type', 'text', (column) => column.notNull())
    .addColumn('sequence', 'text')
    .addColumn('ordering', 'text')
    .addPrimaryKeyConstraint('version_relation_pk', ['version_key', 'position'])
    .execute()

  await db.schema.createIndex('version_relation_target').on('version_relations').column('target_key').execute()
}
