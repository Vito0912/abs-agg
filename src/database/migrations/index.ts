import type { Migration } from 'kysely/migration'
import * as prerelease from './000_1_1_0_rebuild_prerelease'
import * as state from './001_1_1_0_state'
import * as identifierValues from './002_1_1_0_identifier_values'
import * as scopes from './003_1_1_0_scopes'
import * as scopeParameters from './004_1_1_0_scope_parameters'
import * as sourceEntities from './005_1_1_0_source_entities'
import * as people from './006_1_1_0_people'
import * as entityVersions from './007_1_1_0_entity_versions'
import * as versionIdentifiers from './008_1_1_0_version_identifiers'
import * as versionTerms from './009_1_1_0_version_terms'
import * as versionContributors from './010_1_1_0_version_contributors'
import * as versionRelations from './011_1_1_0_version_relations'
import * as versionRatings from './012_1_1_0_version_ratings'
import * as versionProvenance from './013_1_1_0_version_provenance'
import * as catalogEntities from './014_1_1_0_catalog_entities'
import * as searchCache from './015_1_1_0_search_cache'
import * as searchCacheMembers from './016_1_1_0_search_cache_members'
import * as collectionCache from './017_1_1_0_collection_cache'
import * as collectionMembers from './018_1_1_0_collection_members'
import * as catalogRefreshes from './019_1_1_0_catalog_refreshes'
import * as metadataFts from './020_1_1_0_metadata_fts'
import * as metadataTrigrams from './021_1_1_0_metadata_trigrams'
import * as ready from './022_1_1_0_ready'

export const migrations: Record<string, Migration> = {
  '000_1_1_0_rebuild_prerelease': prerelease,
  '001_1_1_0_state': state,
  '002_1_1_0_identifier_values': identifierValues,
  '003_1_1_0_scopes': scopes,
  '004_1_1_0_scope_parameters': scopeParameters,
  '005_1_1_0_source_entities': sourceEntities,
  '006_1_1_0_people': people,
  '007_1_1_0_entity_versions': entityVersions,
  '008_1_1_0_version_identifiers': versionIdentifiers,
  '009_1_1_0_version_terms': versionTerms,
  '010_1_1_0_version_contributors': versionContributors,
  '011_1_1_0_version_relations': versionRelations,
  '012_1_1_0_version_ratings': versionRatings,
  '013_1_1_0_version_provenance': versionProvenance,
  '014_1_1_0_catalog_entities': catalogEntities,
  '015_1_1_0_search_cache': searchCache,
  '016_1_1_0_search_cache_members': searchCacheMembers,
  '017_1_1_0_collection_cache': collectionCache,
  '018_1_1_0_collection_members': collectionMembers,
  '019_1_1_0_catalog_refreshes': catalogRefreshes,
  '020_1_1_0_metadata_fts': metadataFts,
  '021_1_1_0_metadata_trigrams': metadataTrigrams,
  '022_1_1_0_ready': ready
}

export const latestSchemaVersion = 3
