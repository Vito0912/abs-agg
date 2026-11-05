import type { z } from 'zod'
import type { releaseSchema } from './schemas'

export type MusicBrainzRelease = z.infer<typeof releaseSchema>
export type MusicBrainzTrack = MusicBrainzRelease['media'][number]['tracks'][number]
export type MusicBrainzRelation = MusicBrainzTrack['recording']['relations'][number]
export type MusicBrainzWork = NonNullable<MusicBrainzRelation['work']>
