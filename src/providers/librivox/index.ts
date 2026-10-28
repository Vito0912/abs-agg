import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { librivoxApiResponseSchema } from './schemas'
import type { LibrivoxApiResponse, LibrivoxBook } from './types'

export default class LibrivoxProvider extends BaseProvider {
  private readonly baseUrl = 'https://librivox.org/api/feed/audiobooks'

  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const genre = typeof params.genre === 'string' ? params.genre : undefined
    const limit = params.limit ? Number(params.limit) : 10
    const authorTerm = author?.trim()
    const searchAuthor = authorTerm?.replace(/^\^/, '').split(/\s+/).pop()
    const pageSize = 50

    const searchParams = new URLSearchParams({
      format: 'json',
      extended: '1',
      coverart: '1',
      limit: String(pageSize)
    })

    if (searchAuthor) {
      searchParams.set('author', `^${searchAuthor}`)
    } else if (title.trim()) {
      searchParams.set('title', title.trim().startsWith('^') ? title.trim() : `^${title.trim()}`)
    } else if (genre) {
      searchParams.set('genre', genre)
    }

    const matches: BookMetadata[] = []
    for (let offset = 0; matches.length < limit && offset < 500; offset += pageSize) {
      searchParams.set('offset', String(offset))
      const response = await httpClient.get<LibrivoxApiResponse>(`${this.baseUrl}?${searchParams.toString()}`)

      if (response.status === 404) break
      if (response.status !== 200) {
        throw new Error(`LibriVox API error: ${response.status}`)
      }

      const books = librivoxApiResponseSchema.parse(response.data).books || []
      for (const book of books) {
        if (title.trim() && !this.matchesTerm(book.title, title)) continue
        if (
          authorTerm &&
          !book.authors?.some(
            (a) =>
              this.matchesTerm(`${a.first_name} ${a.last_name}`.trim(), authorTerm) ||
              this.matchesTerm(a.last_name, authorTerm)
          )
        ) {
          continue
        }
        if (genre && !book.genres?.some((g) => this.matchesTerm(g.name, genre))) continue
        matches.push(this.mapLibrivoxToMetadata(book))
        if (matches.length === limit) break
      }

      if (books.length < pageSize || matches.length === limit) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    return matches
  }

  private matchesTerm(value: string, term: string): boolean {
    const normalizedValue = value.toLocaleLowerCase()
    const normalizedTerm = term.trim().toLocaleLowerCase()
    return normalizedTerm.startsWith('^')
      ? normalizedValue.startsWith(normalizedTerm.slice(1))
      : normalizedValue.includes(normalizedTerm)
  }

  async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const bookUrl = `${this.baseUrl}?id=${encodeURIComponent(bookId)}&format=json&extended=1&coverart=1`

    const response = await httpClient.get<LibrivoxApiResponse>(bookUrl)

    if (response.status === 404) return null
    if (response.status !== 200) throw new Error(`LibriVox details error: ${response.status}`)

    const books = librivoxApiResponseSchema.parse(response.data).books || []
    const book = books[0]
    if (!book) return null

    return this.mapLibrivoxToMetadata(book)
  }

  private mapLibrivoxToMetadata(book: LibrivoxBook): BookMetadata {
    const authorNames = book.authors
      ?.map((a) => `${a.first_name} ${a.last_name}`.trim())
      .filter((name) => name.length > 0)

    const readers = new Set<string>()
    book.sections?.forEach((section) => {
      section.readers?.forEach((reader) => {
        if (reader.display_name) {
          readers.add(reader.display_name)
        }
      })
    })
    const narratorList = Array.from(readers)

    const genres = book.genres?.map((g) => g.name).filter((name) => name && name.length > 0)

    const duration = book.totaltimesecs !== undefined ? Number(book.totaltimesecs) : undefined

    const cover = book.coverart_jpg || book.coverart_thumbnail

    return {
      ...normalizeBookMetadata({
        title: book.title,
        author: authorNames?.join(', '),
        narrator: narratorList.length > 0 ? narratorList.join(', ') : undefined,
        description: book.description,
        cover: cover,
        genres: genres,
        language: book.language,
        durationSeconds: duration,
        format: 'audiobook',
        contributors: [
          ...(book.authors || []).map((author) => ({
            name: `${author.first_name} ${author.last_name}`.trim(),
            role: 'author',
            sourceId: author.id
          })),
          ...narratorList.map((name) => ({ name, role: 'narrator' }))
        ],
        chapters: book.sections?.map((section, index) => ({
          id: section.id,
          title: section.title,
          sequence: index + 1
        })),
        publishedYear: book.copyright_year
      }),
      bookId: book.id
    }
  }
}
