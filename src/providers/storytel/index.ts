import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { storytelSearchResponseSchema } from './schemas'
import type { StorytelSearchResult } from './types'
import { cleanTitle, extractSubtitle } from './utils'

export default class StorytelProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const language = String(params.language)
    const limit = Math.min(Number(params.limit) || 3, 10)

    const searchUrl = `https://www.storytel.com/api/search.action?request_locale=${encodeURIComponent(language)}&q=${encodeURIComponent(title.replace(/\s+/g, '+'))}`

    const searchRes = await httpClient.get(searchUrl)
    if (searchRes.status !== 200) throw new Error('Storytel search API error')
    const searchJson = storytelSearchResponseSchema.parse(searchRes.data)
    const searchResults = searchJson.books || []

    const books: BookMetadata[] = []

    for (const result of searchResults.slice(0, limit)) {
      if (!result.book) continue

      if (result.abook && params.type !== 'ebook') {
        books.push(this.mapStorytelToMetadata(result, { ...params, type: 'audiobook' }))
      }
      if (result.ebook && params.type !== 'audiobook') {
        books.push(this.mapStorytelToMetadata(result, { ...params, type: 'ebook' }))
      }
    }

    return books
  }

  private mapStorytelToMetadata(result: StorytelSearchResult, params: ParsedParameters): BookMetadata {
    const book = result.book
    let abook = result.abook
    let ebook = result.ebook

    switch (params.type) {
      case 'audiobook':
        ebook = undefined
        break
      case 'ebook':
        abook = undefined
        break
    }

    if (!book) {
      return normalizeBookMetadata({ title: '' })
    }

    const seriesName = book.series && book.series.length > 0 ? book.series[0].name : undefined
    const rawTitle = book.name || ''
    const cleanedTitle = cleanTitle(rawTitle, seriesName)
    let { title, subtitle } = extractSubtitle(cleanedTitle)

    if (/^\d+$/.test(title)) {
      title = subtitle || title || ''
      subtitle = undefined
    }

    const description = abook?.description || ebook?.description
    const isbn = abook?.isbn || ebook?.isbn
    const cover =
      params.type === 'ebook'
        ? (book.largeCoverE || book.coverE || book.largeCover || book.cover)?.replace(/\d{3}x\d{3}/, '1200x1200')
        : (book.largeCover || book.cover || book.largeCoverE || book.coverE)?.replace(/\d{3}x\d{3}/, '1200x1200')
    const durationSeconds = abook?.length === undefined ? undefined : abook.length / 1000

    const narrators = abook?.narrators?.map((n) => n.name).join(', ') || abook?.narratorAsString

    const publisher = abook?.publisher?.name || ebook?.publisher?.name || book.publisher?.name

    const releaseDate = abook?.releaseDate || ebook?.releaseDate || book.releaseDate
    const publishedYear = releaseDate ? releaseDate.slice(0, 4) : undefined

    const series =
      book.series && book.series.length > 0
        ? [
            {
              series: book.series[0].name,
              sourceId: String(book.series[0].id),
              sequence: book.seriesOrder ? String(book.seriesOrder) : undefined
            }
          ]
        : undefined

    const tags = book.tags?.map((t) => t.name)

    return normalizeBookMetadata({
      title,
      bookId: abook ? `audio:${abook.id}` : `ebook:${ebook?.id}`,
      format: abook ? 'audiobook' : 'ebook',
      work: { id: String(book.id), title: book.name },
      subtitle,
      author: book.authorsAsString,
      narrator: narrators,
      publisher,
      publishedYear,
      description,
      cover: cover ? new URL(cover, 'https://www.storytel.com').href : undefined,
      isbn,
      series,
      language: book.language?.isoValue,
      durationSeconds,
      tags
    })
  }
}
