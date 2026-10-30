import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('version_terms')
    .addColumn('version_key', 'integer', (column) =>
      column.notNull().references('entity_versions.version_key').onDelete('cascade')
    )
    .addColumn('category', 'text', (column) => column.notNull())
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('version_term_pk', ['version_key', 'category', 'position'])
    .execute()
}
