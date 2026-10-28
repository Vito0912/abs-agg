import { z } from 'zod'

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined)
  .optional()

export const exploreReadSchema = z.object({
  read_id: z.string(),
  title: z.string(),
  author: optionalText,
  article_image_url: optionalText,
  cover_image_urls: z.object({ large: optionalText, medium: optionalText, thumbnail: optionalText }).nullish(),
  audio_duration_seconds: z.number().nonnegative().nullish(),
  average_rating: z.number().nullish(),
  total_rating_count: z.number().int().nonnegative().nullish(),
  language: optionalText
})

export const searchResponseSchema = z.object({
  items: z.array(z.object({ type: z.string(), explore_read: exploreReadSchema.optional() })).optional()
})

const itemSchema = z.object({ title: z.string(), value: z.string() })
const headerSchema = z.object({
  type: z.literal('media_header_v1'),
  title: optionalText,
  author: optionalText,
  author_id: optionalText,
  subtitle: optionalText,
  description: optionalText,
  narrated_by: optionalText,
  image: z.object({ image_url: optionalText }).nullish(),
  collection_tags: z.array(z.object({ title: z.string() })).nullish()
})
const metaSchema = z.object({ type: z.literal('meta_v1'), items: itemSchema.array() })
const detailsSchema = z.object({ type: z.literal('details_v1'), items: itemSchema.array() })
const descriptionSchema = z.object({
  type: z.literal('title_description_v1'),
  title: optionalText,
  description: optionalText
})
const chaptersSchema = z.object({
  type: z.literal('chapters_v1'),
  items: z.array(z.object({ name: z.string() }))
})
const authorSchema = z.object({
  type: z.literal('author_v1'),
  name: z.string(),
  author_id: optionalText,
  avatar_url: optionalText,
  bio: optionalText
})
const ratingSchema = z.object({ type: z.literal('rating_v1'), text: z.string() })

export const detailSectionSchema = z.discriminatedUnion('type', [
  headerSchema,
  metaSchema,
  detailsSchema,
  descriptionSchema,
  chaptersSchema,
  authorSchema,
  ratingSchema
])
const supportedSectionTypes = new Set([
  'media_header_v1',
  'meta_v1',
  'details_v1',
  'title_description_v1',
  'chapters_v1',
  'author_v1',
  'rating_v1'
])

export const detailsResponseSchema = z.object({
  sections: z.array(z.unknown()).transform((sections) => {
    return sections.flatMap((section) => {
      const header = z.object({ type: z.string() }).parse(section)
      if (!supportedSectionTypes.has(header.type)) return []

      return [detailSectionSchema.parse(section)]
    })
  })
})
