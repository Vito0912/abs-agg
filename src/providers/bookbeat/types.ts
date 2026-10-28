import type { z } from 'zod'
import type { bookBeatBookSchema, bookBeatSuggestSchema } from './schemas'

export type BookBeatSuggest = z.infer<typeof bookBeatSuggestSchema>
export type BookBeatBook = z.infer<typeof bookBeatBookSchema>
