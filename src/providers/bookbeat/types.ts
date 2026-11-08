import type { z } from 'zod'
import type { bookBeatBookSchema } from './schemas'

export type BookBeatBook = z.infer<typeof bookBeatBookSchema>
