import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { httpClient } from '../../utils/httpClient'
import { dbManager } from '../../database/manager'
import * as cheerio from 'cheerio'
import path from 'path'
import fs from 'fs'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

export default class SoundboothTheaterProvider extends BaseProvider {
  private readonly baseUrl = 'https://soundbooththeater.com/wp-admin/admin-ajax.php'
  private readonly headers = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd'
  }

  constructor() {
    super(config)
  }

  public async search(
    title: string,
    author: string | null,
    _params: ParsedParameters,
    _options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const query = [title, author].filter(Boolean).join(' ')

    if (!query) {
      return []
    }

    const formData = new URLSearchParams()
    formData.append('action', 'loadmore')
    formData.append('page', '0')
    formData.append('first_page_load', 'true')
    formData.append('search', query)

    try {
      const response = await httpClient.post(this.baseUrl, formData, {
        headers: {
          ...this.headers,
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Origin: 'https://soundbooththeater.com',
          Referer: `https://soundbooththeater.com/?s=${encodeURIComponent(query)}&post_type=product`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'no-cors'
        }
      })

      if (!response.data || !response.data.success || !response.data.posts) {
        return []
      }

      const searchResults = this.parseSearchResponse(response.data.posts)

      const enrichedResults: BookMetadata[] = []
      for (const book of searchResults) {
        enrichedResults.push(await this.enrichBookMetadata(book))
      }

      return enrichedResults
    } catch (error) {
      console.error('Error searching Soundbooth Theater:', error)
      return []
    }
  }

  private async enrichBookMetadata(book: BookMetadata): Promise<BookMetadata> {
    if (!book.bookId) {
      return book
    }

    const cached = dbManager.getBookCache(this.config.id, book.bookId)
    if (cached) {
      try {
        const cachedMetadata = JSON.parse(cached)
        return { ...book, ...cachedMetadata }
      } catch (e) {
        console.error('Error parsing cached metadata:', e)
      }
    }

    try {
      const response = await httpClient.get(book.bookId, {
        headers: this.headers
      })

      const details = this.parseDetailResponse(response.data)

      if (Object.keys(details).length > 0) {
        dbManager.setBookCache(this.config.id, book.bookId, JSON.stringify(details))
      }

      return { ...book, ...details }
    } catch (error) {
      console.error(`Error fetching details for ${book.title}:`, error)
      return book
    }
  }

  private parseDetailResponse(html: string): Partial<BookMetadata> {
    const $ = cheerio.load(html)
    const metadata: Partial<BookMetadata> = {}

    let description =
      $('.synopsis.readmore').html()?.trim() ||
      $('#tab-description').html()?.trim() ||
      $('.woocommerce-product-details__short-description').html()?.trim()

    if (!description || description.length < 50) {
      const metaDesc = $('meta[property="og:description"]').attr('content')
      if (metaDesc) description = metaDesc
    }

    if (description) {
      metadata.description = description.split('©', 2)[0]?.trim()
      metadata.publisher = '©' + description.split('©', 2)[1]?.replace(/<[^>]*>/g, '').trim()
    }

    const author = $('.summary h3 a').text().trim()
    if (author) {
      metadata.author = author
    }
    let allNarrators: string[] = []
    $('ul.audiobook-meta li').each((_, el) => {
      const text = $(el).text()
      const label = $(el).find('span').text().trim().toLowerCase().replace(':', '')

      if (label === 'narration'|| label === 'featuring') {
        const narrators = $(el)
          .find('a')
          .map((_, a) => $(a).text().trim())
          .get()
        if (narrators.length > 0) {
          allNarrators = [...allNarrators, ...narrators]
        } else {
          const narratorText = text.replace('Narration:', '').trim()
          if (narratorText) {
            allNarrators.push(narratorText)
          }
        }
      } else if (label === 'length') {
        const durationText = text.replace('Length:', '').trim()
        metadata.duration = this.parseDuration(durationText)
      } else if (label === 'genres') {
          const genres  = $(el)
          .find('a')
          .map((_, a) => $(a).text().trim())
          .get()
          if (genres.length > 0) {
            metadata.genres = genres
          }
      }
      metadata.narrator = allNarrators.join(', ') || undefined
    })

    const jsonLdScript = $('script.yoast-schema-graph').html()
    if (jsonLdScript) {
      try {
        const jsonLd = JSON.parse(jsonLdScript)
        const graph = jsonLd['@graph']
        if (graph) {
          const bookNode = graph.find((node: any) => node['@type'] === 'WebPage' || node.datePublished)
          if (bookNode && bookNode.datePublished) {
            metadata.publishedYear = bookNode.datePublished.substring(0, 4)
          }
        }
      } catch (e) {}
    }

    const genres = $('.posted_in a')
      .map((_, el) => $(el).text().trim())
      .get()
    if (genres.length > 0) {
      metadata.genres = [...(metadata.genres || []), ...genres]
    }

    return metadata
  }

  private parseDuration(durationStr: string): number | undefined {
    let totalSeconds = 0
    const hrsMatch = durationStr.match(/(\d+)\s*(?:hrs?|hours?)/i)
    const minsMatch = durationStr.match(/(\d+)\s*(?:mins?|minutes?)/i)
    const secsMatch = durationStr.match(/(\d+)\s*(?:secs?|seconds?)/i)

    if (hrsMatch) totalSeconds += parseInt(hrsMatch[1]) * 3600
    if (minsMatch) totalSeconds += parseInt(minsMatch[1]) * 60
    if (secsMatch) totalSeconds += parseInt(secsMatch[1])

    return totalSeconds > 0 ? Math.round(totalSeconds / 60) : undefined
  }

  private parseCoverImage(coverEl: cheerio.Cheerio<any> | null | undefined ): string | undefined {
    if (!coverEl || coverEl.length === 0) return undefined

    const src = coverEl.attr('src')
    const srcset = coverEl.attr('srcset') || ''

    if (srcset) {
      const candidates = srcset
        .split(',')
        .map(s => s.trim())
        .map(entry => {
          const parts = entry.split(' ')
          if (parts.length === 0) return null
          const url = parts[0].trim()
          if (!url) return null
          const sizeToken = parts[parts.length - 1].trim()
          if (!sizeToken) return null
          const width = typeof sizeToken === 'string' ? parseInt(sizeToken.replace('w', ''), 10) : NaN
          return { url, width: isNaN(width) ? 0 : width }
        })
        .filter(Boolean) as Array<{ url: string; width: number }>

      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.width || 0) - (a.width || 0))
        return candidates[0].url
      }
    }

    if (src) return src
    return undefined
  }

  private parseSearchResponse(html: string): BookMetadata[] {
    const $ = cheerio.load(html)
    const results: BookMetadata[] = []

    $('li.product').each((_, element) => {
      const el = $(element)
      const link = el.find('a.woocommerce-LoopProduct-link')
      const titleEl = el.find('.woocommerce-loop-product__title')
      const imgEl = el.find('img.attachment-woocommerce_thumbnail')

      const titleText = titleEl.text().trim()
      const href = link.attr('href')
      const cover = this.parseCoverImage(imgEl)

      if (!titleText || !href) return

      const metadata: BookMetadata = {
        title: titleText,
        bookId: href,
        cover: cover || undefined,
        ...this.parseTitle(titleText)
      }

      results.push(metadata)
    })

    return results
  }

  private parseTitle(fullTitle: string): Partial<BookMetadata> {
    const seriesMatch = fullTitle.match(/^(.*?), (?:Book|Episode) (\d+): (.*)$/i)
    if (seriesMatch) {
      return {
        series: [{ series: seriesMatch[1].trim(), sequence: seriesMatch[2] }],
        title: seriesMatch[3].trim(),
        subtitle: fullTitle
      }
    }

    return { title: fullTitle }
  }
}
