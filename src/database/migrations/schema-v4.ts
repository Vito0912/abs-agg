import type { Generated, Kysely } from 'kysely'
import type { DatabaseTables, EntityVersionTable } from '../tables'

export interface Version4Tables extends Omit<
  DatabaseTables,
  'people' | 'entity_versions' | 'version_contributors' | 'version_terms' | 'named_values'
> {
  people: { person_key: Generated<number>; entity_key: number; name: string }
  entity_versions: Omit<EntityVersionTable, 'person_name' | 'series_key' | 'publisher_key'> & {
    publisher: string | null
  }
  version_contributors: {
    version_key: number
    position: number
    person_key: number
    linked: number
    role: string
    source_identifier: number | null
  }
  version_terms: { version_key: number; category: 'genre' | 'tag' | 'alternative'; position: number; value: string }
}

export type Version4Database = Kysely<Version4Tables>
