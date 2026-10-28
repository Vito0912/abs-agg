import { z } from 'zod'

export const goodreadsSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  authorName: z.string(),
  imageUrl: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
