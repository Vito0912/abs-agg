import type { MigrationDatabase } from './types'
import { sql } from 'kysely'

export async function up(db: MigrationDatabase): Promise<void> {
  await sql`PRAGMA user_version = 3`.execute(db)
}
