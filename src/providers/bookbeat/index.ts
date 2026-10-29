import { z } from 'zod'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { resolveProviderUrl } from '../../utils/outboundPolicy'
import { BaseProvider } from '../BaseProvider'
import { bookBeatBookSchema, bookBeatSuggestSchema } from './schemas'
import type { BookBeatBook, BookBeatSuggest } from './types'

export default class BookBeatProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const market = String(params.market)
    const includeErotic = params.includeErotic === 'true' ? 'true' : 'false'
    const includeHighResCovers = params.includeHighResCovers === 'true' ? 'true' : 'false'
    const suggestUrl = `https://search-api.bookbeat.com/api/appsearch/suggest?includeErotic=${includeErotic}&market=${encodeURIComponent(market)}&query=${encodeURIComponent(title)}&v=18`

    let suggestions: BookBeatSuggest[] = []
    const suggestRes = await httpClient.get(suggestUrl)
    if (suggestRes.status !== 200) throw new Error('BookBeat suggest API error')
    const suggestJson = z.object({ suggestions: bookBeatSuggestSchema.array() }).parse(suggestRes.data)
    suggestions = (suggestJson.suggestions || []).filter((s) => s.id && s.id.includes('BookTitle'))

    const books: BookMetadata[] = []
    for (const suggestion of suggestions.slice(0, 3)) {
      const bookUrl = resolveProviderUrl(suggestion._links.search.href, 'https://search-api.bookbeat.com')
      if (new URL(bookUrl).pathname !== '/api/appsearch/books') throw new Error('Invalid BookBeat detail path')
      const metadata = await this.cachedBook(suggestion.id, params, async () => {
        const bookRes = await httpClient.get(bookUrl)
        if (bookRes.status !== 200) throw new Error(`BookBeat details error: ${bookRes.status}`)

        const envelope = z.object({ _embedded: z.object({ books: bookBeatBookSchema.array() }) }).parse(bookRes.data)
        const suggestedId = Number(suggestion.id.replace('BookTitle_', ''))
        const bookData = envelope._embedded.books.find((book) => book.id === suggestedId)
        if (!bookData) return null

        const book = this.mapBookBeatToMetadata(bookData)
        if (book.cover && includeHighResCovers === 'true') {
          book.cover = book.cover.split('?')[0]
        }

        return book
      })

      if (metadata) books.push(metadata)
    }

    return books
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
