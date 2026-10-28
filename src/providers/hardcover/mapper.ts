import type { BookMetadata, Contributor, Rating, SeriesMetadata } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import type { HardcoverBook, HardcoverEdition } from './types'

function workContributors(book: HardcoverBook): Contributor[] {
  const contributors: Contributor[] = []

  for (const contribution of book.contributions || []) {
    const name = contribution.author?.name
    if (!name) continue

    const role = (contribution.contribution || '').toLowerCase()
    if (role.includes('narrator') || role.includes('read by')) continue

    contributors.push({
      name,
      role: role.includes('translat') ? 'translator' : 'author',
      sourceId: contribution.author?.id === undefined ? undefined : String(contribution.author.id)
    })
  }

  return contributors
}

function bookSeries(book: HardcoverBook): SeriesMetadata[] {
  const memberships: SeriesMetadata[] = []

  for (const entry of book.book_series || []) {
    if (!entry.series?.name) continue

    memberships.push({
      series: entry.series.name,
      sourceId: entry.series.id === undefined ? undefined : String(entry.series.id),
      sequence: entry.position === undefined ? undefined : String(entry.position)
    })
  }

  return memberships
}

function workRatings(book: HardcoverBook): Rating[] {
  if (book.rating === undefined) return []

  return [
    {
      source: 'hardcover',
      value: book.rating,
      minimum: 0,
      maximum: 5,
      aspect: 'overall',
      ratingCount: book.ratings_count
    }
  ]
}

function mapEdition(book: HardcoverBook, edition: HardcoverEdition, format: 'audiobook' | 'ebook'): BookMetadata {
  return normalizeBookMetadata({
    title: edition.title || book.title,
    subtitle: edition.subtitle || book.subtitle,
    bookId: String(edition.id),
    format,
    contributors: workContributors(book),
    description: edition.description,
    cover: edition.image?.url,
    isbn: edition.isbn_13 || edition.isbn_10,
    asin: edition.asin,
    publisher: edition.publisher?.name,
    publishedDate: edition.release_date,
    publishedYear: edition.release_year,
    language: edition.language?.language,
    durationSeconds: format === 'audiobook' ? edition.audio_seconds : undefined,
    pageCount: format === 'ebook' ? edition.pages : undefined,
    series: bookSeries(book),
    work: {
      id: String(book.id),
      title: book.title || edition.title || '',
      description: book.description,
      subtitle: book.subtitle,
      image: book.image?.url,
      alternativeNames: book.alternative_titles,
      tags: book.taggings?.flatMap((entry) => (entry.tag?.tag ? [entry.tag.tag] : [])),
      publishedYear: book.release_year === undefined ? undefined : String(book.release_year),
      ratings: workRatings(book)
    }
  })
}

export function mapHardcoverBook(book: HardcoverBook): BookMetadata[] {
  if (!book.id || !book.title) return []

  const editions: BookMetadata[] = []
  if (book.default_audio_edition?.id) {
    editions.push(mapEdition(book, book.default_audio_edition, 'audiobook'))
  }
  for (const edition of book.editions || []) {
    if (edition.id && edition.reading_format_id === 4) {
      editions.push(mapEdition(book, edition, 'ebook'))
    }
  }

  if (editions.length > 0) return editions

  return [
    normalizeBookMetadata({
      title: book.title,
      subtitle: book.subtitle,
      bookId: String(book.id),
      metadataKind: 'work',
      description: book.description,
      cover: book.image?.url,
      publishedYear: book.release_year,
      contributors: workContributors(book),
      series: bookSeries(book),
      ratings: workRatings(book),
      alternativeNames: book.alternative_titles,
      tags: book.taggings?.flatMap((entry) => (entry.tag?.tag ? [entry.tag.tag] : []))
    })
  ]
}
