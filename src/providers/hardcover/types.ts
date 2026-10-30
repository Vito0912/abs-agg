import type { z } from 'zod'
import type {
  hardcoverAuthorSchema,
  hardcoverBookSchema,
  hardcoverBookSeriesSchema,
  hardcoverContributionSchema,
  hardcoverEditionSchema,
  hardcoverImageSchema,
  hardcoverLanguageSchema,
  hardcoverPublisherSchema,
  hardcoverSeriesSchema,
  hardcoverTagSchema,
  hardcoverTaggingSchema
} from './schemas'

export type HardcoverImage = z.infer<typeof hardcoverImageSchema>
export type HardcoverAuthor = z.infer<typeof hardcoverAuthorSchema>
export type HardcoverContribution = z.infer<typeof hardcoverContributionSchema>
export type HardcoverSeries = z.infer<typeof hardcoverSeriesSchema>
export type HardcoverBookSeries = z.infer<typeof hardcoverBookSeriesSchema>
export type HardcoverPublisher = z.infer<typeof hardcoverPublisherSchema>
export type HardcoverLanguage = z.infer<typeof hardcoverLanguageSchema>
export type HardcoverTag = z.infer<typeof hardcoverTagSchema>
export type HardcoverTagging = z.infer<typeof hardcoverTaggingSchema>
export type HardcoverEdition = z.infer<typeof hardcoverEditionSchema>
export type HardcoverBook = z.infer<typeof hardcoverBookSchema>
