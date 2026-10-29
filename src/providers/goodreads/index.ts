import { mapConcurrent } from '../../utils/concurrency'
import * as cheerio from 'cheerio'
import type { BookMetadata, ParsedParameters, ProviderConfig, Contributor, SeriesMetadata, Rating } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import type { GoodreadsSearchResult } from './types'

const GOODREADS_API_URL = 'https://www.goodreads.com'

const GENRE_SHELVES = new Set([
  'adventure',
  'art',
  'biography',
  'business',
  'chick-lit',
  'childrens',
  'christian',
  'classic',
  'comedy',
  'comic',
  'contemporary',
  'cookbook',
  'crime',
  'fantasy',
  'fiction',
  'gay-and-lesbian',
  'graphic-novel',
  'high-fantasy',
  'historical-fiction',
  'historical',
  'history',
  'horror',
  'humor-and-comedy',
  'humour',
  'manga',
  'memoir',
  'music',
  'mystery',
  'non-fiction',
  'nonfiction',
  'paranormal',
  'philosophy',
  'picture-book',
  'poetry',
  'politics',
  'psychology',
  'religion',
  'romance',
  'science-fiction',
  'science',
  'self-help',
  'spirituality',
  'sport',
  'suspense',
  'thriller',
  'travel',
  'young-adult'
])

export default class GoodreadsProvider extends BaseProvider {
  private apiKey: string

  constructor(config: ProviderConfig) {
    super(config)
    this.apiKey = process.env.GOODREADS_API_KEY || ''
  }

  async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = params.limit ? Number(params.limit) : 10

    const searchUrl = `${GOODREADS_API_URL}/search/index.xml?key=${encodeURIComponent(this.apiKey)}&q=${encodeURIComponent(title)}&search[field]=title`

    const response = await httpClient.get(searchUrl, {
      headers: { Accept: 'application/xml' },
      responseType: 'text'
    })

    if (response.status === 404) {
      return []
    }

    if (response.status !== 200) {
      throw new Error(`Goodreads API error: ${response.status}`)
    }

    const xmlData = typeof response.data === 'string' ? response.data : String(response.data)
    const searchResults = this.parseSearchResults(xmlData)

    if (searchResults.length === 0) {
      return []
    }

    let sortedResults = searchResults
    if (author) {
      sortedResults = this.sortByAuthorSimilarity(searchResults, author)
    }

    const bookIds = sortedResults.slice(0, limit).map((r) => r.id)
    const books = await this.fetchBookDetails(bookIds, params)

