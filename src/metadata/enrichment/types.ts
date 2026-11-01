import type { Identifier, MetadataEntity } from '../../types'

export type BookEntity = Extract<MetadataEntity, { kind: 'work' | 'book' }>

export interface EnrichmentLookup {
  findIdentifier(identifier: Identifier, providers: string[]): Promise<MetadataEntity[]>
  findTitle?(title: string, kind: 'work' | 'book', providers: string[]): Promise<MetadataEntity[]>
  loadEntities?(ids: string[], providers: string[]): Promise<MetadataEntity[]>
}

export interface EnrichmentCandidate<Entity extends BookEntity = BookEntity> {
  entity: Entity
  evidence: 'isbn' | 'asin' | 'title-author-subtitle'
}
