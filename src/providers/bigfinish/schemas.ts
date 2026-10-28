import { z } from 'zod'

export const bigFinishSearchResultSchema = z.object({
  id: z.number(),
  release_slug: z.string(),
  name: z.string(),
  range_id: z.union([z.number(), z.null()]),
  description: z.union([z.string(), z.null()]),
  duration: z.union([z.string(), z.null()]),
  image: z.union([z.string(), z.null()]),
  contributors: z.array(
    z.object({
      name: z.string()
    })
  ),
  indexUid: z.string()
})

export const bigFinishSearchResponseSchema = z.object({
  hits: z.array(bigFinishSearchResultSchema),
  estimatedTotalHits: z.number(),
  limit: z.number(),
  offset: z.number(),
  query: z.string()
})

export const parsedBookDataSchema = z.object({
  schemaVersion: z.literal(3),
  url: z.string(),
  title: z.union([z.string(), z.null()]),
  series: z.union([z.string(), z.null()]),
  seriesTag: z.union([z.string(), z.null()]),
  releaseDate: z.union([z.string(), z.null()]),
  about: z.union([z.string(), z.null()]),
  duration: z.union([z.string(), z.null()]),
  writtenBy: z.union([z.string(), z.null()]),
  narratedBy: z.union([z.string(), z.null()]),
  coverUrl: z.union([z.string(), z.null()]),
  isbn: z.union([z.string(), z.null()])
})

export const namedContributorSchema = z.object({
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  label: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const bigFinishReleaseDataSchema = z.object({
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  range: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  release_number: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  release_date: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  about: z
    .object({
      summary: z
        .union([z.string(), z.null()])
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  written_by: z
    .array(namedContributorSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  contributors: z
    .array(namedContributorSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cast: z
    .array(namedContributorSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  production_credits: z
    .record(z.string(), z.union([z.array(namedContributorSchema), z.record(z.string(), z.unknown()), z.undefined()]))
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
