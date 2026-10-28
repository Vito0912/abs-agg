import type { z } from 'zod'
import type { deezerAlbumDetailsSchema, deezerSearchAlbumSchema } from './schemas'

export type DeezerSearchAlbum = z.infer<typeof deezerSearchAlbumSchema>
export type DeezerAlbumDetails = z.infer<typeof deezerAlbumDetailsSchema>
