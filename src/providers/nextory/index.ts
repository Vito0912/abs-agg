import { randomUUID } from 'node:crypto'
import type { BookMetadata, ParsedParameters } from '../../types'
import { httpClient, UpstreamError } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { mapNextoryBook, nextoryBookFormat } from './mapper'
import { nextorySearchSchema } from './schemas'

const marketLocales: Record<string, string> = {
  DE: 'de_DE',
  AT: 'de_AT',
  CH: 'de_CH',
  DK: 'da_DK',
  ES: 'es_ES',
  FI: 'fi_FI',
  FR: 'fr_FR',
  NL: 'nl_NL',
  NO: 'nb_NO',
  SE: 'sv_SE'
}

export default class NextoryProvider extends BaseProvider {
  protected async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const type = String(params.type || 'all')
    const limit = Number(params.limit) || 12
    const market = String(params.market || 'DE')
    const locale = marketLocales[market]
    if (!locale) throw new Error(`Unsupported Nextory market: ${market}`)

    const response = await httpClient.get('https://api.nextory.com/discovery/v1/search/products/books', {
      params: {
        search_phrase: [title, author].filter(Boolean).join(' '),
        page: 0,
        per: limit,
        format: type === 'all' ? 'ebook,audiobook' : type,
        sort: 'relevance'
      },
      headers: {
        'x-app-version': '53.0',
        'x-application-id': '203',
        'x-country-code': market,
        'x-device-id': randomUUID(),
        'x-locale': locale,
        'x-model': 'web',
        Origin: 'https://nextory.com',
        Referer: 'https://nextory.com/'
      }
    })

    if (response.status !== 200) throw new UpstreamError('Nextory search failed', response.status)

    const data = nextorySearchSchema.parse(response.data)
    const books: BookMetadata[] = []

    for (const product of data.products) {
      if (product.media_type !== 'book') continue
      if (params.includeErotic === 'false' && product.is_adult_book) continue

      for (const format of product.formats) {
        const bookFormat = nextoryBookFormat(format.type)
        if (format.state !== 'ACTIVE' || !bookFormat) continue
        if (type !== 'all' && type !== bookFormat) continue

        books.push(mapNextoryBook(product, format))
        if (books.length >= limit) return books
      }
    }

    return books
  }
}
