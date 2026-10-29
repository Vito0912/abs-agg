import { storedCatalog } from '../../cache/catalog'
import { normalizeBooks } from '../../metadata/normalize'
import { bundleBooks } from '../../metadata/projection'
import { selectMetadataBundle } from '../../metadata/bundle'
import type { BookMetadata, MetadataBundle, MetadataQuery, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { graphicAudioBookSchema } from './schemas'
import type { GraphicAudioBook } from './types'

const CATALOG_URLS = [
  'https://raw.githubusercontent.com/binyaminyblatt/graphicaudio_scraper/refs/heads/main/results.json',
  'https://raw.githubusercontent.com/binyaminyblatt/graphicaudio_scraper/refs/heads/main/wayback_results.json'
]

export default class GraphicAudioProvider extends BaseProvider {
  override readonly adapterVersion = 2

  constructor(config: ProviderConfig) {
    super(config)
  }

  private async loadCatalog(): Promise<MetadataBundle> {
    return storedCatalog(this.cacheIdentity, 'catalog', 86400000, async () => {
      const catalog = new Map<string, BookMetadata>()
      const fetchedAt = Date.now()

      for (const url of CATALOG_URLS) {
        const response = await httpClient.get<unknown>(url)
        if (response.status !== 200) throw new Error(`Graphic Audio catalog error: ${response.status}`)

        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
        for (const record of graphicAudioBookSchema.array().max(50000).parse(data)) {
          const book = { ...this.mapToMetadata(record), fetchedAt }
          if (!book.title.trim()) continue
          const key = book.bookId || JSON.stringify([book.title, book.author])
          if (!catalog.has(key)) catalog.set(key, book)
        }
      }

      return normalizeBooks([...catalog.values()], this.config.id, {})
    })
  }

  protected override async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const limit = params.limit ? Number(params.limit) : 10
    const catalog = await this.loadCatalog()

    const titleLower = query.title.toLowerCase()
    const authorLower = query.author?.toLowerCase()

    const matches = bundleBooks(catalog).filter((book) => {
      if (!book.title) return false

      const bookTitle = book.title.toLowerCase()
      const bookSubtitle = book.subtitle?.toLowerCase() || ''
      const bookSeries =
        book.series
          ?.map((series) => series.series)
          .join(' ')
          .toLowerCase() || ''
      const bookAuthor = book.author?.toLowerCase() || ''

      const titleMatch =
        bookTitle.includes(titleLower) || bookSubtitle.includes(titleLower) || bookSeries.includes(titleLower)

      if (!titleMatch) return false

      if (authorLower) {
        return bookAuthor.includes(authorLower)
      }

      return true
    })

    const sourceIds = new Set(matches.slice(0, limit).map((book) => book.bookId))
    const ids = catalog.entities
      .filter((entity) => entity.kind === 'book' && sourceIds.has(entity.source.sourceId))
      .map((entity) => entity.id)

    return selectMetadataBundle(catalog, ids)
  }

  async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const catalog = bundleBooks(await this.loadCatalog())

    const book = catalog.find((b) => b.bookId === bookId || b.isbn === bookId || b.asin === bookId)

    if (!book) return null

    return book
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
      bookId: book.link || book.isbn || book.asin,
      format: 'audiobook',
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
