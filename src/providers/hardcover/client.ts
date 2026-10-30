import { HardcoverClient as HardcoverSdkClient, ReadingFormat } from '@hardcover/sdk'
import type { Book, BookHit, Edition } from '@hardcover/sdk'
import { hardcoverBookSchema } from './schemas'
import type { HardcoverBook } from './types'

export class HardcoverClient {
  private readonly client: HardcoverSdkClient

  constructor(token: string) {
    this.client = new HardcoverSdkClient({
      token,
      userAgent: 'abs-agg/1.1.0',
      timeoutMs: 15000,
      maxRetries: 2,
      batch: true
    })
  }

  async searchBooks(title: string, author: string | null, limit: number): Promise<BookHit[]> {
    const query = author ? `${title} ${author}` : title
    const results = await this.client.search.books(query, { perPage: limit, page: 1 })

    return results.hits.filter((book) => Number.isSafeInteger(book.id) && book.id > 0)
  }

  async books(id: number, searchHit: BookHit): Promise<HardcoverBook[]> {
    const [book, editions] = await Promise.all([
      this.client.books.get(id),
      this.client.books.editions(id, { limit: 10 })
    ])
    if (!book) return []

    const audioEdition = editions.items.find((edition) => edition.readingFormatId === ReadingFormat.Audiobook)
    const ebookEditions = editions.items.filter((edition) => edition.readingFormatId === ReadingFormat.Ebook)
    const adaptedBook = hardcoverBookSchema.parse(adaptBook(book, searchHit, audioEdition, ebookEditions))

    return [adaptedBook]
  }
}

function adaptBook(book: Book, searchHit: BookHit, audioEdition: Edition | undefined, ebookEditions: Edition[]) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title || searchHit.title,
    subtitle: book.subtitle,
    description: book.description,
    release_year: book.releaseYear,
    release_date: book.releaseDate,
    pages: book.pages,
    audio_seconds: book.audioSeconds,
    rating: book.rating,
    ratings_count: book.ratingsCount,
    headline: book.headline,
    alternative_titles: searchHit.alternativeTitles,
    image: { url: book.cachedImage.url },
    contributions: book.contributions.map((contribution) => ({
      author: contribution.author,
      contribution: contribution.contribution
    })),
    book_series: book.bookSeries.map((entry) => ({
      series: entry.series,
      position: entry.position
    })),
    taggings: Object.values(book.cachedTags).flatMap((tags) => {
      return tags?.map((tag) => ({ tag: { tag: tag.tag } })) ?? []
    }),
    default_audio_edition: audioEdition ? adaptEdition(audioEdition) : undefined,
    editions: ebookEditions.map(adaptEdition)
  }
}

function adaptEdition(edition: Edition) {
  return {
    id: edition.id,
    title: edition.title,
    subtitle: edition.subtitle,
    isbn_10: edition.isbn10,
    isbn_13: edition.isbn13,
    asin: edition.asin,
    pages: edition.pages,
    audio_seconds: edition.audioSeconds,
    release_date: edition.releaseDate,
    release_year: edition.releaseYear,
    reading_format_id: edition.readingFormatId,
    publisher: edition.publisher,
    language: edition.language ? { language: edition.language.language } : undefined,
    image: { url: edition.cachedImage.url }
  }
}
