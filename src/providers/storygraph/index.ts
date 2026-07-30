import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { dbManager } from '../../database/manager'
import { httpClient } from '../../utils/httpClient'
import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const BASE_URL = 'https://app.thestorygraph.com'
const PAGE_HEADERS = {
  Accept: 'text/html, application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Turbo Native Android Version 38 Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.166 Mobile Safari/537.36',
  'X-Requested-With': 'com.thestorygraph.thestorygraph'
}

interface StoryGraphSearchResult {
  id: string
  title: string
  author?: string
  cover?: string
}

export default class StoryGraphProvider extends BaseProvider {
  constructor() {
    super(config)
  }

  async search(
    title: string,
    author: string | null,
    params: ParsedParameters,
    options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = Math.min(Number(params.limit) || 3, 5)
    const searchTerm = author ? `${title} ${author}` : title
    const response = await httpClient.get(`${BASE_URL}/search`, {
      params: { search_term: searchTerm, button: '' },
      headers: { ...PAGE_HEADERS, 'Turbo-Frame': 'search_results', Referer: `${BASE_URL}/` },
      responseType: 'text'
    })

    if (response.status === 404) return []
    if (response.status !== 200) throw new Error(`The StoryGraph search error: ${response.status}`)

    const results = this.parseSearchResults(String(response.data)).slice(0, limit)
    const books: BookMetadata[] = []

    for (const result of results) {
      try {
        const details = await this.fetchBook(result.id, options?.skipCache === true)
        books.push(details || this.mapSearchResult(result))
      } catch (error) {
        console.error(`Failed to fetch The StoryGraph book ${result.id}:`, error)
        books.push(this.mapSearchResult(result))
      }
    }

    return books
  }

  async getBookById(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    return this.fetchBook(bookId, false)
  }

  private parseSearchResults(html: string): StoryGraphSearchResult[] {
    const $ = cheerio.load(html)
    const results: StoryGraphSearchResult[] = []

    $('a.book-list-option[href^="/books/"]').each((_, element) => {
      const link = $(element)
      const href = link.attr('href') || ''
      const id = href.match(/^\/books\/([^/?#]+)/)?.[1]
      const title = link.find('h1 .list-option-text').first().text().trim()
      const author = link.find('h2.list-option-text').first().text().trim()
      const cover = link.find('img').first().attr('src')?.trim()

      if (id && title && !results.some((result) => result.id === id)) {
        results.push({ id, title, author: author || undefined, cover: cover || undefined })
      }
    })

    return results
  }

  private async fetchBook(bookId: string, skipCache: boolean): Promise<BookMetadata | null> {
    if (!skipCache) {
      const cached = dbManager.getBookCache(this.config.id, bookId)
      if (cached) {
        try {
          return JSON.parse(cached) as BookMetadata
        } catch {}
      }
    }

    const response = await httpClient.get(`${BASE_URL}/books/${encodeURIComponent(bookId)}`, {
      headers: PAGE_HEADERS,
      responseType: 'text'
    })
    if (response.status === 404) return null
    if (response.status !== 200) throw new Error(`The StoryGraph book details error: ${response.status}`)

    const metadata = this.parseBookDetails(String(response.data))
    if (metadata) dbManager.setBookCache(this.config.id, bookId, JSON.stringify(metadata))
    return metadata
  }

  private parseBookDetails(html: string): BookMetadata | null {
    const $ = cheerio.load(html)
    const container = $('.book-title-author-and-series').first()
    const title = container.find('h3').first().text().replace(/\s+/g, ' ').trim()
    if (!title) return null

    const author = container.find('a[href^="/authors/"]').first().text().trim()
    const description = this.parseDescription($)
    const editionInfo = $('.edition-info').first()
    const editionFields = new Map<string, string>()
    editionInfo.find('p').each((_, element) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim()
      const separator = text.indexOf(':')
      if (separator !== -1) editionFields.set(text.slice(0, separator).trim(), text.slice(separator + 1).trim())
    })

    const publicationText = editionFields.get('Edition Pub Date') || $('span.toggle-edition-info-link').text()
    const publishedYear = publicationText?.match(/\b(?:18|19|20)\d{2}\b/)?.[0]
    const cover =
      $('meta[property="og:image"]').attr('content')?.trim() ||
      $('.book-cover img, img[alt*=" by "]').first().attr('src')?.trim()

    const metadata = normalizeBookMetadata({
      title,
      author: author || undefined,
      publisher: editionFields.get('Publisher') || undefined,
      publishedYear,
      description: description || undefined,
      cover: cover || undefined,
      isbn: editionFields.get('ISBN/UID') || undefined,
      language: editionFields.get('Language') || undefined,
      poweredBy: 'The StoryGraph'
    })
    return metadata
  }

  private parseDescription($: cheerio.CheerioAPI): string | undefined {
    const visibleDescription = $('.blurb-pane .trix-content').first().text().replace(/\s+/g, ' ').trim()

    for (const scriptElement of $('script').toArray()) {
      const script = $(scriptElement).html() || ''
      const readMoreIndex = script.indexOf('.read-more-btn')
      if (readMoreIndex === -1) continue

      const htmlCall = script.slice(readMoreIndex).match(/\.html\(\s*(['"])/)
      if (!htmlCall || htmlCall.index === undefined) continue

      const start = readMoreIndex + htmlCall.index + htmlCall[0].length
      const fullDescriptionHtml = this.decodeJavascriptString(script, start, htmlCall[1])
      if (fullDescriptionHtml === null) continue

      const fullDescription$ = cheerio.load(fullDescriptionHtml)
      const fullDescription = fullDescription$('.trix-content')
        .first()
        .contents()
        .map((_, element) => fullDescription$(element).text().trim())
        .get()
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (fullDescription) return fullDescription
    }

    return visibleDescription || undefined
  }

  private decodeJavascriptString(source: string, start: number, quote: string): string | null {
    let result = ''

    for (let index = start; index < source.length; index++) {
      const character = source[index]
      if (character === quote) return result

      if (character !== '\\') {
        result += character
        continue
      }

      const escapedCharacter = source[++index]
      if (escapedCharacter === undefined) return null

      switch (escapedCharacter) {
        case 'n':
          result += '\n'
          break
        case 'r':
          result += '\r'
          break
        case 't':
          result += '\t'
          break
        default:
          result += escapedCharacter
      }
    }

    return null
  }

  private mapSearchResult(result: StoryGraphSearchResult): BookMetadata {
    const metadata = normalizeBookMetadata({
      title: result.title,
      author: result.author,
      cover: result.cover,
      poweredBy: 'The StoryGraph'
    })
    return metadata
  }
}
