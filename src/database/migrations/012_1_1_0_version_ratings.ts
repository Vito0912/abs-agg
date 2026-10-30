import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('version_ratings')
    .addColumn('version_key', 'integer', (column) =>
      column.notNull().references('entity_versions.version_key').onDelete('cascade')
    )
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('source', 'text', (column) => column.notNull())
    .addColumn('value', 'real', (column) => column.notNull())
    .addColumn('minimum', 'real', (column) => column.notNull())
    .addColumn('maximum', 'real', (column) => column.notNull())
    .addColumn('rating_count', 'integer')
    .addColumn('review_count', 'integer')
    .addColumn('aspect', 'text', (column) => column.notNull())
    .addPrimaryKeyConstraint('version_rating_pk', ['version_key', 'position'])
    .execute()
}
