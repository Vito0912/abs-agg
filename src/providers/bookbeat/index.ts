import { z } from 'zod'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { BaseProvider } from '../BaseProvider'
import { searchBookBeatBooks } from './client'
import type { BookBeatBook } from './types'

export default class BookBeatProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const market = String(params.market)
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .parse(params.limit ?? 5)
    const books = await searchBookBeatBooks(title, market, params.includeErotic === 'true', limit)

    return books.map((bookData) => {
      const book = this.mapBookBeatToMetadata(bookData)
      if (book.cover && params.includeHighResCovers === 'true') {
        book.cover = book.cover.split('?')[0]
      }

      return book
    })
  }

  private mapBookBeatToMetadata(book: BookBeatBook): BookMetadata {
    return normalizeBookMetadata({
      title: book.title,
      bookId: String(book.id),
      format: book.audiobookisbn ? 'audiobook' : 'ebook',
      contributors: book._embedded?.contributors?.flatMap((person) => {
        if (person.role !== 'bb-author' && person.role !== 'bb-narrator') return []

        return [
          {
            name: person.displayname,
            role: person.role === 'bb-author' ? 'author' : 'narrator',
            sourceId: person.id === undefined ? undefined : String(person.id)
          }
        ]
      }),
      author: book.author || book._embedded?.contributors?.find((c) => c.role === 'bb-author')?.displayname,
      description: book.description ? book.description.replace(/<br\s*\/?>/gi, '\n') : undefined,
      cover: book.image,
      isbn: book.audiobookisbn || book.ebookisbn,
      series: book.series
        ? [
            {
              series: book.series.name,
              sequence: book.series.displaypartnumber,
              sourceId: book.series.id === undefined ? undefined : String(book.series.id)
            }
          ]
        : undefined,
      language: book.language,
      publishedYear: book.published ? book.published.slice(0, 4) : undefined,
      tags: book.contenttypetags || undefined
    })
  }
}
