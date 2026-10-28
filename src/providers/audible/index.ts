import type { BookMetadata, MetadataBundle, MetadataQuery, ParsedParameters } from '../../types'
import { mapConcurrent } from '../../utils/concurrency'
import { BaseProvider } from '../BaseProvider'
import { AudibleClient } from './client'
import { mapAudibleBook } from './mapper'
import { audibleRegionSchema } from './schemas'

export default class AudibleProvider extends BaseProvider {
  override async searchMetadata(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const region = audibleRegionSchema.parse(params.region || 'us')

    return super.searchMetadata(query, { ...params, region })
  }

  protected async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const region = audibleRegionSchema.parse(params.region || 'us')
    const client = new AudibleClient(region)
    const limit = Math.min(Number(params.limit) || 5, 20)
    const asin = title.trim().toUpperCase()

    if (/^[A-Z0-9]{10}$/.test(asin)) {
      const book = await this.getBookById(asin, { ...params, region })
      if (book) return [book]
    }

    const products = await client.search(title, author, limit)
    const books = await mapConcurrent(products.slice(0, limit), 3, (product) => {
      return this.cachedBook(product.asin, params, async () => mapAudibleBook(product, region))
    })

    return books.filter((book): book is BookMetadata => book !== null)
  }

  protected async fetchBook(bookId: string, params: ParsedParameters): Promise<BookMetadata | null> {
    if (!/^[A-Z0-9]{10}$/.test(bookId)) throw new Error('Invalid Audible ASIN')

    const region = audibleRegionSchema.parse(params.region || 'us')
    const product = await new AudibleClient(region).book(bookId)

    return product ? mapAudibleBook(product, region) : null
  }
}
