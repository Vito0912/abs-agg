import type { MigrationDatabase } from './types'
import { sql } from 'kysely'
import { z } from 'zod'

export async function up(db: MigrationDatabase): Promise<void> {
  const version = await sql`PRAGMA user_version`.execute(db)
  const parsed = z.array(z.object({ user_version: z.number().int() })).parse(version.rows)
  const sourceVersion = parsed[0]?.user_version
  if (sourceVersion === 1 || sourceVersion === 2) await rebuildPreReleaseSchema(db, sourceVersion)
  else if (sourceVersion !== 0 && sourceVersion !== 3) throw new Error('Unsupported metadata schema version')
}

async function rebuildPreReleaseSchema(db: MigrationDatabase, sourceVersion: number): Promise<void> {
  const tables = await db.introspection.getTables()
  const names = new Set(tables.map((table) => table.name))
  const required =
    sourceVersion === 1
      ? ['entities', 'snapshots', 'cache_entries']
      : ['source_entities', 'entity_snapshots', 'catalog_entities']
  if (!required.every((table) => names.has(table))) {
    throw new Error('Refusing to rebuild an unrecognized database')
  }
  for (const table of [
    'cache_references',
    'cache_entries',
    'catalog_memberships',
    'catalog_cache',
    'identifiers',
    'search_cache_members',
    'collection_members',
    'catalog_entities',
    'search_cache',
    'collection_cache',
    'snapshot_identifiers',
    'snapshot_contributors',
    'snapshot_relations',
    'snapshot_ratings',
    'snapshot_terms',
    'snapshot_provenance',
    'creative_details',
    'book_details',
    'work_details',
    'author_details',
    'series_details',
    'chapter_details',
    'entity_snapshots',
    'snapshots',
    'entities',
    'source_entities',
    'names',
    'identifier_values',
    'scope_parameters',
    'scopes',
    'state',
    'catalog_refreshes'
  ]) {
    await db.schema.dropTable(table).ifExists().execute()
  }
  await sql`DROP TABLE IF EXISTS entity_fts`.execute(db)
  await sql`DROP TABLE IF EXISTS entity_trigrams`.execute(db)
  await sql`DROP TABLE IF EXISTS metadata_fts`.execute(db)
  await sql`DROP TABLE IF EXISTS metadata_trigrams`.execute(db)
}
