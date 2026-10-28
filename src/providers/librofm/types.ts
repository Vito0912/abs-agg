import type { z } from 'zod'
import type {
  audiobookDetailsInfoSchema,
  audiobookDetailsSchema,
  audiobookSearchItemSchema,
  detailsApiResponseSchema,
  genreSchema,
  searchApiResponseSchema
} from './schemas'

export type AudiobookSearchItem = z.infer<typeof audiobookSearchItemSchema>
export type SearchApiResponse = z.infer<typeof searchApiResponseSchema>
export type Genre = z.infer<typeof genreSchema>
export type AudiobookDetailsInfo = z.infer<typeof audiobookDetailsInfoSchema>
export type AudiobookDetails = z.infer<typeof audiobookDetailsSchema>
export type DetailsApiResponse = z.infer<typeof detailsApiResponseSchema>
