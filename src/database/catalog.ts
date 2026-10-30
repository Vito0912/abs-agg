import { sql } from 'kysely'
import type { MetadataDatabase } from './tables'
import type { Identifier, MetadataEntity } from '../types'
import type { SearchCandidatesCommand } from './protocol'
import { MetadataVersionReader } from './version-reader'
import { normalizeIsbn, normalizeText } from '../metadata/identity'

export class CatalogRepository {
  constructor(private readonly database: MetadataDatabase) {}

  async providers(): Promise<string[]> {
    const rows = await this.database
      .selectFrom('source_entities')
      .innerJoin('catalog_entities', 'catalog_entities.entity_key', 'source_entities.entity_key')
      .select('provider')
      .distinct()
      .orderBy('provider')
      .execute()

    return rows.map((row) => row.provider)
  }

  async searchCandidates(command: SearchCandidatesCommand): Promise<MetadataEntity[]> {
    if (command.providers.length === 0 || command.kinds.length === 0) return []

    const isbn = normalizeIsbn(command.title)
    if (isbn) {
      const matches = await this.findIdentifier({ scheme: 'isbn', value: isbn }, command.providers)
      return matches.filter((entity) => command.kinds.includes(entity.kind)).slice(0, command.limit)
    }

    const query = normalizeText(command.title)
    if (!query) return []

    const tokens = query.split(' ').slice(0, 12)
    const tokenQuery = tokens.map((token) => `"${token}"*`).join(' OR ')
    const words = await this.searchWords(command, tokenQuery)
    if (words.length >= command.limit || query.length < 3) return words

    const trigrams = await this.searchTrigrams(command, query)
    const candidates = new Map(words.map((entity) => [entity.id, entity]))
    for (const entity of trigrams) candidates.set(entity.id, entity)

    return [...candidates.values()].slice(0, command.limit)
  }

  async findIdentifier(identifier: Identifier, providers: string[]): Promise<MetadataEntity[]> {
    if (providers.length === 0) return []

    const rows = await this.database
      .selectFrom('identifier_values as identifier')
      .innerJoin('version_identifiers as link', 'link.identifier_key', 'identifier.identifier_key')
      .innerJoin('catalog_entities as catalog', 'catalog.version_key', 'link.version_key')
      .innerJoin('source_entities as entity', 'entity.entity_key', 'catalog.entity_key')
      .select(['catalog.version_key', 'catalog.fetched_at'])
      .where('identifier.scheme', '=', identifier.scheme)
      .where('identifier.value', '=', identifier.value)
      .where('identifier.namespace', '=', identifier.namespace || '')
      .where('identifier.marketplace', '=', identifier.marketplace || '')
      .where('entity.provider', 'in', providers)
      .distinct()
      .limit(100)
      .execute()

    return this.hydrate(rows)
  }

  async loadEntities(ids: string[], providers: string[]): Promise<MetadataEntity[]> {
    if (ids.length === 0 || providers.length === 0) return []

    const found = new Map<string, MetadataEntity>()
    let remaining = [...new Set(ids)]

    for (let depth = 0; depth < 8 && remaining.length > 0; depth++) {
      const capacity = 5000 - found.size
      const requestedIds = remaining.slice(0, capacity)
      const next = new Set<string>()

      for (let offset = 0; offset < requestedIds.length; offset += 500) {
        const requested = requestedIds.slice(offset, offset + 500)
        const rows = await this.database
          .selectFrom('source_entities as entity')
          .innerJoin('catalog_entities as catalog', 'catalog.entity_key', 'entity.entity_key')
          .select(['catalog.version_key', 'catalog.fetched_at'])
          .where('entity.public_id', 'in', requested)
          .where('entity.provider', 'in', providers)
          .execute()

        for (const entity of await this.hydrate(rows)) {
          found.set(entity.id, entity)

          for (const relation of entity.relations) {
            if (!found.has(relation.targetId)) next.add(relation.targetId)
          }
          if ('contributors' in entity) {
            for (const person of entity.contributors) {
              if (person.authorId && !found.has(person.authorId)) next.add(person.authorId)
            }
          }
        }
      }

      remaining = [...next].filter((id) => !found.has(id))
      if (found.size >= 5000) break
    }

    return [...found.values()]
  }

  private async searchWords(command: SearchCandidatesCommand, query: string): Promise<MetadataEntity[]> {
    const rows = await this.database
      .selectFrom('metadata_fts')
      .innerJoin('source_entities as entity', 'entity.entity_key', 'metadata_fts.rowid')
      .innerJoin('catalog_entities as catalog', 'catalog.entity_key', 'entity.entity_key')
      .select(['catalog.version_key', 'catalog.fetched_at'])
      .where(sql<boolean>`metadata_fts MATCH ${query}`)
      .where('entity.provider', 'in', command.providers)
      .where('entity.kind', 'in', command.kinds)
      .orderBy('metadata_fts.rank')
      .limit(command.limit)
      .execute()

    return this.hydrate(rows)
  }

  private async searchTrigrams(command: SearchCandidatesCommand, query: string): Promise<MetadataEntity[]> {
    const characters = [...query]
    const grams = new Set<string>()
    for (let index = 0; index < characters.length - 2 && grams.size < 24; index++) {
      const gram = characters.slice(index, index + 3).join('')
      if (gram.trim().length === 3) grams.add(`"${gram}"`)
    }

    if (grams.size === 0) return []

    const expression = [...grams].join(' OR ')
    const rows = await this.database
      .selectFrom('metadata_trigrams')
      .innerJoin('source_entities as entity', 'entity.entity_key', 'metadata_trigrams.rowid')
      .innerJoin('catalog_entities as catalog', 'catalog.entity_key', 'entity.entity_key')
      .select(['catalog.version_key', 'catalog.fetched_at'])
      .where(sql<boolean>`metadata_trigrams MATCH ${expression}`)
      .where('entity.provider', 'in', command.providers)
      .where('entity.kind', 'in', command.kinds)
      .orderBy('metadata_trigrams.rank')
      .limit(command.limit)
      .execute()

    return this.hydrate(rows)
  }

  private async hydrate(rows: { version_key: number; fetched_at: number }[]): Promise<MetadataEntity[]> {
    const reader = new MetadataVersionReader(this.database)
    const versions = await reader.load(rows.map((row) => row.version_key))

    return rows.flatMap((row) => {
      const entity = versions.get(row.version_key)
      if (!entity) return []
      const observed = structuredClone(entity)
      observed.source.fetchedAt = row.fetched_at
      return [observed]
    })
  }
}
