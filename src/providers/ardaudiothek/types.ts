import type { z } from 'zod'
import type {
  ardEditorialCategorySchema,
  ardImageSchema,
  ardProgramSetSchema,
  ardProgramSetSearchResponseSchema,
  ardPublicationServiceSchema,
  ardSearchEditorialCollectionSchema,
  ardSearchItemSchema,
  ardSearchProgramSetSchema,
  ardSearchResponseSchema,
  ardSearchTypeSchema
} from './schemas'

export type ArdImage = z.infer<typeof ardImageSchema>
export type ArdPublicationService = z.infer<typeof ardPublicationServiceSchema>
export type ArdEditorialCategory = z.infer<typeof ardEditorialCategorySchema>
export type ArdProgramSet = z.infer<typeof ardProgramSetSchema>
export type ArdProgramSetSearchResponse = z.infer<typeof ardProgramSetSearchResponseSchema>
export type ArdSearchItem = z.infer<typeof ardSearchItemSchema>
export type ArdSearchProgramSet = z.infer<typeof ardSearchProgramSetSchema>
export type ArdSearchEditorialCollection = z.infer<typeof ardSearchEditorialCollectionSchema>
export type ArdSearchResponse = z.infer<typeof ardSearchResponseSchema>
export type ArdSearchType = z.infer<typeof ardSearchTypeSchema>
