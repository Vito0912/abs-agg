import { metadataCache } from '../cache/service'
import { cacheSettings } from '../config'
import { buildCacheKey } from '../cache/key'
import type { CacheIdentity } from '../cache/types'
import { normalizeBooks } from '../metadata/normalize'
import { markPartialResult } from '../utils/requestContext'
import { bundleBooks } from '../metadata/projection'
import type {
  BookMetadata,
  EntityKind,
  MetadataBundle,
  MetadataQuery,
  ParsedParameters,
  ProviderConfig
} from '../types'

export class UnsupportedProviderOperation extends Error {
  constructor(provider: string, operation: string) {
    super(`${provider} does not support ${operation}`)
    this.name = 'UnsupportedProviderOperation'
  }
}

export abstract class BaseProvider {
  readonly adapterVersion: number = 1

  constructor(protected readonly config: ProviderConfig) {}

  protected get cacheIdentity(): CacheIdentity {
    return { provider: this.config.id, version: this.adapterVersion }
  }

  getConfig(): ProviderConfig {
    return this.config
  }

  capabilities(): { search: EntityKind[]; lookup: EntityKind[] } {
    return {
      search: ['work', 'book'],
      lookup: this.fetchBook === BaseProvider.prototype.fetchBook ? [] : ['work', 'book']
    }
  }

  async search(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const bundle = await this.searchMetadata({ title, author: author || undefined }, params)
    return bundleBooks(bundle)
  }

  async searchMetadata(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    if (query.kind && !this.capabilities().search.includes(query.kind)) {
      throw new UnsupportedProviderOperation(this.config.id, `${query.kind} search`)
    }

    const key = buildCacheKey({ ...this.cacheIdentity, type: 'search', query, params })
    const bundle = await metadataCache.getOrLoad({
      key,
      provider: this.config.id,
      ttlMs: cacheSettings.searchTtlMs,
      load: () => this.searchEntities(query, params)
    })

    if (query.kind) {
      bundle.matches = bundle.entities.filter((entity) => entity.kind === query.kind).map((entity) => entity.id)
    }

    return bundle
  }

  async getBookById(bookId: string, params: ParsedParameters = {}): Promise<BookMetadata | null> {
    return this.cachedBook(bookId, params, () => this.fetchBook(bookId, params))
  }

  async lookupMetadata(bookId: string, params: ParsedParameters): Promise<MetadataBundle> {
    return this.cachedBookBundle(bookId, params, () => this.fetchBook(bookId, params))
  }

  protected async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const books = await this.searchBooks(query.title, query.author || null, params)
    return normalizeBooks(books, this.config.id, params, this.config.identityScope)
  }

  protected async searchBooks(
    _title: string,
    _author: string | null,
    _params: ParsedParameters
  ): Promise<BookMetadata[]> {
    throw new UnsupportedProviderOperation(this.config.id, 'book search')
  }

  protected async fetchBook(_bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    throw new UnsupportedProviderOperation(this.config.id, 'book lookup')
  }

  protected async cachedBook(
    bookId: string,
    params: ParsedParameters,
    load: () => Promise<BookMetadata | null>
  ): Promise<BookMetadata | null> {
    const bundle = await this.cachedBookBundle(bookId, params, load)
    if (!bundle.complete) markPartialResult()

    return bundleBooks(bundle)[0] || null
  }

  private async cachedBookBundle(
    bookId: string,
    params: ParsedParameters,
    load: () => Promise<BookMetadata | null>
  ): Promise<MetadataBundle> {
    return this.cachedMetadata('book', bookId, params, async () => {
      const book = await load()
      const books = book ? [{ ...book, bookId: book.bookId || bookId }] : []

      return normalizeBooks(books, this.config.id, params, this.config.identityScope)
    })
  }

  protected async cachedMetadata(
    kind: EntityKind,
    id: string,
    params: ParsedParameters,
    load: () => Promise<MetadataBundle>
  ): Promise<MetadataBundle> {
    return metadataCache.getOrLoad({
      key: buildCacheKey({ ...this.cacheIdentity, type: 'detail', kind, id, params }),
      provider: this.config.id,
      ttlMs: cacheSettings.detailTtlMs,
      load
    })
  }
}
