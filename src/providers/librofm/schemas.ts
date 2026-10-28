import { z } from 'zod'

export const audiobookSearchItemSchema = z.object({
  title: z.string(),
  isbn: z.number(),
  authors: z.array(z.string()),
  cover_url: z.string(),
  catalog_info: z.object({
    bookseller_pick: z.boolean(),
    new_release: z.boolean(),
    coming_soon: z.boolean()
  }),
  audiobook_info: z.object({
    narrators: z.array(z.string())
  })
})

export const searchApiResponseSchema = z.object({
  user_info: z.object({
    signed_in: z.boolean()
  }),
  audiobook_collection: z.object({
    audiobooks: z.array(audiobookSearchItemSchema)
  })
})

export const genreSchema = z.object({
  id: z.number(),
  name: z.string(),
  html_name: z.string()
})

export const audiobookDetailsInfoSchema = z.object({
  narrators: z.array(z.string()),
  version_num: z.number(),
  tracks_updated_at: z.string(),
  duration: z.number(),
  size_bytes: z.number(),
  track_count: z.number(),
  parts_count: z.number(),
  pdf_extras: z.array(z.unknown()),
  audio_language: z.string(),
  audio_language_display: z.string(),
  ai_narrated: z.boolean()
})

export const audiobookDetailsSchema = z.object({
  id: z.number(),
  title: z.string(),
  isbn: z.number(),
  updated_at: z.string(),
  description: z.string(),
  abridged: z.boolean(),
  series: z.union([z.string(), z.null()]),
  series_num: z.union([z.string(), z.number(), z.null()]),
  lead: z.union([z.string(), z.null()]),
  genres: z.array(genreSchema),
  recommendations: z.array(z.unknown()),
  audiobook_info: audiobookDetailsInfoSchema,
  authors: z.array(z.string()),
  cover_url: z.string(),
  catalog_info: z.object({
    bookseller_pick: z.boolean(),
    new_release: z.boolean(),
    coming_soon: z.boolean()
  }),
  subtitle: z.union([z.string(), z.null()]),
  publisher: z.string(),
  publication_date: z.string(),
  created_at: z.string()
})

export const detailsApiResponseSchema = z.object({
  user_info: z.object({
    signed_in: z.boolean()
  }),
  data: z.object({
    audiobook: audiobookDetailsSchema,
    sample_url: z.string(),
    playlists: z.array(z.unknown()),
    related_audiobooks: z.array(z.unknown())
  })
})
