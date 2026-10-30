import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('version_provenance')
    .addColumn('version_key', 'integer', (column) =>
      column.notNull().references('entity_versions.version_key').onDelete('cascade')
    )
    .addColumn('field', 'text', (column) => column.notNull())
    .addColumn('provider', 'text', (column) => column.notNull())
    .addColumn('donor_key', 'integer', (column) => column.notNull().references('source_entities.entity_key'))
    .addColumn('fetched_at', 'integer', (column) => column.notNull())
    .addColumn('evidence', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('version_provenance_pk', ['version_key', 'field'])
    .execute()

  await db.schema.createIndex('version_provenance_donor').on('version_provenance').column('donor_key').execute()
}
