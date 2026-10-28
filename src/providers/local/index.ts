import { dbManager } from '../../database/manager'
import { catalogBundle } from '../../metadata/bundle'
import { normalizeIsbn } from '../../metadata/identity'
import { rankCandidates } from '../../metadata/search'
import type { EntityKind, MetadataBundle, MetadataQuery, ParsedParameters } from '../../types'
import { BaseProvider } from '../BaseProvider'

export default class LocalProvider extends BaseProvider {
  override capabilities(): { search: EntityKind[]; lookup: EntityKind[] } {
    const kinds: EntityKind[] = ['work', 'book', 'author', 'series', 'chapter']
    return { search: kinds, lookup: kinds }
  }

  override async searchMetadata(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const providers = await dbManager.catalogProviders()
    const kinds: EntityKind[] = query.kind ? [query.kind] : ['work', 'book']
    const limit = Math.min(Number(params.limit) || query.limit || 10, 50)
    const candidates = await dbManager.searchCandidates({ title: query.title, kinds, providers, limit: 200 })
    const exactIdentifier = normalizeIsbn(query.title)
    const ranked = exactIdentifier ? candidates : rankCandidates(candidates, query.title, query.author)
    const representedWorks = new Set(
      ranked.flatMap((entity) => {
        if (entity.kind !== 'book') return []

        return entity.relations.filter((relation) => relation.type === 'editionOf').map((relation) => relation.targetId)
      })
    )
    const results = ranked.filter((entity) => entity.kind !== 'work' || !representedWorks.has(entity.id))
    const matches = results.slice(0, limit).map((entity) => entity.id)
    const entities = await dbManager.loadEntities(matches, providers)

    return catalogBundle(matches, entities)
  }

  override async lookupMetadata(entityId: string, _params: ParsedParameters): Promise<MetadataBundle> {
    const providers = await dbManager.catalogProviders()
    const entities = await dbManager.loadEntities([entityId], providers)
    return catalogBundle([entityId], entities)
  }
}
