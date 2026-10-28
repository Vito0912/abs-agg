import type { BookMetadata, Contributor, MetadataBundle, Rating } from '../../types'
import { authorSchema, seriesSchema } from '../../types/metadata'
import { entityId } from '../../metadata/identity'
import { normalizeBooks } from '../../metadata/normalize'
import { sanitizeDescription } from '../../metadata/book'
import type { SoundboothCatalog, SoundboothMappingContext, SoundboothItem } from './types'

const roles: Record<string, Contributor['role']> = {
  author: 'author',
  narrator: 'narrator',
  featuring: 'performer',
  music: 'composer'
}

function mapContributors(item: SoundboothItem, catalog: SoundboothMappingContext): Contributor[] {
  const contributors = new Map<string, Contributor>()
  for (const credit of item.cast || []) {
    const role = roles[credit.type]
    const person = catalog.contributors.get(credit.teamMember)
    if (!person || !role) continue

    contributors.set(`${person._id}:${role}`, { sourceId: person._id, name: person.name, role })
  }

  return [...contributors.values()]
}

function mapRatings(item: SoundboothItem): Rating[] {
  const ratings: Rating[] = []
  const values: { value: number | null | undefined; aspect: Rating['aspect'] }[] = [
    { value: item.averageRating, aspect: 'overall' },
    { value: item.averagePlot, aspect: 'story' },
    { value: item.averagePerformance, aspect: 'performance' }
  ]

  for (const { value, aspect } of values) {
    if (value == null) continue
    ratings.push({
      source: 'Soundbooth Theater',
      value,
      aspect,
      minimum: 1,
      maximum: 5,
      reviewCount: item.totalReviews ?? undefined
    })
  }

  return ratings
}

export function mapSoundboothBook(item: SoundboothItem, catalog: SoundboothMappingContext): BookMetadata {
  const contributors = mapContributors(item, catalog)
  const series = item.seriesId ? catalog.series.get(item.seriesId) : undefined
  const image = item.displayOptions.image?.attachment
  const language = item.language?.trim().toLowerCase()

  return {
    bookId: item._id,
    title: item.name,
    description: item.description || undefined,
    fetchedAt: catalog.fetchedAt,
    format: 'audiobook',
    cover: image?.url1024Jpg || image?.url || undefined,
    isbn: item.isbn13 || undefined,
    publishedDate: (item.originalReleaseAt || item.releaseAt)?.slice(0, 10),
    language: language && ['en', 'eng', 'english', 'engl'].includes(language) ? 'en' : undefined,
    durationSeconds: item.totalDuration || undefined,
    genres: item.genres.map((genre) => genre.name),
    tags: item.tags || undefined,
    contributors,
    authors: contributors.flatMap((credit) => {
      const person = credit.sourceId ? catalog.contributors.get(credit.sourceId) : undefined
      if (!person) return []

      return [
        {
          id: person._id,
          name: person.name,
          description: person.biography || undefined,
          image: person.image?.attachment?.url || undefined
        }
      ]
    }),
    series: series ? [{ series: series.name, sourceId: series._id }] : undefined,
    ratings: mapRatings(item),
    poweredBy: 'Soundbooth Theater'
  }
}

function normalizeSoundboothBooks(items: SoundboothItem[], catalog: SoundboothMappingContext): MetadataBundle {
  const books = items.map((item) => mapSoundboothBook(item, catalog))
  const bundle = normalizeBooks(books, 'soundbooththeater', {})

  for (const entity of bundle.entities) {
    if (entity.kind !== 'series') continue
    const series = catalog.series.get(entity.source.sourceId)
    if (!series) continue

    const image = series.displayOptions.imageSquare?.attachment || series.displayOptions.image?.attachment
    entity.description = sanitizeDescription(series.description || undefined)
    entity.image = image?.url1024Jpg || image?.url || undefined
    entity.source.quality = 'detail'
  }

  return bundle
}

function independentEntity(kind: 'author' | 'series', sourceId: string, name: string, fetchedAt: number) {
  return {
    schemaVersion: 1,
    id: entityId('soundbooththeater', kind, sourceId, '[]'),
    kind,
    name,
    identifiers: [{ scheme: 'provider', namespace: 'soundbooththeater', value: sourceId }],
    relations: [],
    provenance: {},
    source: { provider: 'soundbooththeater', sourceId, scope: '[]', stable: true, fetchedAt, quality: 'detail' }
  }
}

export function normalizeSoundboothCatalog(catalog: SoundboothCatalog): MetadataBundle {
  const context: SoundboothMappingContext = {
    fetchedAt: catalog.fetchedAt,
    contributors: new Map(catalog.contributors.map((person) => [person._id, person])),
    series: new Map(catalog.series.map((series) => [series._id, series]))
  }
  const items = catalog.items.filter((item) => {
    return !item.isArchived && item.status === 'published' && (item.type === 'book' || item.type === 'episode')
  })
  const bundle = normalizeSoundboothBooks(items, context)
  const entities = new Map(bundle.entities.map((entity) => [entity.id, entity]))

  for (const person of context.contributors.values()) {
    const author = authorSchema.parse({
      ...independentEntity('author', person._id, person.name, catalog.fetchedAt),
      description: sanitizeDescription(person.biography || undefined),
      image: person.image?.attachment?.url || undefined,
      alternativeNames: []
    })
    entities.set(author.id, author)
  }

  for (const entry of context.series.values()) {
    if (entry.isArchived || entry.status !== 'published') continue
    const image = entry.displayOptions.imageSquare?.attachment || entry.displayOptions.image?.attachment
    const series = seriesSchema.parse({
      ...independentEntity('series', entry._id, entry.name, catalog.fetchedAt),
      description: sanitizeDescription(entry.description || undefined),
      image: image?.url1024Jpg || image?.url || undefined
    })
    entities.set(series.id, series)
  }

  return { ...bundle, entities: [...entities.values()] }
}
