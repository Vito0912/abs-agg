import { mapConcurrent } from '../../utils/concurrency'
import { markPartialResult } from '../../utils/requestContext'
import type { BookMetadata, ParsedParameters, ProviderConfig, SeriesMetadata } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { detailsApiResponseSchema, searchApiResponseSchema } from './schemas'
import type { DetailsApiResponse, SearchApiResponse } from './types'

export default class LibroFMProvider extends BaseProvider {
  private readonly searchApiUrl = 'https://libro.fm/api/v12/explore/search'
  private readonly detailsApiUrl = 'https://libro.fm/api/v12/explore/audiobook_details'

  constructor(config: ProviderConfig) {
    super(config)
  }

  public async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Number(params.limit) || 3
    const searchby = String(params.searchby || 'all')
    const language = String(params.lang || 'all')
    const aiNarrated = String(params.ai_narrated || 'false')

    this.validateParameters(title, author, limit, searchby, language, aiNarrated)

    let searchString = `${title}${author ? ` ${author}` : ''}`
    if (author && searchby === 'authors') {
      searchString = author
    } else if (searchby === 'titles') {
      searchString = title
    }

    const searchParams = new URLSearchParams({
      page: '1',
      q: searchString,
      searchby: searchby
    })

    if (language !== 'all') {
      searchParams.append(`language_${language}`, 'true')
    }

    if (aiNarrated === 'true') {
      searchParams.append('ai_narrated', 'true')
    }

    const searchUrl = `${this.searchApiUrl}?${searchParams.toString()}`
    console.log(`Fetching Libro.fm search results from: ${searchUrl}`)

    const searchRes = await httpClient.get<SearchApiResponse>(searchUrl, { headers: this.getHeaders() })
    if (searchRes.status === 404) {
      return []
    }
    if (searchRes.status !== 200) {
      throw new Error(`Error while searching Libro.fm: ${searchRes.status}`)
    }

    const searchData = searchApiResponseSchema.parse(searchRes.data)
    const audiobooks = searchData?.audiobook_collection?.audiobooks || []
    if (audiobooks.length === 0) {
      return []
    }

    const targetAudiobooks = audiobooks.slice(0, limit)
    const results = await mapConcurrent(targetAudiobooks, 3, async (book) => {
      if (!book.isbn) return null

      try {
        return await this.getBookById(String(book.isbn), params)
      } catch (error) {
        markPartialResult()
        console.error(`Failed to fetch details for ISBN ${book.isbn}:`, error)
        return null
      }
    })

    return results.filter((book): book is BookMetadata => book !== null)
  }

  async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const detailsUrl = `${this.detailsApiUrl}/${bookId}`
    console.log(`Fetching Libro.fm details from: ${detailsUrl}`)

    const detailsRes = await httpClient.get<DetailsApiResponse>(detailsUrl, { headers: this.getHeaders() })
    if (detailsRes.status === 404) {
      return null
    }
    if (detailsRes.status !== 200) {
      throw new Error(`Error while fetching audiobook details from Libro.fm: ${detailsRes.status}`)
    }

    const data = detailsApiResponseSchema.parse(detailsRes.data).data?.audiobook
    if (!data) {
      return null
    }

    const title = data.title || ''
    const subtitle = data.subtitle || undefined
    const authors = data.authors || []
    const narrators = data.audiobook_info?.narrators || []
    const publisher = data.publisher || undefined

    let publishedYear: string | undefined
    if (data.publication_date) {
      const yearMatch = data.publication_date.match(/\d{4}/)
      if (yearMatch) {
        publishedYear = yearMatch[0]
      }
    }

    const description = data.description || undefined
    let coverUrl = data.cover_url || undefined
    if (coverUrl) {
      if (coverUrl.startsWith('//')) {
        coverUrl = `https:${coverUrl}`
      } else if (!coverUrl.startsWith('http')) {
        coverUrl = `https://libro.fm${coverUrl}`
      }
    }

    const isbn = data.isbn ? String(data.isbn) : undefined
    const genres = data.genres?.map((g) => g.name).filter(Boolean) || []

    const seriesMetadata: SeriesMetadata[] = []
    if (data.series) {
      seriesMetadata.push({
        series: data.series,
        sequence: data.series_num !== null ? String(data.series_num) : undefined
      })
    }

    const language = data.audiobook_info?.audio_language_display || data.audiobook_info?.audio_language || undefined
    const durationSeconds = data.audiobook_info?.duration

    const metadata = normalizeBookMetadata({
      title,
      subtitle,
      author: authors.join(', ') || undefined,
      narrator: narrators.join(', ') || undefined,
      publisher,
      publishedYear,
      description,
      cover: coverUrl || undefined,
      isbn,
      genres: genres.length > 0 ? genres : undefined,
      series: seriesMetadata.length > 0 ? seriesMetadata : undefined,
      language,
      durationSeconds,
      format: 'audiobook',
      contributors: [
        ...authors.map((name) => ({ name, role: 'author' })),
        ...narrators.map((name) => ({ name, role: 'narrator' }))
      ],
      poweredBy: 'Libro.fm'
    })
    metadata.bookId = bookId
    return metadata
  }

  private validateParameters(
    title: string,
    author: string | null,
    limit: number,
    searchby: string,
    language: string,
    aiNarrated: string
  ): void {
    if (title.trim() === '') {
      throw new Error('Title is required')
    }

    const limitDef = this.getConfigParam('limit')
    if (limitDef?.validation && limit < (limitDef.validation.min ?? 1)) {
      throw new Error(`Limit must be >= ${limitDef.validation.min}`)
    }
    if (limitDef?.validation && limit > (limitDef.validation.max ?? 20)) {
      throw new Error(`Limit must be <= ${limitDef.validation.max}`)
    }

    const langDef = this.getConfigParam('lang')
    if (language !== 'all' && langDef?.validation.values && !langDef.validation.values.includes(language)) {
      throw new Error(`Invalid language value: ${language}`)
    }

    const searchbyDef = this.getConfigParam('searchby')
    if (searchbyDef?.validation.values && !searchbyDef.validation.values.includes(searchby)) {
      throw new Error(`Invalid searchby value: ${searchby}. Valid options: ${searchbyDef.validation.values.join(', ')}`)
    }

    if (searchby === 'authors' && (!author || author.trim() === '')) {
      throw new Error('Author is required when searchby is "author"')
    }

    const aiNarratedDef = this.getConfigParam('ai_narrated')
    if (
      aiNarrated !== 'false' &&
      aiNarratedDef?.validation.values &&
      !aiNarratedDef.validation.values.includes(aiNarrated)
    ) {
      throw new Error(
        `Invalid ai_narrated value: ${aiNarrated}. Valid options: ${aiNarratedDef.validation.values.join(', ')}`
      )
    }
  }

  private getConfigParam(paramName: string) {
    const configParam = this.config.parameters.find((param) => param.name === paramName)
    return configParam
  }

  private getHeaders(): Record<string, string> {
    return {
      'Accept-Encoding': 'gzip',
      Host: 'libro.fm',
      'User-Agent': 'okhttp/4.12.0',
      'X-LibroFm-AppVer': '7.37.4'
    }
  }
}
