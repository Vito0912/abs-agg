import type { BookMetadata, Contributor, MetadataBundle, MetadataEntity, SeriesMetadata } from '../types'
import { absBookSchema } from '../types/abs'
import type { AbsBook } from '../types/abs'
import { selectMetadataBundle } from './bundle'

type BookEntity = Extract<MetadataEntity, { kind: 'work' | 'book' }>

function contributorNames(contributors: Contributor[], role: Contributor['role']): string | undefined {
  const names = contributors.filter((person) => person.role === role).map((person) => person.name)
  return names.join(', ') || undefined
}

function seriesMemberships(entity: BookEntity, entities: Map<string, MetadataEntity>): SeriesMetadata[] {
  const memberships: SeriesMetadata[] = []
  for (const relation of entity.relations) {
    if (relation.type !== 'partOf') continue
    const series = entities.get(relation.targetId)
    if (series?.kind !== 'series') continue

    memberships.push({
      series: series.name,
      sequence: relation.sequence,
      sourceId: series.source.stable ? series.source.sourceId : undefined
    })
  }
  return memberships
}

function relatedWork(entity: BookEntity, entities: Map<string, MetadataEntity>): BookMetadata['work'] {
  const relation = entity.relations.find((entry) => entry.type === 'editionOf')
  if (!relation) return undefined
  const work = entities.get(relation.targetId)
  if (work?.kind !== 'work') return undefined

  return {
    id: work.source.sourceId,
    title: work.name,
    description: work.description,
    subtitle: work.subtitle,
    image: work.image,
    genres: work.genres,
    tags: work.tags,
    alternativeNames: work.alternativeNames,
    publishedYear: work.firstPublished?.value,
    ratings: work.ratings
  }
}

function relatedChapters(entity: BookEntity, entities: Map<string, MetadataEntity>): BookMetadata['chapters'] {
  const chapters: NonNullable<BookMetadata['chapters']> = []
  for (const chapter of entities.values()) {
    if (chapter.kind !== 'chapter') continue
    const belongsToBook = chapter.relations.some(
      (relation) => relation.type === 'chapterOf' && relation.targetId === entity.id
    )
    if (!belongsToBook) continue

    chapters.push({
      id: chapter.source.sourceId,
      title: chapter.name,
      sequence: chapter.sequence,
      startSeconds: chapter.startSeconds,
      endSeconds: chapter.endSeconds
    })
  }
  return chapters.sort((left, right) => (left.sequence || 0) - (right.sequence || 0))
}

function projectBook(entity: BookEntity, entities: Map<string, MetadataEntity>): BookMetadata {
  const published = entity.kind === 'work' ? entity.firstPublished : entity.published
  const asin = entity.identifiers.find((identifier) => identifier.scheme === 'asin')
  const durationSeconds = entity.kind === 'book' ? entity.durationSeconds : undefined

  return {
    title: entity.name,
    fetchedAt: entity.source.fetchedAt,
    subtitle: entity.subtitle,
    metadataKind: entity.kind,
    bookId: entity.source.sourceId,
    sourceUrl: entity.source.url,
    sourceIdStable: entity.source.stable,
    author: contributorNames(entity.contributors, 'author'),
    narrator: contributorNames(entity.contributors, 'narrator'),
    contributors: entity.contributors,
    authors: entity.contributors.flatMap((person) => {
      if (!person.authorId) return []
      const author = entities.get(person.authorId)
      if (author?.kind !== 'author') return []

      return [{ id: author.source.sourceId, name: author.name, description: author.description, image: author.image }]
    }),
    description: entity.description || relatedWork(entity, entities)?.description,
    cover: entity.image,
    isbn: entity.identifiers.find((identifier) => identifier.scheme === 'isbn')?.value,
    asin: asin?.value,
    marketplace: asin?.marketplace,
    publisher: entity.kind === 'work' ? undefined : entity.publisher,
    publishedYear: published?.value.slice(0, 4),
    publishedDate: published?.value,
    duration: durationSeconds === undefined ? undefined : durationSeconds / 60,
    durationSeconds,
    format: entity.kind === 'work' ? undefined : entity.format,
    language: entity.language,
    ratings: entity.ratings,
    genres: entity.genres,
    tags: entity.tags,
    quality: entity.source.quality,
    series: seriesMemberships(entity, entities),
    poweredBy: entity.source.provider,
    pageCount: entity.kind === 'book' ? entity.pageCount : undefined,
    abridged: entity.kind === 'work' ? undefined : entity.abridged,
    alternativeNames: entity.kind === 'work' ? entity.alternativeNames : undefined,
    work: relatedWork(entity, entities),
    chapters: relatedChapters(entity, entities)
  }
}

export function bundleBooks(bundle: MetadataBundle): BookMetadata[] {
  const entities = new Map(bundle.entities.map((entity) => [entity.id, entity]))
  const books: BookMetadata[] = []

  for (const id of bundle.matches) {
    const entity = entities.get(id)
    if (!entity || !('contributors' in entity)) continue
    books.push(projectBook(entity, entities))
  }
  return books
}

export function absMatches(bundle: MetadataBundle): AbsBook[] {
  const entities = new Map(bundle.entities.map((entity) => [entity.id, entity]))
  const matches: AbsBook[] = []

  for (const id of bundle.matches) {
    const entity = entities.get(id)
    if (!entity || !('contributors' in entity)) continue

    const book = projectBook(entity, entities)
    const duration = book.duration === undefined ? undefined : Math.round(book.duration)
    const metadata = selectMetadataBundle(bundle, [id])
    matches.push(absBookSchema.parse({ ...book, duration, metadata }))
  }

  return matches
}
