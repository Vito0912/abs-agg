import type { z } from 'zod'
import type {
  dreifragChapterSchema,
  dreifragDataSchema,
  dreifragEpisodeSchema,
  dreifragKidsDataSchema,
  dreifragLinksSchema,
  dreifragRoleSchema,
  dreifragScoredItemSchema,
  dreifragSourceSchema,
  dreifragSpezialDataSchema,
  dreifragSpezialEpisodeSchema
} from './schemas'

export type DreifragChapter = z.infer<typeof dreifragChapterSchema>
export type DreifragRole = z.infer<typeof dreifragRoleSchema>
export type DreifragLinks = z.infer<typeof dreifragLinksSchema>
export type DreifragEpisode = z.infer<typeof dreifragEpisodeSchema>
export type DreifragData = z.infer<typeof dreifragDataSchema>
export type DreifragSpezialEpisode = z.infer<typeof dreifragSpezialEpisodeSchema>
export type DreifragSpezialData = z.infer<typeof dreifragSpezialDataSchema>
export type DreifragKidsData = z.infer<typeof dreifragKidsDataSchema>
export type DreifragSource = z.infer<typeof dreifragSourceSchema>
export type DreifragScoredItem = z.infer<typeof dreifragScoredItemSchema>
