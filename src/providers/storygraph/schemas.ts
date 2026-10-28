import { z } from 'zod'

export const storyGraphSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cover: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
