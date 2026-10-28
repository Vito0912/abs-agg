import type { z } from 'zod'
import type {
  librivoxApiResponseSchema,
  librivoxAuthorSchema,
  librivoxBookSchema,
  librivoxGenreSchema,
  librivoxSectionSchema
} from './schemas'

export type LibrivoxAuthor = z.infer<typeof librivoxAuthorSchema>
export type LibrivoxSection = z.infer<typeof librivoxSectionSchema>
export type LibrivoxGenre = z.infer<typeof librivoxGenreSchema>
export type LibrivoxBook = z.infer<typeof librivoxBookSchema>
export type LibrivoxApiResponse = z.infer<typeof librivoxApiResponseSchema>
