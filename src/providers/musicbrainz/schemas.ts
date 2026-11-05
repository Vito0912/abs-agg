import { z } from 'zod'

export const mbidSchema = z.uuid()

const artistSchema = z.object({ id: mbidSchema, name: z.string().trim().min(1) })
const artistRelationSchema = z.object({
  type: z.string(),
  attributes: z.array(z.string()).default([]),
  artist: artistSchema.optional(),
  series: z.object({ id: mbidSchema, name: z.string() }).optional(),
  'attribute-values': z.record(z.string(), z.string()).optional()
})
const workSchema = z.object({
  id: mbidSchema,
  title: z.string(),
  type: z.string().nullish(),
  language: z.string().nullish(),
  languages: z.array(z.string()).optional(),
  relations: z.array(artistRelationSchema).default([])
})
const recordingRelationSchema = artistRelationSchema.extend({ work: workSchema.optional() })
const trackSchema = z.object({
  id: mbidSchema,
  title: z.string(),
  position: z.number().int().nonnegative(),
  length: z.number().nonnegative().nullish(),
  recording: z.object({
    id: mbidSchema,
    length: z.number().nonnegative().nullish(),
    relations: z.array(recordingRelationSchema).default([])
  })
})
const releaseGroupSchema = z.object({
  id: mbidSchema,
  title: z.string(),
  'secondary-types': z.array(z.string()).default([])
})

export const releaseSearchSchema = z.object({
  releases: z.array(z.object({ id: mbidSchema, 'release-group': releaseGroupSchema })).max(100)
})
export const releaseSchema = z.object({
  id: mbidSchema,
  title: z.string().trim().min(1),
  date: z.string().optional(),
  barcode: z.string().nullish(),
  asin: z.string().nullish(),
  'cover-art-archive': z.object({ front: z.boolean() }).optional(),
  'release-group': releaseGroupSchema,
  'artist-credit': z
    .array(z.object({ name: z.string(), joinphrase: z.string().optional(), artist: artistSchema }))
    .default([]),
  'label-info': z.array(z.object({ label: z.object({ name: z.string() }).nullish() })).default([]),
  genres: z.array(z.object({ name: z.string() })).default([]),
  relations: z.array(artistRelationSchema).default([]),
  media: z
    .array(
      z.object({
        position: z.number().int().positive(),
        'track-count': z.number().int().nonnegative(),
        tracks: z.array(trackSchema).max(3000).default([]),
        pregap: trackSchema.optional()
      })
    )
    .max(100)
    .default([])
})
