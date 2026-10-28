import type { z } from 'zod'
import type { detailSectionSchema, detailsResponseSchema, exploreReadSchema, searchResponseSchema } from './schemas'

export type ExploreRead = z.infer<typeof exploreReadSchema>
export type SearchResponse = z.infer<typeof searchResponseSchema>
export type DetailSection = z.infer<typeof detailSectionSchema>
export type DetailsResponse = z.infer<typeof detailsResponseSchema>
