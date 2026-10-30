import type { MigrationDatabase } from './types'
import { sql } from 'kysely'

export async function up(db: MigrationDatabase): Promise<void> {
  await sql`CREATE VIRTUAL TABLE metadata_trigrams USING fts5(
      name, content='', contentless_delete=1, tokenize='trigram'
    )`.execute(db)
}
