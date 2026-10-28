import { z } from 'zod'

export const audibleRegionSchema = z.enum(['us', 'uk', 'de', 'fr', 'ca', 'au', 'it', 'es', 'in', 'jp', 'br'])

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined)
  .optional()
const personSchema = z.object({ name: z.string().trim().min(1), asin: optionalText })
const ratingDistributionSchema = z.object({
  average_rating: z.number().min(0).max(5),
  num_ratings: z.number().int().nonnegative()
})

export const audibleProductSchema = z.object({
  asin: z.string().regex(/^[A-Z0-9]{10}$/),
  title: z.string().trim().min(1),
  subtitle: optionalText,
  authors: personSchema.array().optional(),
  narrators: personSchema.array().optional(),
  publisher_name: optionalText,
  publisher_summary: optionalText,
  merchandising_summary: optionalText,
  release_date: optionalText,
  language: optionalText,
  runtime_length_min: z.number().nonnegative().nullish(),
  format_type: optionalText,
  content_delivery_type: optionalText,
  isbn: optionalText,
  product_images: z.record(z.string(), z.url()).optional(),
  series: z.array(z.object({ asin: optionalText, title: z.string(), sequence: optionalText })).optional(),
  category_ladders: z
    .array(
      z.object({
        ladder: z.array(z.object({ id: z.string(), name: z.string() })),
        root: z.string().optional()
      })
    )
    .optional(),
  rating: z
    .object({
      overall_distribution: ratingDistributionSchema.optional(),
      performance_distribution: ratingDistributionSchema.optional(),
      story_distribution: ratingDistributionSchema.optional(),
      num_reviews: z.number().int().nonnegative().optional()
    })
    .optional()
})

export const audibleSearchSchema = z.object({ products: audibleProductSchema.array() })
export const audibleDetailSchema = z.object({ product: audibleProductSchema })
