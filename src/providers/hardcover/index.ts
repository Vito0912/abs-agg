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
    const limit = Math.min(Number(params.limit) || 10, 25)
    const ids = await this.client.searchIds(title, author, limit)
    const language = normalizeLanguage(typeof params.language === 'string' ? params.language : undefined)

    const bundles = await mapConcurrent(ids, 3, (id) => {
      return this.cachedMetadata('work', String(id), params, async () => {
        const books = await this.client.books([id])

        return normalizeBooks(books.flatMap(mapHardcoverBook), this.config.id, params)
      })
    })

    const results = bundles.flatMap(bundleBooks)
    return results.filter((book) => !language || normalizeLanguage(book.language) === language)
  }
}
