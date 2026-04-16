import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import path from 'path'
import fs from 'fs'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const CACHE_DIR = path.join(process.cwd(), 'data')
const CACHE_FILE = path.join(CACHE_DIR, 'gawayback_catalog.json')
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const CATALOG_URL = 'https://raw.githubusercontent.com/binyaminyblatt/graphicaudio_scraper/refs/heads/main/wayback_results.json'

interface GraphicAudioBook {
  link?: string
  cover?: string
  seriesName?: string
  title?: string
  rawtitle?: string
  episodeNumber?: number
  episodePart?: string
  episodeCode?: string
  totalParts?: string
  subtitle?: string
  author?: string
  releaseDate?: string
  isbn?: string
  genre?: string
  description?: string
  copyright?: string
  cast?: string[]
  asin?: string
}

export default class GraphicAudioWaybackProvider extends BaseProvider {
  private catalog: GraphicAudioBook[] | null = null
  private catalogLoadedAt: number = 0

  constructor() {
    super(config)
  }

  private async loadCatalog(): Promise<GraphicAudioBook[]> {
    const now = Date.now()

    if (this.catalog && now - this.catalogLoadedAt < CACHE_MAX_AGE_MS) {
      return this.catalog
    }

    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }

    let needsDownload = true
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE)
      const fileAge = now - stats.mtimeMs
      if (fileAge < CACHE_MAX_AGE_MS) {
        needsDownload = false
      }
    }

    if (needsDownload) {
      const response = await httpClient.get(CATALOG_URL, {
        headers: { Accept: 'application/json' },
        responseType: 'text'
      })

      if (response.status !== 200) {
        if (fs.existsSync(CACHE_FILE)) {
          const cachedData = fs.readFileSync(CACHE_FILE, 'utf-8')
          this.catalog = this.parseAndValidateCatalog(cachedData)
          this.catalogLoadedAt = now
          return this.catalog
        }
        throw new Error(`Failed to download Graphic Audio catalog: ${response.status}`)
      }

      const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      this.catalog = this.parseAndValidateCatalog(rawData)
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.catalog), 'utf-8')
      this.catalogLoadedAt = now
      return this.catalog
    }

    const cachedData = fs.readFileSync(CACHE_FILE, 'utf-8')
    this.catalog = this.parseAndValidateCatalog(cachedData)
    this.catalogLoadedAt = now
    return this.catalog
  }

  private parseAndValidateCatalog(data: string): GraphicAudioBook[] {
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      throw new Error('Invalid JSON in Graphic Audio catalog')
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Graphic Audio catalog is not an array')
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => this.sanitizeBook(item))
  }

  private sanitizeBook(item: Record<string, unknown>): GraphicAudioBook {
    return {
      link: this.sanitizeString(item.link),
      cover: this.sanitizeString(item.cover),
      seriesName: this.sanitizeString(item.seriesName),
      title: this.sanitizeString(item.title),
      rawtitle: this.sanitizeString(item.rawtitle),
      episodeNumber: typeof item.episodeNumber === 'number' ? item.episodeNumber : undefined,
      episodePart: this.sanitizeString(item.episodePart),
      episodeCode: this.sanitizeString(item.episodeCode),
      totalParts: this.sanitizeString(item.totalParts),
      subtitle: this.sanitizeString(item.subtitle),
      author: this.sanitizeString(item.author),
      releaseDate: this.sanitizeString(item.releaseDate),
      isbn: this.sanitizeString(item.isbn),
      genre: this.sanitizeString(item.genre),
      description: this.sanitizeString(item.description),
      copyright: this.sanitizeString(item.copyright),
      cast: Array.isArray(item.cast) ? item.cast.filter((c): c is string => typeof c === 'string') : undefined,
      asin: this.sanitizeString(item.asin)
    }
  }

  private sanitizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    return value.trim() || undefined
  }

  async search(
    title: string,
    author: string | null,
    params: ParsedParameters,
    _options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = params.limit ? Number(params.limit) : 10
    const catalog = await this.loadCatalog()

    const titleLower = title.toLowerCase()
    const authorLower = author?.toLowerCase()

    const matches = catalog.filter((book) => {
      if (!book.title) return false

      const bookTitle = book.title.toLowerCase()
      const bookRawTitle = book.rawtitle?.toLowerCase() || ''
      const bookSeries = book.seriesName?.toLowerCase() || ''
      const bookAuthor = book.author?.toLowerCase() || ''

      const titleMatch =
        bookTitle.includes(titleLower) || bookRawTitle.includes(titleLower) || bookSeries.includes(titleLower)

      if (!titleMatch) return false

      if (authorLower) {
        return bookAuthor.includes(authorLower)
      }

      return true
    })

    return matches.slice(0, limit).map((book) => this.mapToMetadata(book))
  }

  async getBookById(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const catalog = await this.loadCatalog()

    const book = catalog.find((b) => b.isbn === bookId || b.asin === bookId)

    if (!book) return null

    return this.mapToMetadata(book)
  }

  private mapToMetadata(book: GraphicAudioBook): BookMetadata {
    const narrators = book.cast?.filter((c) => c !== 'Narrator').slice(0, 10)

    let publishedYear: string | undefined
    if (book.releaseDate) {
      const date = new Date(book.releaseDate)
      if (!isNaN(date.getTime())) {
        publishedYear = String(date.getFullYear())
      }
    }

    const series =
      book.seriesName && book.episodeNumber
        ? [{ series: book.seriesName, sequence: String(book.episodeNumber) }]
        : book.seriesName
          ? [{ series: book.seriesName }]
          : undefined

    return normalizeBookMetadata({
      title: book.title,
      subtitle: book.subtitle,
      author: book.author,
      narrator: narrators?.join(', '),
      description: book.description,
      cover: book.cover,
      isbn: book.isbn,
      asin: book.asin,
      genres: book.genre ? [book.genre] : undefined,
      series,
      publishedYear
    })
  }
}
