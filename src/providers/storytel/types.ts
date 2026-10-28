import type { z } from 'zod'
import type {
  storytelAbookSchema,
  storytelBookSchema,
  storytelEbookSchema,
  storytelSearchResponseSchema,
  storytelSearchResultSchema
} from './schemas'

export type StorytelBook = z.infer<typeof storytelBookSchema>
export type StorytelAbook = z.infer<typeof storytelAbookSchema>
export type StorytelEbook = z.infer<typeof storytelEbookSchema>
export type StorytelSearchResult = z.infer<typeof storytelSearchResultSchema>
export type StorytelSearchResponse = z.infer<typeof storytelSearchResponseSchema>
