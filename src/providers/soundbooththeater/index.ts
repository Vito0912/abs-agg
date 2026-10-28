import { z } from 'zod'
import type { MetadataBundle, MetadataQuery, ParsedParameters } from '../../types'
import { BaseProvider } from '../BaseProvider'
import { catalogIntervalMs, indexSoundboothCatalog, loadSoundboothCatalog } from './catalog'
import { selectMetadataBundle } from '../../metadata/bundle'
import { searchSoundboothCatalog } from './search'
import type { SoundboothCatalogIndex } from './types'

export default class SoundboothTheaterProvider extends BaseProvider {
  override readonly adapterVersion = 2
  private catalog?: SoundboothCatalogIndex
  private catalogLoadedAt = 0
  private pendingCatalog?: Promise<SoundboothCatalogIndex>

  protected override async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const catalog = await this.loadCatalog()
    const defaultLimit = this.config.parameters.find((parameter) => parameter.name === 'limit')?.default
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .parse(params.limit ?? defaultLimit)
    const matches = searchSoundboothCatalog(catalog, query.title, query.author, limit)

    return selectMetadataBundle(catalog.bundle, matches)
  }

  private async loadCatalog(): Promise<SoundboothCatalogIndex> {
    if (this.catalog && Date.now() < this.catalogLoadedAt + catalogIntervalMs) return this.catalog
    if (this.pendingCatalog) return this.pendingCatalog

    const pending = loadSoundboothCatalog(this.cacheIdentity).then((catalog) => indexSoundboothCatalog(catalog))
    this.pendingCatalog = pending

    try {
      this.catalog = await pending
      this.catalogLoadedAt = Date.now()
      return this.catalog
    } finally {
      this.pendingCatalog = undefined
    }
  }
}
