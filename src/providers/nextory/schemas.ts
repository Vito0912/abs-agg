import { z } from 'zod'

const personSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1)
})

export const nextoryFormatSchema = z.object({
  type: z.string(),
  identifier: z.string().min(1),
  state: z.string(),
  isbn: z.string().nullish(),
  duration: z.number().nonnegative().nullish(),
  pages: z.number().int().nonnegative().nullish(),
  img_url: z.string().nullish(),
  publication_date: z.string().nullish(),
  publisher: personSchema.nullish(),
  translators: z.array(personSchema).nullish()
})

export const nextoryProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1),
  media_type: z.string(),
  is_adult_book: z.boolean(),
  average_rating: z.number().min(0).max(5).nullish(),
  number_of_rates: z.number().int().nonnegative().nullish(),
  blurb: z.string().nullish(),
  description_full: z.string().nullish(),
  language: z.string().nullish(),
  authors: z.array(personSchema),
  narrators: z.array(personSchema).nullish(),
  series: personSchema.nullish(),
  volume: z.union([z.string(), z.number()]).nullish(),
  formats: z.array(nextoryFormatSchema)
})

export const nextorySearchSchema = z.object({
  products: z.array(nextoryProductSchema)
})
