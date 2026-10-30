import type { Author, BookMetadata, Chapter, MetadataEntity, MetadataSource, Series, Work } from '../types'
import { authorSchema, chapterSchema, seriesSchema, workSchema } from '../types/metadata'
import { entityId, stableHash } from './identity'
import { publicationDate } from './dates'
import { sanitizeDescription } from './book'

function relatedFields(
  parent: MetadataEntity,
  kind: string,
  sourceId: string,
  name: string,
  stable: boolean,
  scope = parent.source.scope
) {
  const source: MetadataSource = { ...parent.source, sourceId, scope, stable, quality: 'summary', url: undefined }

  return {
    schemaVersion: 1,
    kind,
    id: entityId(source.provider, kind, sourceId, scope),
    name,
    language: parent.language,
    identifiers: [],
    relations: [],
    source,
    provenance: {}
  }
}

export function createRelatedWork(book: BookMetadata, parent: MetadataEntity): Work | undefined {
  if (!book.work || parent.kind === 'work') return undefined

  const fields = relatedFields(parent, 'work', book.work.id, book.work.title, true)
  const contributors = 'contributors' in parent ? parent.contributors : []
  const work = workSchema.parse({
    ...fields,
    description: sanitizeDescription(book.work.description),
    subtitle: book.work.subtitle,
    image: book.work.image,
    language: undefined,
    identifiers: [{ scheme: 'provider', namespace: parent.source.provider, value: book.work.id }],
    contributors: contributors.filter((person) => person.role === 'author'),
    genres: book.work.genres || [],
    tags: book.work.tags || [],
    ratings: book.work.ratings || [],
    firstPublished: publicationDate(book.work.publishedYear),
    alternativeNames: book.work.alternativeNames || []
  })

  parent.relations.push({ type: 'editionOf', targetId: work.id })
  return work
}

export function createRelatedAuthors(book: BookMetadata, parent: MetadataEntity): Author[] {
  if (!('contributors' in parent)) return []

  const authors: Author[] = []
  for (const contributor of parent.contributors) {
    if (contributor.authorId && !contributor.sourceId) continue

    const sourceId = contributor.sourceId || `name:${stableHash([parent.id, contributor.name])}`
    const scope = parent.source.scope
    const fields = relatedFields(parent, 'author', sourceId, contributor.name, Boolean(contributor.sourceId), scope)
    const details = book.authors?.find((author) => author.id === contributor.sourceId)
    const author = authorSchema.parse({
      ...fields,
      language: undefined,
      description: sanitizeDescription(details?.description),
      image: details?.image,
      source: { ...fields.source, quality: details ? 'detail' : 'summary' },
      identifiers: contributor.sourceId
        ? [{ scheme: 'provider', namespace: parent.source.provider, value: contributor.sourceId }]
        : [],
      alternativeNames: []
    })

    contributor.authorId = author.id
    authors.push(author)
  }
  return authors
}

export function createRelatedSeries(book: BookMetadata, parent: MetadataEntity): Series[] {
  const entities: Series[] = []
  for (const membership of book.series || []) {
    const sourceId = membership.sourceId || `name:${stableHash([parent.id, membership.series])}`
    const fields = relatedFields(parent, 'series', sourceId, membership.series, Boolean(membership.sourceId))
    const series = seriesSchema.parse(fields)

    parent.relations.push({
      type: 'partOf',
      targetId: series.id,
      sequence: membership.sequence,
      order: 'unspecified'
    })
    entities.push(series)
  }
  return entities
}

export function createRelatedChapters(book: BookMetadata, parent: MetadataEntity): Chapter[] {
  return (book.chapters || []).map((chapter, index) => {
    const sourceId = chapter.id || `${parent.source.sourceId}:chapter:${index}`
    const name = chapter.title || `Chapter ${index + 1}`
    const fields = relatedFields(parent, 'chapter', sourceId, name, Boolean(chapter.id))

    const result = chapterSchema.parse({
      ...fields,
      relations: [{ type: 'chapterOf', targetId: parent.id }],
      sequence: chapter.sequence ?? index + 1,
      startSeconds: chapter.startSeconds,
      endSeconds: chapter.endSeconds,
      timeline: chapter.startSeconds === undefined ? undefined : 'book'
    })

    parent.relations.push({ type: 'hasChapter', targetId: result.id })
    return result
  })
}
