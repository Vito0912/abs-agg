import { z } from 'zod'

export const storytelBookSchema = z.object({
  id: z.number(),
  name: z.string(),
  consumableId: z.string(),
  cover: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  coverE: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  largeCover: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  largeCoverE: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  authorsAsString: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  language: z
    .object({
      id: z.number(),
      isoValue: z.string(),
      name: z.string()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  category: z
    .object({
      id: z.number(),
      title: z.string()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publisher: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  releaseDate: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  series: z
    .array(
      z.object({
        id: z.number(),
        name: z.string()
      })
    )
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  seriesOrder: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  tags: z
    .array(
      z.object({
        id: z.number(),
        name: z.string()
      })
    )
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const storytelAbookSchema = z.object({
  id: z.number(),
  isbn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  length: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  narratorAsString: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  narrators: z
    .array(
      z.object({
        id: z.number(),
        name: z.string()
      })
    )
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publisher: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  releaseDate: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const storytelEbookSchema = z.object({
  id: z.number(),
  isbn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publisher: z
    .object({
      id: z.number(),
      name: z.string()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  releaseDate: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const storytelSearchResultSchema = z.object({
  abook: z
    .union([storytelAbookSchema, z.null()])
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  book: z
    .union([storytelBookSchema, z.null()])
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  ebook: z
    .union([storytelEbookSchema, z.null()])
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  consumableId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  shareUrl: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const storytelSearchResponseSchema = z.object({
  books: z.array(storytelSearchResultSchema),
  suggestions: z
    .array(z.unknown())
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
