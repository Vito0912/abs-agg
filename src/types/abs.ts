import { bookMetadataSchema } from './providerBook'
import { z } from 'zod'

export const absBookSchema = bookMetadataSchema
  .pick({
    title: true,
    subtitle: true,
    author: true,
    narrator: true,
    publisher: true,
    publishedYear: true,
    description: true,
    cover: true,
    isbn: true,
    asin: true,
    bookId: true,
    genres: true,
    tags: true,
    language: true,
    duration: true,
    poweredBy: true
  })
  .extend({ series: z.array(z.object({ series: z.string(), sequence: z.string().optional() })).optional() })
export type AbsBook = z.infer<typeof absBookSchema>
