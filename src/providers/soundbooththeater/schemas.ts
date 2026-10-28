import { z } from 'zod'

const imageSchema = z.object({
  attachment: z.object({ url: z.string().nullish(), url1024Jpg: z.string().nullish() }).nullish()
})
const castSchema = z.object({ teamMember: z.string(), type: z.string() })

export const soundboothContributorSchema = z.object({
  _id: z.string().min(1),
  name: z.string().trim().min(1),
  biography: z.string().nullish(),
  image: imageSchema.nullish()
})

export const soundboothSeriesSchema = z.object({
  _id: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullish(),
  isArchived: z.boolean(),
  status: z.string(),
  displayOptions: z.object({ image: imageSchema.nullish(), imageSquare: imageSchema.nullish() })
})

export const soundboothItemSchema = z.object({
  _id: z.string().min(1),
  seriesId: z.string().nullish(),
  name: z.string().trim().min(1),
  description: z.string().nullish(),
  format: z.string(),
  type: z.string(),
  status: z.string(),
  isArchived: z.boolean(),
  cast: z.array(castSchema).max(1000).nullish(),
  genres: z.array(z.object({ name: z.string() })).max(1000),
  tags: z.array(z.string()).max(1000).nullish(),
  language: z.string().nullish(),
  isbn13: z.string().nullish(),
  releaseAt: z.string().nullish(),
  originalReleaseAt: z.string().nullish(),
  totalDuration: z.number().nonnegative(),
  totalReviews: z.number().int().nonnegative().nullish(),
  averageRating: z.number().min(1).max(5).nullish(),
  averagePerformance: z.number().min(1).max(5).nullish(),
  averagePlot: z.number().min(1).max(5).nullish(),
  displayOptions: z.object({ image: imageSchema.nullish() })
})

export function soundboothListSchema<T>(record: z.ZodType<T>) {
  return z.object({
    success: z.literal(true),
    data: z
      .object({
        docs: z.array(record).max(50000),
        hasNextPage: z.literal(false),
        hasMore: z.literal(false),
        totalDocs: z.number().int().nonnegative().max(50000)
      })
      .refine((data) => data.totalDocs === data.docs.length, 'Soundbooth Theater catalog is incomplete')
  })
}

export const soundboothCatalogSchema = z.object({
  fetchedAt: z.number().int().nonnegative(),
  items: z.array(soundboothItemSchema).max(50000),
  contributors: z.array(soundboothContributorSchema).max(50000),
  series: z.array(soundboothSeriesSchema).max(50000)
})
