import type { z } from 'zod'
import type { goodreadsSearchResultSchema } from './schemas'

export type GoodreadsSearchResult = z.infer<typeof goodreadsSearchResultSchema>
