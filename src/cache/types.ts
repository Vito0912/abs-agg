import type { EntityKind, MetadataQuery, ParsedParameters } from '../types'

export interface CacheIdentity {
  provider: string
  version: number
}

export type CacheKeyRequest = CacheIdentity &
  (
    | { type: 'search'; query: MetadataQuery; params: ParsedParameters }
    | { type: 'detail'; kind: EntityKind; id: string; params: ParsedParameters }
    | { type: 'catalog'; name: string }
  )
