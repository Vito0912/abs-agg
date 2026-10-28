import type { Generated, Kysely } from 'kysely'

export interface StateTable {
  id: number
  generation: number
}

export interface SnapshotTable {
  revision: string
  entity_id: string
  payload: string
  created_at: number
}

export interface EntityTable {
  rowid: Generated<number>
  id: string
  provider: string
  kind: 'work' | 'book' | 'author' | 'series' | 'chapter'
  name: string
  authors: string
  scope: string
  payload: string
  quality: number
  fetched_at: number
  stored_at: number
}

export interface IdentifierTable {
  entity_id: string
  scheme: string
  value: string
  namespace: string
  marketplace: string
}

export interface CacheEntryTable {
  key: string
  provider: string
  matches: string
  complete: number
  started_at: number
  fresh_until: number
  stale_until: number
  error_until: number
}

export interface CacheReferenceTable {
  key: string
  position: number
  revision: string
  fetched_at: number | null
}

export interface CatalogCacheTable {
  key: string
  provider: string
  payload: string
  started_at: number
  fresh_until: number
  error_until: number
}

export interface CatalogRefreshTable {
  key: string
  provider: string
  next_allowed_at: number
}

export interface CatalogMembershipTable {
  key: string
  entity_id: string
  position: number
  match_position: number | null
}

export interface SearchIndexTable {
  rowid: number
  name: string
  authors: string
  rank: number
}

export interface DatabaseTables {
  state: StateTable
  snapshots: SnapshotTable
  entities: EntityTable
  identifiers: IdentifierTable
  cache_entries: CacheEntryTable
  cache_references: CacheReferenceTable
  catalog_cache: CatalogCacheTable
  catalog_refreshes: CatalogRefreshTable
  catalog_memberships: CatalogMembershipTable
  entity_fts: SearchIndexTable
  entity_trigrams: Omit<SearchIndexTable, 'authors'>
}

export type MetadataDatabase = Kysely<DatabaseTables>
