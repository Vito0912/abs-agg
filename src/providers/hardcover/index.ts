import { normalizeLanguage } from '../../metadata/identity'
import { normalizeBooks } from '../../metadata/normalize'
import { mergeMetadataBundles, selectMetadataBundle } from '../../metadata/bundle'
import type { MetadataBundle, MetadataQuery, ParsedParameters, ProviderConfig } from '../../types'
import { mapConcurrent } from '../../utils/concurrency'
import { BaseProvider } from '../BaseProvider'
import { HardcoverClient } from './client'
import { mapHardcoverBook, mapHardcoverEditions } from './mapper'
import type { HardcoverBook } from './types'

export default class HardcoverProvider extends BaseProvider {
  readonly adapterVersion = 2
  private readonly client: HardcoverClient

  constructor(config: ProviderConfig) {
    super(config)
    this.client = new HardcoverClient(process.env.HARDCOVER_TOKEN || '')
  }

  protected async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const limit = Math.min(Number(params.limit) || 3, 25)
    const books = await this.client.searchBooks(query.title, query.author || null, limit)
    const language = normalizeLanguage(typeof params.language === 'string' ? params.language : undefined)

    const bundles = await mapConcurrent(books, 3, (book) => {
      return this.cachedMetadata('work', String(book.id), params, async () => {
        const metadata = await this.client.books(book.id, book)

        return this.normalizeMetadata(metadata, params)
      })
    })

    const bundle = mergeMetadataBundles(bundles)
    if (language) {
      const matchingIds = new Set(
        bundle.entities.filter((entity) => normalizeLanguage(entity.language) === language).map((entity) => entity.id)
      )
      bundle.matches = bundle.matches.filter((id) => matchingIds.has(id))
    }

    return selectMetadataBundle(bundle, bundle.matches)
  }

  private normalizeMetadata(books: HardcoverBook[], params: ParsedParameters): MetadataBundle {
    const bundle = normalizeBooks(
      books.flatMap(mapHardcoverEditions),
      this.config.id,
      params,
      this.config.identityScope
    )
    const selected = normalizeBooks(books.flatMap(mapHardcoverBook), this.config.id, params, this.config.identityScope)
    bundle.matches = selected.matches

    return bundle
  }
}
