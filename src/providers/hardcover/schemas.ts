import { z } from 'zod'

export const hardcoverImageSchema = z.object({
  url: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverAuthorSchema = z.object({
  id: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  slug: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverContributionSchema = z.object({
  author: hardcoverAuthorSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  contribution: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverSeriesSchema = z.object({
  id: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  slug: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverBookSeriesSchema = z.object({
  series: hardcoverSeriesSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  position: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverPublisherSchema = z.object({
  id: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverLanguageSchema = z.object({
  language: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverTagSchema = z.object({
  tag: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverTaggingSchema = z.object({
  tag: hardcoverTagSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverEditionSchema = z.object({
  reading_format_id: z.number().int().optional(),
  id: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  subtitle: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  isbn_10: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  isbn_13: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  asin: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  pages: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  audio_seconds: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  release_date: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  release_year: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  physical_format: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publisher: hardcoverPublisherSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  language: hardcoverLanguageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: hardcoverImageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverBookSchema = z.object({
  id: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  slug: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  subtitle: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  release_year: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  release_date: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  pages: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  audio_seconds: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  rating: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  ratings_count: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  headline: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  alternative_titles: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: hardcoverImageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  contributions: z
    .array(hardcoverContributionSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  book_series: z
    .array(hardcoverBookSeriesSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  taggings: z
    .array(hardcoverTaggingSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  default_audio_edition: hardcoverEditionSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  default_physical_edition: hardcoverEditionSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  default_cover_edition: hardcoverEditionSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  editions: z
    .array(hardcoverEditionSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverSearchResponseSchema = z.object({
  search: z
    .object({
      ids: z
        .array(z.union([z.number(), z.string()]))
        .nullish()
        .transform((value) => value ?? undefined)
        .optional(),
      results: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const hardcoverBooksResponseSchema = z.object({
  books: z
    .array(hardcoverBookSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
