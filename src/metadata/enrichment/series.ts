import type { MetadataBundle, MetadataEntity, Series } from '../../types'
import { normalizeSharedName } from '../identity'
import { attributeField, borrowedField } from './fields'
import type { BookEntity, EnrichmentCandidate, EnrichmentLookup } from './types'

type SeriesRelation = BookEntity['relations'][number]

interface SeriesCandidate {
  candidate: EnrichmentCandidate
  relations: SeriesRelation[]
  entities: Series[]
  signature: string
}

function collectSeries(
  relations: SeriesRelation[],
  records: MetadataEntity[],
  existing: Map<string, MetadataEntity>,
  providers: string[]
): Series[] | undefined {
  const available = new Map(records.map((entity) => [entity.id, entity]))
  const collected = new Map<string, Series>()
  const remaining = relations.map((relation) => relation.targetId)

  while (remaining.length > 0) {
    const id = remaining.pop()
    if (!id || collected.has(id)) continue
    const entity = existing.get(id) || available.get(id)
    if (entity?.kind !== 'series' || !providers.includes(entity.source.provider)) return undefined
    if (entity.relations.some((relation) => relation.type !== 'partOf')) return undefined

    collected.set(id, entity)
    if (collected.size > 100) return undefined
    remaining.push(...entity.relations.map((relation) => relation.targetId))
  }

  return [...collected.values()]
}

async function resolveSeries(
  candidate: EnrichmentCandidate,
  bundle: MetadataBundle,
  providers: string[],
  database: EnrichmentLookup
): Promise<SeriesCandidate | undefined> {
  const relations = candidate.entity.relations.filter((relation) => relation.type === 'partOf')
  if (relations.length === 0 || relations.length > 50) return undefined
  if (!database.loadEntities) return undefined

  const records = await database.loadEntities(
    relations.map((relation) => relation.targetId),
    providers
  )
  const existing = new Map(bundle.entities.map((entity) => [entity.id, entity]))
  const entities = collectSeries(relations, records, existing, providers)
  if (!entities) return undefined

  const names = new Map(entities.map((entity) => [entity.id, normalizeSharedName(entity.name)]))
  const memberships = relations.map((relation) => {
    return JSON.stringify([
      names.get(relation.targetId),
      relation.sequence?.trim() || '',
      relation.order || 'unspecified'
    ])
  })
  memberships.sort()

  return { candidate, relations, entities, signature: JSON.stringify(memberships) }
}

export async function fillMissingSeries(
  target: BookEntity,
  candidates: EnrichmentCandidate[],
  bundle: MetadataBundle,
  providers: string[],
  database: EnrichmentLookup
): Promise<void> {
  if (target.relations.some((relation) => relation.type === 'partOf')) return
  const eligible = candidates.filter((candidate) => {
    return (
      !borrowedField(candidate.entity, 'relations.partOf') &&
      candidate.entity.relations.some((relation) => relation.type === 'partOf')
    )
  })
  if (eligible.length === 0 || eligible.length > 8) return

  const resolved: SeriesCandidate[] = []
  for (const candidate of eligible) {
    const series = await resolveSeries(candidate, bundle, providers, database)
    if (!series) return
    resolved.push(series)
  }
  if (new Set(resolved.map((series) => series.signature)).size !== 1) return

  const selected = resolved[0]
  if (!selected) return
  const ids = new Set(bundle.entities.map((entity) => entity.id))
  const additional = selected.entities.filter((entity) => !ids.has(entity.id))
  if (bundle.entities.length + additional.length > 5000) return

  for (const entity of additional) {
    bundle.entities.push(structuredClone(entity))
  }
  target.relations.push(...structuredClone(selected.relations))
  attributeField(target, 'relations.partOf', selected.candidate)
}
