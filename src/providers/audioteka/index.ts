import { errorAttributes, logger } from '../../telemetry/logger'
import * as cheerio from 'cheerio'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'

import { AUDIOTEKA_LANGUAGES, type AudiotekaFullMetadata, type AudiotekaSearchMatch } from './types'
import { parseBookDetails, parseSearchResults } from './utils'

export default class AudiotekaProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const lang = String(params.lang)
    const limit = Math.min(Number(params.limit) || 5, 20)

    const langConfig = AUDIOTEKA_LANGUAGES[lang]
    if (!langConfig) {
      throw new Error(`Unsupported language: ${lang}`)
    }

    const searchUrl = `${langConfig.searchUrl}?phrase=${encodeURIComponent(title)}`

    const searchRes = await httpClient.get(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': langConfig.acceptLanguage
      }
    })

    if (searchRes.status !== 200) {
      throw new Error(`Audioteka search error: ${searchRes.status}`)
    }

    const $ = cheerio.load(String(searchRes.data))
    const searchMatches = parseSearchResults($)

    const books: BookMetadata[] = []
    const limitedMatches = searchMatches.slice(0, limit)

    for (const match of limitedMatches) {
      try {
        const metadata = await this.cachedBook(match.id, params, async () => {
          const fullMetadata = await this.fetchBookDetails(match, lang)
          return this.mapToBookMetadata(fullMetadata)
        })
        if (metadata?.title) {
          books.push(metadata)
        }
      } catch (error) {
        logger.error('Provider details failed', { provider: this.config.id, ...errorAttributes(error) })
        const basicMetadata = this.mapToBookMetadata({
          ...match,
          language: langConfig.languageName
        })
        if (basicMetadata.title) {
          books.push({ ...basicMetadata, quality: 'summary' })
        }
      }
    }

    return books
  }

  private async fetchBookDetails(match: AudiotekaSearchMatch, lang: string): Promise<AudiotekaFullMetadata> {
    const langConfig = AUDIOTEKA_LANGUAGES[lang]

    const response = await httpClient.get(match.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': langConfig.acceptLanguage
      }
    })

    if (response.status !== 200) {
      throw new Error(`Failed to fetch book details: ${response.status}`)
    }

    const $ = cheerio.load(String(response.data))
    return parseBookDetails($, match, langConfig)
  }

  private mapToBookMetadata(data: AudiotekaFullMetadata): BookMetadata {
    return normalizeBookMetadata({
      title: data.title,
      bookId: data.id,
      sourceUrl: data.url,
      format: 'audiobook',
      contributors: data.authors.map((name) => ({ name, role: 'author' })),
      author: data.authors.join(', '),
      narrator: data.narrator,
      publisher: data.publisher,
      description: data.description,
      cover: data.cover,
      genres: data.genres,
      tags: data.series,
      language: data.language,
      duration: data.duration
    })
  }
}
