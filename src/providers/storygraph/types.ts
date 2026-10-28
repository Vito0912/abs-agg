import type { z } from 'zod'
import type { storyGraphSearchResultSchema } from './schemas'

export type StoryGraphSearchResult = z.infer<typeof storyGraphSearchResultSchema>
