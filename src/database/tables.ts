import type { Generated, Kysely } from 'kysely'
import type { Contributor, EntityKind, Identifier, MetadataSource, Rating } from '../types'

interface StateTable {
  id: number
  generation: number
}

interface PersonTable {
  person_key: Generated<number>
  entity_key: number
  name: string
}

interface IdentifierValueTable {
  identifier_key: Generated<number>
  value_type: 'identifier' | 'url' | 'inferred'
  scheme: Identifier['scheme']
  value: string
  namespace: string
  marketplace: string
}

interface ScopeTable {
  scope_key: Generated<number>
  fingerprint: string
}

interface ScopeParameterTable {
  scope_key: number
  position: number
  name: string
  value: string
  value_type: 'string' | 'number' | 'boolean'
}

export interface SourceEntityTable {
  entity_key: Generated<number>
  public_id: string
  provider: string
  kind: EntityKind
  source_identifier: number | null
  scope_key: number | null
}

export interface EntityVersionTable {
  version_key: Generated<number>
  revision: string
  entity_key: number
  name: string | null
  person_key: number | null
  description: string | null
  language: string | null
  stable: number
  detail_level: MetadataSource['quality']
  source_url: string | null
  source_url_is_key: number
  fetched_at: number
  created_at: number
  subtitle: string | null
  image: string | null
  format: 'audiobook' | 'ebook' | null
  publisher: string | null
  publication_date: string | null
  publication_precision: string | null
  duration_seconds: number | null
  page_count: number | null
  abridged: number | null
  sort_name: string | null
  birth_date: string | null
  birth_precision: string | null
  death_date: string | null
  death_precision: string | null
  total_books: number | null
  sequence: number | null
  start_seconds: number | null
  end_seconds: number | null
  timeline: 'book' | 'file' | null
  file_id: string | null
}

interface VersionTermTable {
  version_key: number
  category: 'genre' | 'tag' | 'alternative'
  position: number
  value: string
}

interface VersionIdentifierTable {
  version_key: number
  position: number
  identifier_key: number
}

interface VersionContributorTable {
  version_key: number
  position: number
  person_key: number
  linked: number
  role: Contributor['role']
  source_identifier: number | null
}

interface VersionRelationTable {
  version_key: number
  position: number
  target_key: number
  type: 'editionOf' | 'partOf' | 'chapterOf' | 'hasChapter'
  sequence: string | null
  ordering: string | null
}

interface VersionRatingTable {
  version_key: number
  position: number
  source: string
  value: number
  minimum: number
  maximum: number
  rating_count: number | null
  review_count: number | null
  aspect: Rating['aspect']
}

interface VersionProvenanceTable {
  version_key: number
  field: string
  provider: string
  donor_key: number
  fetched_at: number
  evidence: 'isbn' | 'asin' | 'provider-relationship'
}

interface CatalogEntityTable {
  entity_key: number
  version_key: number
  observed_at: number
  fetched_at: number
  stored_at: number
}

interface SearchCacheTable {
  cache_key: Generated<number>
  key: string
  provider: string
  complete: number
  entity_count: number
  match_count: number
  started_at: number
  fresh_until: number
  stale_until: number
  error_until: number
}

interface SearchCacheMemberTable {
  cache_key: number
  position: number
  version_key: number
  match_position: number | null
  fetched_at: number | null
}

interface CollectionCacheTable {
  collection_key: Generated<number>
  key: string
  provider: string
  entity_count: number
  match_count: number
  complete: number
  started_at: number
  fresh_until: number
  error_until: number
}

interface CollectionMemberTable {
  collection_key: number
  entity_key: number
  position: number
  match_position: number | null
}

interface CatalogRefreshTable {
  key: string
  provider: string
  next_allowed_at: number
}

interface SearchIndexTable {
  rowid: number
  name: string
  authors: string
  rank: Generated<number>
}

export interface DatabaseTables {
  state: StateTable
  people: PersonTable
  identifier_values: IdentifierValueTable
  scopes: ScopeTable
  scope_parameters: ScopeParameterTable
  source_entities: SourceEntityTable
  entity_versions: EntityVersionTable
  version_terms: VersionTermTable
  version_identifiers: VersionIdentifierTable
  version_contributors: VersionContributorTable
  version_relations: VersionRelationTable
  version_ratings: VersionRatingTable
  version_provenance: VersionProvenanceTable
  catalog_entities: CatalogEntityTable
  search_cache: SearchCacheTable
  search_cache_members: SearchCacheMemberTable
  collection_cache: CollectionCacheTable
  collection_members: CollectionMemberTable
  catalog_refreshes: CatalogRefreshTable
  metadata_fts: SearchIndexTable
  metadata_trigrams: Omit<SearchIndexTable, 'authors'>
}

export type MetadataDatabase = Kysely<DatabaseTables>
