import type { z } from 'zod'
import type {
  bigFinishReleaseDataSchema,
  bigFinishSearchResponseSchema,
  bigFinishSearchResultSchema,
  namedContributorSchema,
  parsedBookDataSchema
} from './schemas'

export type BigFinishSearchResult = z.infer<typeof bigFinishSearchResultSchema>
export type BigFinishSearchResponse = z.infer<typeof bigFinishSearchResponseSchema>
export type ParsedBookData = z.infer<typeof parsedBookDataSchema>
export type NamedContributor = z.infer<typeof namedContributorSchema>
export type BigFinishReleaseData = z.infer<typeof bigFinishReleaseDataSchema>
