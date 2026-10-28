import type { BookMetadata, Contributor, Rating, SeriesMetadata } from '../../types'
import type { OverdriveFormat, OverdriveItem } from './types'

const roles: Record<string, Contributor['role']> = {
  Author: 'author',
  Narrator: 'narrator',
  Translator: 'translator',
  Editor: 'editor',
  Illustrator: 'illustrator',
  Performer: 'performer',
  Composer: 'composer',
  Adapter: 'adapter'
}

function selectFormat(item: OverdriveItem): OverdriveFormat | undefined {
  const preferred = item.formats.find((format) => format.id === `${item.type.id}-overdrive`)
  if (preferred) return preferred

  return item.formats.find((format) => format.id.startsWith(`${item.type.id}-`))
}

function durationSeconds(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const match = /^(\d{1,4}):([0-5]\d):([0-5]\d(?:\.\d+)?)$/.exec(value)
  if (!match) throw new Error('Unsupported OverDrive audiobook duration')

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])

  return hours * 3600 + minutes * 60 + seconds
}

function contributors(item: OverdriveItem): Contributor[] {
  const people: Contributor[] = []
  for (const creator of item.creators || []) {
    const role = roles[creator.role]
    if (!role) continue

    people.push({ sourceId: creator.id, name: creator.name, role })
  }

  return people
}

function coverUrl(item: OverdriveItem): string | undefined {
  const covers = Object.values(item.covers || {}).filter((cover) => !cover.isPlaceholderImage)
  covers.sort((left, right) => (right.width || 0) - (left.width || 0))

  return covers[0]?.href
}

function seriesMembership(item: OverdriveItem): SeriesMetadata[] | undefined {
  const name = item.detailedSeries?.seriesName || item.series
  if (!name?.trim()) return undefined

  return [
    {
      series: name,
      sourceId: item.detailedSeries?.seriesId,
      sequence: item.detailedSeries?.rank?.toString()
    }
  ]
}

function ratings(item: OverdriveItem): Rating[] | undefined {
  const value = item.starRating
  const ratingCount = item.starRatingCount
  if (value == null || value <= 0 || !ratingCount) return undefined

  return [{ source: 'OverDrive', value, minimum: 1, maximum: 5, ratingCount, aspect: 'overall' }]
}

export function mapOverdriveBook(item: OverdriveItem): BookMetadata | undefined {
  if (item.type.id !== 'audiobook' && item.type.id !== 'ebook') return undefined
  const format = selectFormat(item)
  if (!format) return undefined

  const language = item.languages?.length === 1 ? item.languages[0].id : undefined
  const edition = item.edition?.toLowerCase()
  let abridged: boolean | undefined
  if (edition === 'unabridged') abridged = false
  if (edition === 'abridged') abridged = true

  return {
    bookId: item.reserveId.toLowerCase(),
    title: item.title,
    subtitle: item.subtitle || undefined,
    format: item.type.id,
    contributors: contributors(item),
    description: item.description || undefined,
    publisher: item.publisher?.name,
    publishedDate: item.publishDate?.slice(0, 10),
    language,
    cover: coverUrl(item),
    isbn: format.isbn || format.identifiers?.find((identifier) => identifier.type === 'ISBN')?.value,
    durationSeconds: item.type.id === 'audiobook' ? durationSeconds(format.duration) : undefined,
    series: seriesMembership(item),
    genres: item.subjects?.map((subject) => subject.name),
    abridged,
    ratings: ratings(item),
    poweredBy: 'OverDrive'
  }
}
