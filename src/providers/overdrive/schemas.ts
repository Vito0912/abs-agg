import { z } from 'zod'

export const overdriveLibrarySchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?(?![\s\S])/)

const identifierSchema = z.union([z.string().min(1), z.number().int().positive()]).transform(String)

const coverSchema = z.object({
  href: z.url(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  isPlaceholderImage: z.boolean().optional()
})

export const overdriveFormatSchema = z.object({
  id: z.string(),
  isbn: z.string().nullish(),
  duration: z.string().nullish(),
  identifiers: z.array(z.object({ type: z.string(), value: z.string() })).optional()
})

export const overdriveItemSchema = z.object({
  id: identifierSchema,
  reserveId: z.uuid(),
  title: z.string().trim().min(1),
  subtitle: z.string().nullish(),
  type: z.object({ id: z.string() }),
  creators: z.array(z.object({ id: identifierSchema, name: z.string().trim().min(1), role: z.string() })).optional(),
  languages: z.array(z.object({ id: z.string() })).optional(),
  publisher: z.object({ name: z.string() }).nullish(),
  publishDate: z.string().nullish(),
  description: z.string().nullish(),
  subjects: z.array(z.object({ name: z.string() })).optional(),
  covers: z.record(z.string(), coverSchema).optional(),
  starRating: z.number().min(0).max(5).nullish(),
  starRatingCount: z.number().int().nonnegative().nullish(),
  edition: z.string().nullish(),
  series: z.string().nullish(),
  detailedSeries: z
    .object({
      seriesId: identifierSchema.optional(),
      seriesName: z.string().optional(),
      rank: z.union([z.number(), z.string()]).nullish()
    })
    .nullish(),
  formats: z.array(overdriveFormatSchema)
})

export const overdriveSearchSchema = z.object({
  items: z.array(overdriveItemSchema).max(100),
  totalItems: z.number().int().nonnegative()
})
