import type { MigrationDatabase } from './types'

export async function up(db: MigrationDatabase): Promise<void> {
  await db.schema
    .createTable('state')
    .addColumn('id', 'integer', (column) => column.primaryKey())
    .addColumn('generation', 'integer', (column) => column.notNull())
    .execute()

  await db.insertInto('state').values({ id: 1, generation: 0 }).execute()
}
