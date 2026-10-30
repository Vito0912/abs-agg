import { z } from 'zod'
import { contributorSchema, ratingSchema } from './metadata'

export const seriesMetadataSchema = z.object({
  series: z.string().trim().min(1),
  sequence: z.string().optional(),
  sourceId: z.string().optional()
})
export const bookMetadataSchema = z.object({
  title: z.string(),
  fetchedAt: z.number().int().nonnegative().optional(),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  narrator: z.string().optional(),
  publisher: z.string().optional(),
  publishedYear: z.string().optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  cover: z.string().optional(),
  isbn: z.string().optional(),
  asin: z.string().optional(),
  marketplace: z.string().optional(),
  bookId: z.string().optional(),
  sourceUrl: z.url().optional(),
  sourceIdStable: z.boolean().optional(),
  genres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  series: z.array(seriesMetadataSchema).optional(),
  language: z.string().optional(),
  duration: z.number().nonnegative().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  poweredBy: z.string().optional(),
  metadataKind: z.enum(['work', 'book']).optional(),
  work: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      subtitle: z.string().optional(),
      image: z.string().optional(),
      genres: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      alternativeNames: z.array(z.string()).optional(),
      publishedYear: z.string().optional(),
      ratings: z.array(ratingSchema).optional()
    })
    .optional(),
  format: z.enum(['audiobook', 'ebook']).optional(),
  contributors: z.array(contributorSchema).optional(),
  authors: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        image: z.string().optional()
      })
    )
    .optional(),
  ratings: z.array(ratingSchema).optional(),
  pageCount: z.number().int().positive().optional(),
  abridged: z.boolean().optional(),
  alternativeNames: z.array(z.string()).optional(),
  quality: z.enum(['summary', 'detail']).optional(),
  chapters: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        sequence: z.number().int().nonnegative().optional(),
        startSeconds: z.number().nonnegative().optional(),
        endSeconds: z.number().nonnegative().optional()
      })
    )
    .optional()
})
export type SeriesMetadata = z.infer<typeof seriesMetadataSchema>
export type BookMetadata = z.infer<typeof bookMetadataSchema>
