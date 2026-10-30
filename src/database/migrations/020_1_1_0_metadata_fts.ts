import type { MigrationDatabase } from './types'
import { sql } from 'kysely'

export async function up(db: MigrationDatabase): Promise<void> {
  await sql`CREATE VIRTUAL TABLE metadata_fts USING fts5(
      name, authors, content='', contentless_delete=1,
      tokenize='unicode61 remove_diacritics 2', prefix='2 3 4'
    )`.execute(db)
}
