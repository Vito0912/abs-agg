import { z } from 'zod'

const personSchema = z.object({ id: z.string().min(1), name: z.string().min(1) })
const seriesSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: z.string().optional()
})

export const audioSiloSearchSchema = z.object({
  results: z.array(
    z.object({
      kind: z.literal('work'),
      id: z.string().min(1),
      title: z.string(),
      authors: personSchema.array()
    })
  )
})
export const audioSiloRecordingSchema = z.object({
  id: z.string().min(1),
  narrators: personSchema.array(),
  abridged: z.boolean().optional(),
  runtime_min: z.number().nonnegative().optional(),
  release_date: z.string().optional(),
  publisher: z.string().optional(),
  asin: z.array(z.object({ region: z.string().min(1), asin: z.string().regex(/^[A-Z0-9]{10}$/) })),
  isbn: z.string().array(),
  cover_url: z.url().optional(),
  chapter_count: z.number().int().nonnegative()
})
export const audioSiloWorkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  authors: personSchema.array(),
  language: z.string().min(1),
  first_published: z.string().optional(),
  description: z.string().optional(),
  community_description: z.object({ text: z.string(), license: z.literal('CC-BY-SA-4.0').optional() }).optional(),
  genres: z.string().array().optional(),
  series: seriesSchema.array(),
  xref: z
    .object({ wikidata: z.string().optional(), openlibrary: z.string().optional(), goodreads: z.string().optional() })
    .optional(),
  recordings: audioSiloRecordingSchema.array().nullable()
})
export const audioSiloChaptersSchema = z.object({
  chapters: z.array(
    z.object({
      title: z.string(),
      start_ms: z.number().int().nonnegative(),
      length_ms: z.number().int().nonnegative()
    })
  )
})
