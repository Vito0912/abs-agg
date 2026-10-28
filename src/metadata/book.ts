import type { BookMetadata, Contributor, MetadataEntity, MetadataSource } from '../types'
import { metadataEntitySchema } from '../types/metadata'
import { bookIdentifiers, entityId, normalizeLanguage, stableHash } from './identity'
import { publicationDate } from './dates'
import { htmlSanitizer } from '../utils/sanitizer'

export function createSource(book: BookMetadata, provider: string, scope: string): MetadataSource {
  const sourceId = book.bookId || `unresolved:${stableHash([book.title, book.author, book.isbn, book.asin])}`

  let url: string | undefined
  if (/^https?:\/\//.test(sourceId)) url = sourceId

  return {
    provider,
    sourceId,
    scope,
    stable: Boolean(book.bookId),
    fetchedAt: book.fetchedAt ?? Date.now(),
    url,
    quality: book.quality || 'detail'
  }
}

export function bookContributors(book: BookMetadata): Contributor[] {
  if (book.contributors) return book.contributors.map((contributor) => ({ ...contributor }))

  const contributors: Contributor[] = []
  if (book.author) contributors.push({ name: book.author, role: 'author' })
  if (book.narrator) contributors.push({ name: book.narrator, role: 'narrator' })
  return contributors
}

export function sanitizeDescription(value: string | undefined): string | undefined {
  if (!value) return undefined
  return htmlSanitizer.sanitize(value).trim() || undefined
}

export function createBookEntity(book: BookMetadata, source: MetadataSource): MetadataEntity {
  const kind = book.metadataKind || 'book'
  const identifiers = bookIdentifiers(book.isbn, book.asin, book.marketplace)
  identifiers.push({ scheme: 'provider', namespace: source.provider, value: source.sourceId })

  const common = {
    schemaVersion: 1,
    id: entityId(source.provider, kind, source.sourceId, source.scope),
    name: book.title.trim(),
    subtitle: book.subtitle,
    description: sanitizeDescription(book.description),
    language: normalizeLanguage(book.language),
    image: book.cover,
    identifiers,
    contributors: bookContributors(book),
    relations: [],
    genres: [...new Set(book.genres || [])],
    tags: [...new Set(book.tags || [])],
    ratings: book.ratings || [],
    source,
    provenance: {}
  }

  if (kind === 'work') {
    return metadataEntitySchema.parse({
      ...common,
      kind,
      firstPublished: publicationDate(book.publishedYear),
      alternativeNames: book.alternativeNames || []
    })
  }

  return metadataEntitySchema.parse({
    ...common,
    kind,
    format: book.format,
    publisher: book.publisher,
    published: publicationDate(book.publishedDate || book.publishedYear),
    abridged: book.abridged,
    pageCount: book.pageCount,
    durationSeconds: book.durationSeconds ?? minutesToSeconds(book.duration)
  })
}

function minutesToSeconds(durationMinutes: number | undefined): number | undefined {
  if (durationMinutes === undefined) return undefined

  return durationMinutes * 60
}
