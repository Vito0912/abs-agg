import { z } from 'zod'

export const deezerSearchAlbumSchema = z.object({ id: z.number().int().positive() })
export const deezerAlbumDetailsSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  duration: z.number().nonnegative(),
  release_date: z.string().optional(),
  label: z.string().optional(),
  cover: z.string().optional(),
  cover_medium: z.string().optional(),
  cover_big: z.string().optional(),
  cover_xl: z.string().optional(),
  genres: z.object({ data: z.array(z.object({ name: z.string() })).optional() }).optional(),
  artist: z.object({ id: z.number().int(), name: z.string() }).optional()
})
