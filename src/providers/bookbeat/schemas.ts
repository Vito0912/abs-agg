import { z } from 'zod'

export const bookBeatSuggestSchema = z.object({
  id: z.string(),
  value: z.string(),
  type: z.string(),
  _links: z.object({
    search: z.object({
      href: z.string(),
      method: z.string()
    })
  })
})

export const bookBeatBookSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  author: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  language: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  audiobookisbn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  ebookisbn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  published: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  contenttypetags: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  series: z
    .object({
      name: z.string(),
      id: z.number().optional(),
      displaypartnumber: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  _embedded: z
    .object({
      contributors: z
        .array(
          z.object({
            id: z.number().optional(),
            displayname: z.string(),
            role: z.string()
          })
        )
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
