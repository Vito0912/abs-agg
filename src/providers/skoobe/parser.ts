import { load } from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { BookMetadata, Contributor, Rating } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { skoobeBookSchema, skoobeGraphSchema } from './schemas'
import type { SkoobeBook } from './types'

const origin = 'https://www.skoobe.de'

export function skoobeBookPath(href: string): string {
  const url = new URL(href, origin)
  if (url.origin !== origin || !/^\/books\/[^/]+\/[^/]+$/.test(url.pathname)) {
    throw new Error('Invalid Skoobe book URL')
  }

  return url.pathname
}

export function parseSkoobeSearch(html: string, limit: number): string[] {
  const $ = load(html)
  if (!$('.search-form').length) throw new Error('Skoobe search page is missing its search form')

  const paths = new Set<string>()
  for (const element of $('#booklist a.book-title').toArray()) {
    const href = $(element).attr('href')
    if (!href) throw new Error('Skoobe search result has no book URL')

    paths.add(skoobeBookPath(href))
    if (paths.size >= limit) break
  }

  if (!paths.size && !$('main').text().includes('Leider haben wir keine Ergebnisse gefunden.')) {
    throw new Error('Skoobe search page has no recognized results')
  }

  return [...paths]
}

function structuredBook($: CheerioAPI): SkoobeBook {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    const content = $(script).text().trim()
    if (!content) continue

    const graph = skoobeGraphSchema.parse(JSON.parse(content))
    const book = graph['@graph'].find((entry) => entry['@type'] === 'Book' || entry['@type'] === 'Audiobook')
    if (book) return skoobeBookSchema.parse(book)
  }

  throw new Error('Skoobe book page has no structured book metadata')
}

function durationSeconds(duration: string | undefined): number | undefined {
  if (!duration) return undefined

  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(duration)
  if (!match || !match.slice(1).some((part) => part !== undefined)) {
    throw new Error('Unsupported Skoobe audiobook duration')
  }

  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)

  return hours * 3600 + minutes * 60 + seconds
}

function bookContributors($: CheerioAPI, book: SkoobeBook): Contributor[] {
  const authors: Contributor[] = $('.author-container > .tags:not(.category) a')
    .toArray()
    .map((element) => ({
      name: $(element).text().trim(),
      sourceId: $(element).attr('href'),
      role: 'author'
    }))

  if (!authors.length) {
    for (const person of book.author || []) authors.push({ name: person.name, role: 'author' })
  }

  const narrators: Contributor[] = (book.readBy || []).map((person) => ({ name: person.name, role: 'narrator' }))

  return [...authors, ...narrators]
}

function bookRatings($: CheerioAPI): Rating[] {
  const rating = $('.book-description-container .rating')
  const valueText = rating.find('.schema').text().trim()
  const countMatch = /([\d.]+)\s+Bewertungen/.exec(rating.find('.stars').text())
  if (!valueText || !countMatch) return []

  const value = Number(valueText)
  const ratingCount = Number(countMatch[1].replace(/\./g, ''))
  if (!ratingCount) return []

  // JSON-LD rates written reviews separately from the book's displayed ratings.
  return [{ source: 'Skoobe', value, minimum: 1, maximum: 5, ratingCount, aspect: 'overall' }]
}

function coverUrl(source: string | undefined): string | undefined {
  if (!source) return undefined

  const url = new URL(source, origin)
  url.searchParams.set('size', '1000x1000')

  return url.toString()
}

export function parseSkoobeBook(html: string): BookMetadata {
  const $ = load(html)
  const book = structuredBook($)
  const bookId = $('#markBookForm input[name="book_id"]').val()
  if (typeof bookId !== 'string' || !bookId.trim()) throw new Error('Skoobe book page has no source ID')

  const contributors = bookContributors($, book)
  const description = $('.book-description-text .full').html() || book.description
  const format = book['@type'] === 'Audiobook' ? 'audiobook' : undefined
  const bookFormat = book.bookFormat === 'https://schema.org/EBook' ? 'ebook' : format

  return normalizeBookMetadata({
    title: book.name,
    subtitle: $('.author-container > h2').first().text().trim() || undefined,
    bookId,
    format: bookFormat,
    contributors,
    author: contributors
      .filter((person) => person.role === 'author')
      .map((person) => person.name)
      .join(', '),
    narrator: book.readBy?.map((person) => person.name).join(', '),
    description,
    cover: coverUrl($('.book-description-container .cover img').attr('src') || book.image),
    publisher: book.publisher?.name,
    publishedDate: book.datePublished,
    language: book.inLanguage,
    isbn: book.isbn,
    genres: book.genre,
    durationSeconds: bookFormat === 'audiobook' ? durationSeconds(book.duration) : undefined,
    pageCount: bookFormat === 'ebook' ? book.numberOfPages : undefined,
    ratings: bookRatings($),
    poweredBy: 'Skoobe'
  })
}
