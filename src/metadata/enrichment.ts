import type { MetadataBundle } from '../types'
import { dbManager } from '../database/manager'
import { fillMissingFields } from './enrichment/fields'
import { fillMissingSeries } from './enrichment/series'
import { findEnrichmentCandidates } from './enrichment/matching'
import type { EnrichmentLookup } from './enrichment/types'

export async function enrichMetadata(
  bundle: MetadataBundle,
  providers: string[],
  database: EnrichmentLookup = dbManager
): Promise<MetadataBundle> {
  const result = structuredClone(bundle)
  const matches = new Set(result.matches)

  for (const entity of result.entities) {
    if (!matches.has(entity.id) || !('contributors' in entity)) continue

    const candidates = await findEnrichmentCandidates(entity, providers, database)
    fillMissingFields(entity, candidates)
    await fillMissingSeries(entity, candidates, result, providers, database)
  }

  return result
}
