import type { z } from 'zod'
import type { BookMetadata, MetadataBundle } from '../../types'
import type {
  soundboothCatalogSchema,
  soundboothContributorSchema,
  soundboothItemSchema,
  soundboothSeriesSchema
} from './schemas'

export type SoundboothCatalog = z.infer<typeof soundboothCatalogSchema>
export type SoundboothContributor = z.infer<typeof soundboothContributorSchema>
export type SoundboothItem = z.infer<typeof soundboothItemSchema>
export type SoundboothSeries = z.infer<typeof soundboothSeriesSchema>

export interface SoundboothIndexEntry {
  id: string
  book: BookMetadata
  title: string
  series: string
  authors: string
}

export interface SoundboothCatalogIndex {
  bundle: MetadataBundle
  entries: SoundboothIndexEntry[]
}

export interface SoundboothMappingContext {
  fetchedAt: number
  contributors: Map<string, SoundboothContributor>
  series: Map<string, SoundboothSeries>
}
