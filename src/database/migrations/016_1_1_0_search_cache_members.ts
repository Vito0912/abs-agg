import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('search_cache_members')
    .addColumn('cache_key', 'integer', (column) =>
      column.notNull().references('search_cache.cache_key').onDelete('cascade')
    )
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('version_key', 'integer', (column) => column.notNull().references('entity_versions.version_key'))
    .addColumn('match_position', 'integer')
    .addColumn('fetched_at', 'integer')
    .addPrimaryKeyConstraint('search_member_pk', ['cache_key', 'position'])
    .execute()

  await db.schema.createIndex('search_member_version').on('search_cache_members').column('version_key').execute()
}
