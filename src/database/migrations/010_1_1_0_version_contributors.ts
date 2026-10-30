import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('version_contributors')
    .addColumn('version_key', 'integer', (column) =>
      column.notNull().references('entity_versions.version_key').onDelete('cascade')
    )
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('person_key', 'integer', (column) => column.notNull().references('people.person_key'))
    .addColumn('linked', 'integer', (column) => column.notNull())
    .addColumn('role', 'text', (column) => column.notNull())
    .addColumn('source_identifier', 'integer', (column) => column.references('identifier_values.identifier_key'))
    .addPrimaryKeyConstraint('version_contributor_pk', ['version_key', 'position'])
    .execute()

  await db.schema.createIndex('version_contributor_author').on('version_contributors').column('person_key').execute()
  await db.schema
    .createIndex('version_credit_identifier')
    .on('version_contributors')
    .column('source_identifier')
    .execute()
}
