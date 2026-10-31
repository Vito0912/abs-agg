import { metrics } from '@opentelemetry/api'
import type { BatchObservableCallback } from '@opentelemetry/api'
import { dbManager } from '../database/manager'
import { entityKindSchema } from '../types/metadata'
import type { EntityKind } from '../types'
import { errorAttributes, logger } from './logger'

const meter = metrics.getMeter('abs-agg')
const catalogEntities = meter.createObservableGauge('abs_agg.catalog.entities', {
  description: 'Current locally stored records by source provider and entity kind, excluding historical snapshots',
  unit: '{entity}'
})
const catalogBooks = meter.createObservableGauge('abs_agg.catalog.books', {
  description: 'Current locally stored book records by source provider, excluding works and historical snapshots',
  unit: '{book}'
})

export function startCatalogMetrics(providers: string[]): () => void {
  const observeEntities: BatchObservableCallback = async (result) => {
    try {
      const rows = await dbManager.catalogEntityCounts()
      const counts = new Map(providers.map((provider) => [provider, new Map<EntityKind, number>()]))
      for (const row of rows) {
        let providerCounts = counts.get(row.provider)
        if (!providerCounts) {
          providerCounts = new Map<EntityKind, number>()
          counts.set(row.provider, providerCounts)
        }
        providerCounts.set(row.kind, row.count)
      }

      for (const [provider, providerCounts] of counts) {
        for (const kind of entityKindSchema.options) {
          result.observe(catalogEntities, providerCounts.get(kind) || 0, { provider, kind })
        }
        result.observe(catalogBooks, providerCounts.get('book') || 0, { provider })
      }
    } catch (error) {
      logger.warn('Catalog entity metrics unavailable', { ...errorAttributes(error) })
    }
  }

  meter.addBatchObservableCallback(observeEntities, [catalogEntities, catalogBooks])

  return () => meter.removeBatchObservableCallback(observeEntities, [catalogEntities, catalogBooks])
}
