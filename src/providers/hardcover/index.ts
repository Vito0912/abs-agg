import { normalizeLanguage } from '../../metadata/identity'
import { normalizeBooks } from '../../metadata/normalize'
import { bundleBooks } from '../../metadata/projection'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { mapConcurrent } from '../../utils/concurrency'
import { BaseProvider } from '../BaseProvider'
import { HardcoverClient } from './client'
import { mapHardcoverBook } from './mapper'

export default class HardcoverProvider extends BaseProvider {
  private readonly client: HardcoverClient

  constructor(config: ProviderConfig) {
    super(config)
    this.client = new HardcoverClient(process.env.HARDCOVER_TOKEN || '')
  }

  protected async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Math.min(Number(params.limit) || 3, 25)
    const books = await this.client.searchBooks(title, author, limit)
    const language = normalizeLanguage(typeof params.language === 'string' ? params.language : undefined)

    const bundles = await mapConcurrent(books, 3, (book) => {
      return this.cachedMetadata('work', String(book.id), params, async () => {
        const metadata = await this.client.books(book.id, book)

        return normalizeBooks(metadata.flatMap(mapHardcoverBook), this.config.id, params, this.config.identityScope)
      })
    })

    const results = bundles.flatMap(bundleBooks)
    return results.filter((book) => !language || normalizeLanguage(book.language) === language)
  }
}
