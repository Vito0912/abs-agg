import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('collection_members')
    .addColumn('collection_key', 'integer', (column) =>
      column.notNull().references('collection_cache.collection_key').onDelete('cascade')
    )
    .addColumn('entity_key', 'integer', (column) => column.notNull().references('source_entities.entity_key'))
    .addColumn('position', 'integer', (column) => column.notNull())
    .addColumn('match_position', 'integer')
    .addPrimaryKeyConstraint('collection_member_pk', ['collection_key', 'entity_key'])
    .execute()

  await db.schema.createIndex('collection_member_entity').on('collection_members').column('entity_key').execute()
}