    return books
  }

  async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const bookUrl = `${GOODREADS_API_URL}/book/show.xml?key=${encodeURIComponent(this.apiKey)}&id=${encodeURIComponent(bookId)}`

    const response = await httpClient.get(bookUrl, {
      headers: { Accept: 'application/xml' },
      responseType: 'text'
    })

    if (response.status !== 200) {
      return null
    }

    const xmlData = typeof response.data === 'string' ? response.data : String(response.data)
    const metadata = this.parseBookDetails(xmlData)

    return metadata
  }

  private parseSearchResults(xmlData: string): GoodreadsSearchResult[] {
    const results: GoodreadsSearchResult[] = []
    const $ = cheerio.load(xmlData, { xml: true })

    $('GoodreadsResponse search results work').each((_, work) => {
      const $work = $(work)
      const $bestBook = $work.find('best_book')

      const id = $bestBook.children('id').first().text().trim()
      const title = $bestBook.children('title').first().text().trim()
      const authorName = $bestBook.find('author name').first().text().trim()
      const imageUrl = $bestBook.children('image_url').first().text().trim()

      if (id && title) {
        results.push({
          id,
          title,
          authorName,
          imageUrl: imageUrl && !imageUrl.includes('nophoto') ? imageUrl : undefined
        })
      }
    })

    return results
  }

  private sortByAuthorSimilarity(results: GoodreadsSearchResult[], author: string): GoodreadsSearchResult[] {
    const authorLower = author.toLowerCase()

    return [...results].sort((a, b) => {
      const aName = a.authorName.toLowerCase()
      const bName = b.authorName.toLowerCase()

      const aMatch = aName.includes(authorLower) || authorLower.includes(aName)
      const bMatch = bName.includes(authorLower) || authorLower.includes(bName)

      if (aMatch && !bMatch) return -1
      if (!aMatch && bMatch) return 1
      return 0
    })
  }

  private async fetchBookDetails(bookIds: string[], params: ParsedParameters): Promise<BookMetadata[]> {
    const books = await mapConcurrent(bookIds, 3, (id) => this.getBookById(id, params))

    return books.filter((book): book is BookMetadata => book !== null)
  }

  private parseBookDetails(xmlData: string): BookMetadata | null {
    const $ = cheerio.load(xmlData, { xml: true })
    const $book = $('GoodreadsResponse book').first()

    if ($book.length === 0) {
      return null
    }

    const fullTitle = $book.children('title').first().text().trim()
    const title = this.extractTitle(fullTitle)
    const subtitle = this.extractSubtitle(fullTitle)

    const authorName = $book.find('authors author').first().find('name').first().text().trim()

    const description = $book.children('description').first().text().trim()

    let imageUrl = $book.children('image_url').first().text().trim()
    if (imageUrl && imageUrl.includes('nophoto')) {
      imageUrl = ''
    }

    const isbn13 = $book.children('isbn13').first().text().trim()
    const publisher = $book.children('publisher').first().text().trim()
    const languageCode = $book.children('language_code').first().text().trim()

    const originalPubYear = $book.find('work original_publication_year').first().text().trim()
    const pubYear = $book.children('publication_year').first().text().trim()
    const publishedYear = pubYear

    return normalizeBookMetadata({
      title,
      bookId: $book.children('id').first().text().trim(),
      work: this.parseWork($, $book, title, originalPubYear),
      format: this.parseFormat($book.children('format').first().text()),
      subtitle: subtitle || undefined,
      contributors: this.parseContributors($, $book),
      author: authorName || undefined,
      description: description || undefined,
      cover: imageUrl || undefined,
      isbn: isbn13 || undefined,
      publisher: publisher || undefined,
      publishedYear: publishedYear || undefined,
      language: languageCode || undefined,
      series: this.parseSeries($, $book),
      genres: this.parseGenres($, $book)
    })
  }

  private parseWork(
    _$: cheerio.CheerioAPI,
    book: ReturnType<cheerio.CheerioAPI>,
    title: string,
    publishedYear: string
  ): BookMetadata['work'] {
    const id = book.find('work id').first().text().trim()
    if (!id) return undefined

    const value = Number(book.children('average_rating').text())
    const count = Number(book.children('ratings_count').text())
    const ratings: Rating[] = []

    if (value > 0 && value <= 5) {
      ratings.push({
        source: 'goodreads',
        value,
        minimum: 0,
        maximum: 5,
        aspect: 'overall',
        ratingCount: Number.isInteger(count) && count >= 0 ? count : undefined
      })
    }

    const originalTitle = book.find('work original_title').first().text().trim()

    return { id, title: originalTitle || title, publishedYear: publishedYear || undefined, ratings }
  }

  private parseContributors($: cheerio.CheerioAPI, book: ReturnType<cheerio.CheerioAPI>): Contributor[] {
    return book
      .find('authors author')
      .toArray()
      .flatMap((element) => {
        const author = $(element)
        const name = author.find('name').first().text().trim()
        const sourceId = author.children('id').first().text().trim()
        if (!name) return []

        return [{ name, role: 'author', sourceId: sourceId || undefined }]
      })
  }

  private parseSeries($: cheerio.CheerioAPI, book: ReturnType<cheerio.CheerioAPI>): SeriesMetadata[] {
    const series: SeriesMetadata[] = []

    book.find('series_works series_work').each((_, element) => {
      const membership = $(element)
      const name = membership.find('series title').first().text().trim()
      if (!name) return

      series.push({
        series: name,
        sourceId: membership.find('series id').first().text().trim() || undefined,
        sequence: membership.children('user_position').first().text().trim() || undefined
      })
    })

    return series
  }

  private parseGenres($: cheerio.CheerioAPI, book: ReturnType<cheerio.CheerioAPI>): string[] {
    const genres: string[] = []

    book.find('popular_shelves shelf').each((_, shelf) => {
      if (genres.length >= 3) return

      const name = $(shelf).attr('name')?.toLowerCase()
      if (!name || !GENRE_SHELVES.has(name)) return

      const label = name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      genres.push(label)
    })

    return genres
  }

  private parseFormat(value: string): 'audiobook' | 'ebook' | undefined {
    const format = value.trim().toLowerCase()

    if (['audible audio', 'audiobook', 'audio cd', 'mp3 cd', 'audio cassette'].includes(format)) return 'audiobook'
    if (['ebook', 'kindle edition', 'nook', 'ebook format'].includes(format)) return 'ebook'

    return undefined
  }

  private extractTitle(fullTitle: string): string {
    const titleParts = fullTitle.split(':')
    let title = titleParts[0].trim()
    title = title.replace(/\([^)]*#\d+(\.\d+)?\)$/, '').trim()
    return title
  }

  private extractSubtitle(fullTitle: string): string {
    const colonIdx = fullTitle.indexOf(':')
    if (colonIdx === -1) return ''

    let subtitle = fullTitle.slice(colonIdx + 1).trim()
    subtitle = subtitle.replace(/\([^)]*#\d+(\.\d+)?\)$/, '').trim()
    return subtitle
  }
}
