import { z } from 'zod'

export const entityKindSchema = z.enum(['work', 'book', 'author', 'series', 'chapter'])
export const identifierSchema = z.object({
  scheme: z.enum(['isbn', 'asin', 'provider', 'isni', 'doi', 'openlibrary', 'wikidata']),
  value: z.string().trim().min(1),
  namespace: z.string().min(1).optional(),
  marketplace: z.string().min(1).optional()
})
export const dateSchema = z
  .object({
    value: z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/),
    precision: z.enum(['year', 'month', 'day'])
  })
  .refine((date) => date.value.length === { year: 4, month: 7, day: 10 }[date.precision])
export const ratingSchema = z
  .object({
    source: z.string().min(1),
    value: z.number(),
    minimum: z.number(),
    maximum: z.number(),
    ratingCount: z.number().int().nonnegative().optional(),
    reviewCount: z.number().int().nonnegative().optional(),
    aspect: z.enum(['overall', 'story', 'performance']).default('overall')
  })
  .refine(
    (rating) => rating.maximum > rating.minimum && rating.value >= rating.minimum && rating.value <= rating.maximum
  )
export const contributorSchema = z.object({
  name: z.string().trim().min(1),
  role: z.enum(['author', 'narrator', 'translator', 'editor', 'illustrator', 'performer', 'adapter', 'composer']),
  sourceId: z.string().optional(),
  authorId: z.string().optional()
})
export const sourceSchema = z.object({
  provider: z.string().min(1),
  sourceId: z.string().min(1),
  scope: z.string(),
  stable: z.boolean(),
  fetchedAt: z.number().int().nonnegative(),
  quality: z.enum(['summary', 'detail']),
  url: z.url().optional()
})
export const relationSchema = z.object({
  type: z.enum(['editionOf', 'partOf', 'chapterOf', 'hasChapter']),
  targetId: z.string().min(1),
  sequence: z.string().optional(),
  order: z.enum(['unspecified', 'reading', 'publication']).optional()
})
export const attributionSchema = z.object({
  provider: z.string(),
  entityId: z.string(),
  fetchedAt: z.number().int(),
  evidence: z.enum(['isbn', 'asin', 'provider-relationship'])
})
const common = {
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().trim().min(1).max(2000),
  description: z.string().optional(),
  language: z.string().optional(),
  identifiers: z.array(identifierSchema),
  relations: z.array(relationSchema),
  source: sourceSchema,
  provenance: z.record(z.string(), attributionSchema)
}
const creativeWork = {
  subtitle: z.string().optional(),
  contributors: z.array(contributorSchema),
  genres: z.array(z.string()),
  tags: z.array(z.string()),
  ratings: z.array(ratingSchema),
  image: z.string().optional()
}
export const workSchema = z.object({
  ...common,
  ...creativeWork,
  kind: z.literal('work'),
  firstPublished: dateSchema.optional(),
  alternativeNames: z.array(z.string())
})
export const bookSchema = z.object({
  ...common,
  ...creativeWork,
  kind: z.literal('book'),
  format: z.enum(['audiobook', 'ebook']).optional(),
  publisher: z.string().optional(),
  published: dateSchema.optional(),
  durationSeconds: z.number().nonnegative().optional(),
  pageCount: z.number().int().positive().optional(),
  abridged: z.boolean().optional()
})
export const authorSchema = z.object({
  ...common,
  kind: z.literal('author'),
  image: z.string().optional(),
  sortName: z.string().optional(),
  birthDate: dateSchema.optional(),
  deathDate: dateSchema.optional(),
  alternativeNames: z.array(z.string())
})
export const seriesSchema = z.object({
  ...common,
  kind: z.literal('series'),
  image: z.string().optional(),
  totalBooks: z.number().int().nonnegative().optional()
})
export const chapterSchema = z
  .object({
    ...common,
    kind: z.literal('chapter'),
    sequence: z.number().int().nonnegative().optional(),
    startSeconds: z.number().nonnegative().optional(),
    endSeconds: z.number().nonnegative().optional(),
    timeline: z.enum(['book', 'file']).optional(),
    fileId: z.string().optional()
  })
  .refine(
    (chapter) =>
      chapter.endSeconds === undefined ||
      (chapter.startSeconds !== undefined && chapter.endSeconds >= chapter.startSeconds)
  )
export const metadataEntitySchema = z.discriminatedUnion('kind', [
  workSchema,
  bookSchema,
  authorSchema,
  seriesSchema,
  chapterSchema
])
export const metadataBundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    matches: z.array(z.string()),
    entities: z.array(metadataEntitySchema),
    complete: z.boolean()
  })
  .refine((bundle) => {
    const ids = new Set(bundle.entities.map((entity) => entity.id))
    return (
      ids.size === bundle.entities.length &&
      bundle.matches.every((id) => ids.has(id)) &&
      bundle.entities.every((entity) => entity.relations.every((relation) => ids.has(relation.targetId)))
    )
  }, 'Metadata bundle contains duplicate or missing entity references')

export type EntityKind = z.infer<typeof entityKindSchema>
export type Identifier = z.infer<typeof identifierSchema>
export type PublicationDate = z.infer<typeof dateSchema>
export type Rating = z.infer<typeof ratingSchema>
export type Contributor = z.infer<typeof contributorSchema>
export type MetadataSource = z.infer<typeof sourceSchema>
export type MetadataEntity = z.infer<typeof metadataEntitySchema>
export type MetadataBundle = z.infer<typeof metadataBundleSchema>
export type Work = z.infer<typeof workSchema>
export type Book = z.infer<typeof bookSchema>
export type Author = z.infer<typeof authorSchema>
export type Series = z.infer<typeof seriesSchema>
export type Chapter = z.infer<typeof chapterSchema>
