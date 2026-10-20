import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { dbManager } from '../../database/manager'
import { httpClient } from '../../utils/httpClient'
import path from 'path'
import fs from 'fs'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

interface LibrivoxAuthor {
  id: string
  first_name: string
  last_name: string
  dob?: string
  dod?: string
}

interface LibrivoxSection {
  id: string
  section_number: string
  title: string
  listen_url: string
  language: string
  playtime: string
  file_name?: string
  readers?: Array<{
    reader_id: string
    display_name: string
  }>
}

interface LibrivoxGenre {
  id: string
  name: string
}

interface LibrivoxBook {
  id: string
  title: string
  description?: string
  url_text_source?: string
  language?: string
  copyright_year?: string
  num_sections?: string
  url_rss?: string
  url_zip_file?: string
  url_project?: string
  url_librivox?: string
  url_iarchive?: string
  url_other?: string
  totaltime?: string
  totaltimesecs?: string | number
  authors?: LibrivoxAuthor[]
  coverart_jpg?: string
  coverart_pdf?: string
  coverart_thumbnail?: string
  sections?: LibrivoxSection[]
  genres?: LibrivoxGenre[]
  translators?: LibrivoxAuthor[]
}

interface LibrivoxApiResponse {
  books?: LibrivoxBook[]
}

export default class LibrivoxProvider extends BaseProvider {
  private readonly baseUrl = 'https://librivox.org/api/feed/audiobooks'

  constructor() {
    super(config)
  }

  async search(
    title: string,
    author: string | null,
    params: ParsedParameters,
    _options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const genre = params.genre as string | undefined
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
    for (let offset = 0; matches.length < limit; offset += pageSize) {
      searchParams.set('offset', String(offset))
      const response = await httpClient.get<LibrivoxApiResponse>(`${this.baseUrl}?${searchParams.toString()}`)

      if (response.status === 404) break
      if (response.status !== 200) {
        throw new Error(`LibriVox API error: ${response.status}`)
      }

      const books = response.data.books || []
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

  async getBookById(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const bookUrl = `${this.baseUrl}?id=${encodeURIComponent(bookId)}&format=json&extended=1&coverart=1`

    const cachedBook = dbManager.getBookCache(this.config.id, bookUrl)
    if (cachedBook) {
      try {
        const cached = JSON.parse(cachedBook) as LibrivoxBook
        return this.mapLibrivoxToMetadata(cached)
      } catch {}
    }

    const response = await httpClient.get<LibrivoxApiResponse>(bookUrl)

    if (response.status !== 200 || !response.data.books || response.data.books.length === 0) {
      return null
    }

    const book = response.data.books[0]

    dbManager.setBookCache(this.config.id, bookUrl, JSON.stringify(book))

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
        duration: duration,
        publishedYear: book.copyright_year
      }),
      bookId: book.id
    }
  }
}
