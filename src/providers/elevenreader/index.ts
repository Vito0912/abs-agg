import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { dbManager } from '../../database/manager'
import config from './config.json'
import { DetailsResponse, ExploreRead, SearchResponse } from './types'

export default class ElevenReaderProvider extends BaseProvider {
  private readonly apiUrl = 'https://api.elevenlabs.io/v1/reader/reads'
  private readonly headers = {
    Origin: 'https://elevenreader.io',
    Referer: 'https://elevenreader.io/'
  }

  constructor() {
    super(config as ProviderConfig)
  }

  public async search(
    title: string,
    author: string | null,
    params: ParsedParameters,
    options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = Math.min(Math.max(Number(params.limit) || 3, 1), 10)
    const query = new URLSearchParams({ search_query: [title, author].filter(Boolean).join(' ') })
    const response = await httpClient.get<SearchResponse>(`${this.apiUrl}/explore/search?${query}`, {
      headers: this.headers
    })

    if (response.status !== 200) {
      throw new Error(`Error while searching ElevenReader: ${response.status}`)
    }

    const reads = (response.data.items || [])
      .filter((item) => item.type === 'compact_read_v1')
      .map((item) => item.explore_read)
      .filter((read): read is ExploreRead => Boolean(read?.read_id && read.title))
      .slice(0, limit)

    const books: BookMetadata[] = []

    for (const read of reads) {
      let details: DetailsResponse | null = null

      try {
        details = await this.fetchDetails(read.read_id, options?.skipCache)
      } catch (error) {
        console.error(`Failed to fetch ElevenReader details for ${read.read_id}:`, error)
      }

      books.push(this.mapMetadata(read.read_id, details, read))
    }

    return books
  }

  public async getBookById(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const details = await this.fetchDetails(bookId)

    if (!details?.sections?.some((section) => section.type === 'media_header_v1' && section.title)) {
      return null
    }

    return this.mapMetadata(bookId, details)
  }

  private async fetchDetails(bookId: string, skipCache = false): Promise<DetailsResponse | null> {
    if (!skipCache) {
      const cached = dbManager.getBookCache(this.config.id, bookId)

      if (cached) {
        try {
          const details = JSON.parse(cached) as DetailsResponse
          if (Array.isArray(details.sections)) return details
        } catch {}
      }
    }

    const response = await httpClient.get<DetailsResponse>(`${this.apiUrl}/details/${encodeURIComponent(bookId)}`, {
      headers: this.headers
    })

    if (response.status === 404) return null
    if (response.status !== 200) {
      throw new Error(`Error while fetching ElevenReader details: ${response.status}`)
    }
    if (!Array.isArray(response.data.sections)) return null

    dbManager.setBookCache(this.config.id, bookId, JSON.stringify(response.data))

    return response.data
  }

  private mapMetadata(bookId: string, details: DetailsResponse | null, read?: ExploreRead): BookMetadata {
    const sections = details?.sections || []
    const header = sections.find((section) => section.type === 'media_header_v1')
    const summary = sections.find((section) => section.type === 'title_description_v1' && section.title === 'Summary')
    const items = sections.find((section) => section.type === 'details_v1')?.items || []
    const getDetailValue = (title: string) => items.find((item) => item.title === title)?.value

    const length =
      getDetailValue('Length') ||
      sections.find((section) => section.type === 'meta_v1')?.items?.find((item) => item.title === 'Length')?.value
    const duration =
      read?.audio_duration_seconds != null
        ? Math.round(read.audio_duration_seconds / 60)
        : this.parseDurationMinutes(length)

    const genres =
      header?.collection_tags?.map((tag) => tag.title) ||
      getDetailValue('Genre')
        ?.split(',')
        .map((genre) => genre.trim())

    const metadata = normalizeBookMetadata({
      title: header?.title || read?.title,
      subtitle: header?.subtitle,
      author: header?.author || read?.author,
      narrator: header?.narrated_by || getDetailValue('Narrated by'),
      description: summary?.description || header?.description,
      cover:
        header?.image?.image_url ||
        read?.cover_image_urls?.large ||
        read?.cover_image_urls?.medium ||
        read?.cover_image_urls?.thumbnail ||
        read?.article_image_url,
      genres,
      publishedYear: getDetailValue('Publish date')?.match(/\b\d{4}\b/)?.[0],
      language: read?.language || getDetailValue('Language'),
      duration,
      poweredBy: this.config.name
    })

    metadata.bookId = bookId

    return metadata
  }

  private parseDurationMinutes(length: string | undefined): number | undefined {
    const hours = length?.match(/(\d+)\s*h/i)
    const minutes = length?.match(/(\d+)\s*m/i)

    if (!hours && !minutes) return undefined

    return Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)
  }
}
