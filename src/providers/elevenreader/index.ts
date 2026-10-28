import { mapConcurrent } from '../../utils/concurrency'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { detailsResponseSchema, searchResponseSchema } from './schemas'
import type { DetailsResponse, ExploreRead, SearchResponse } from './types'

export default class ElevenReaderProvider extends BaseProvider {
  private readonly apiUrl = 'https://api.elevenlabs.io/v1/reader/reads'
  private readonly headers = {
    Origin: 'https://elevenreader.io',
    Referer: 'https://elevenreader.io/'
  }

  constructor(config: ProviderConfig) {
    super(config)
  }

  public async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Math.min(Math.max(Number(params.limit) || 3, 1), 10)
    const query = new URLSearchParams({ search_query: [title, author].filter(Boolean).join(' ') })
    const response = await httpClient.get<SearchResponse>(`${this.apiUrl}/explore/search?${query}`, {
      headers: this.headers
    })

    if (response.status !== 200) {
      throw new Error(`Error while searching ElevenReader: ${response.status}`)
    }

    const reads = (searchResponseSchema.parse(response.data).items || [])
      .filter((item) => item.type === 'compact_read_v1')
      .map((item) => item.explore_read)
      .filter((read): read is ExploreRead => Boolean(read?.read_id && read.title))
      .slice(0, limit)

    return mapConcurrent(reads, 3, (read) => this.loadSearchRead(read, params))
  }

  private async loadSearchRead(read: ExploreRead, params: ParsedParameters): Promise<BookMetadata> {
    try {
      const book = await this.getBookById(read.read_id, params)
      if (book) return book
    } catch (error) {
      console.error(`Failed to fetch ElevenReader details for ${read.read_id}:`, error)
    }

    return { ...this.mapMetadata(read.read_id, null, read), quality: 'summary' }
  }

  public async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const details = await this.fetchDetails(bookId)

    if (!details?.sections?.some((section) => section.type === 'media_header_v1' && section.title)) {
      return null
    }

    return this.mapMetadata(bookId, details)
  }

  private async fetchDetails(bookId: string): Promise<DetailsResponse | null> {
    const response = await httpClient.get<DetailsResponse>(`${this.apiUrl}/details/${encodeURIComponent(bookId)}`, {
      headers: this.headers
    })

    if (response.status === 404) return null
    if (response.status !== 200) {
      throw new Error(`Error while fetching ElevenReader details: ${response.status}`)
    }
    const details = detailsResponseSchema.parse(response.data)
    if (!details.sections) throw new Error('Missing ElevenReader detail sections')

    return details
  }

  private mapMetadata(bookId: string, details: DetailsResponse | null, read?: ExploreRead): BookMetadata {
    const sections = details?.sections || []
    const header = sections.find((section) => section.type === 'media_header_v1')
    const summary = sections
      .filter((section) => section.type === 'title_description_v1')
      .find((section) => section.title === 'Summary')
    const items = sections.find((section) => section.type === 'details_v1')?.items || []
    const getDetailValue = (title: string) => items.find((item) => item.title === title)?.value

    const length =
      getDetailValue('Length') ||
      sections.find((section) => section.type === 'meta_v1')?.items?.find((item) => item.title === 'Length')?.value
    const duration = this.parseDurationMinutes(length)
    const durationSeconds = read?.audio_duration_seconds ?? (duration === undefined ? undefined : duration * 60)

    const genres =
      header?.collection_tags?.map((tag) => tag.title) ||
      getDetailValue('Genre')
        ?.split(',')
        .map((genre) => genre.trim())

    const author = sections.find((section) => section.type === 'author_v1')
    const ratingSection = sections.find((section) => section.type === 'rating_v1')
    const ratingValue = read?.average_rating ?? Number(ratingSection?.text.match(/^\d+(?:\.\d+)?/)?.[0])
    const chapterSection = sections.find((section) => section.type === 'chapters_v1')
    const authorName = header?.author || read?.author || author?.name
    const narrator = (header?.narrated_by || getDetailValue('Narrated by'))?.replace(/^Narrated by\s+/i, '')

    const metadata = normalizeBookMetadata({
      title: header?.title || read?.title,
      subtitle: header?.subtitle,
      author: authorName,
      narrator,
      contributors: [
        ...(authorName ? [{ name: authorName, role: 'author', sourceId: header?.author_id || author?.author_id }] : []),
        ...(narrator ? [{ name: narrator, role: 'narrator' }] : [])
      ],
      authors: author?.author_id
        ? [
            {
              id: author.author_id,
              name: author.name,
              description: author.bio,
              image: author.avatar_url
            }
          ]
        : undefined,
      ratings:
        ratingValue !== undefined && Number.isFinite(ratingValue) && ratingValue >= 0 && ratingValue <= 5
          ? [
              {
                source: this.config.id,
                value: ratingValue,
                minimum: 0,
                maximum: 5,
                aspect: 'overall',
                ratingCount: read?.total_rating_count ?? undefined
              }
            ]
          : [],
      chapters: chapterSection?.items.map((chapter, index) => ({ title: chapter.name, sequence: index + 1 })),
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
      durationSeconds,
      format: 'audiobook',
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
