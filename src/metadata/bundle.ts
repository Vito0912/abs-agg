import type { MetadataBundle, MetadataEntity } from '../types'
import { metadataBundleSchema } from '../types/metadata'

export function mergeMetadataBundles(bundles: MetadataBundle[]): MetadataBundle {
  const entities = new Map<string, MetadataEntity>()
  const matches = new Set<string>()

  for (const bundle of bundles) {
    for (const entity of bundle.entities) entities.set(entity.id, entity)
    for (const id of bundle.matches) matches.add(id)
  }

  return {
    schemaVersion: 1,
    matches: [...matches],
    entities: [...entities.values()],
    complete: bundles.every((bundle) => bundle.complete)
  }
}

export function selectMetadataBundle(bundle: MetadataBundle, matches: string[]): MetadataBundle {
  const entities = new Map(bundle.entities.map((entity) => [entity.id, entity]))
  const selected = new Map<string, MetadataEntity>()
  const remaining = [...matches]

  while (remaining.length > 0) {
    const id = remaining.pop()
    if (!id || selected.has(id)) continue
    const entity = entities.get(id)
    if (!entity) continue

    selected.set(id, entity)
    remaining.push(...entity.relations.map((relation) => relation.targetId))
    if ('contributors' in entity) {
      for (const contributor of entity.contributors) {
        if (contributor.authorId) remaining.push(contributor.authorId)
      }
    }
  }

  const result = catalogBundle(matches, [...selected.values()])
  result.complete = result.complete && bundle.complete

  return result
}

export function catalogBundle(matches: string[], records: MetadataEntity[]): MetadataBundle {
  const ids = new Set(records.map((entity) => entity.id))
  let complete = true

  const entities = records.map((record) => {
    const entity = structuredClone(record)
    entity.relations = entity.relations.filter((relation) => {
      if (ids.has(relation.targetId)) return true
      complete = false
      return false
    })

    if ('contributors' in entity) {
      for (const contributor of entity.contributors) {
        if (contributor.authorId && !ids.has(contributor.authorId)) {
          contributor.authorId = undefined
          complete = false
        }
      }
    }

    return entity
  })

  return metadataBundleSchema.parse({
    schemaVersion: 1,
    matches: matches.filter((id) => ids.has(id)),
    entities,
    complete
  })
}
