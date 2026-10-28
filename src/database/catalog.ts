import { sql } from 'kysely'
import type { MetadataDatabase } from './tables'
import type { Identifier, MetadataEntity } from '../types'
import type { SearchCandidatesCommand } from './protocol'
import { metadataEntitySchema } from '../types/metadata'
import { normalizeIsbn, normalizeText } from '../metadata/identity'

export class CatalogRepository {
  constructor(private readonly database: MetadataDatabase) {}

  async providers(): Promise<string[]> {
    const rows = await this.database.selectFrom('entities').select('provider').distinct().orderBy('provider').execute()

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
      .selectFrom('identifiers')
      .innerJoin('entities', 'entities.id', 'identifiers.entity_id')
      .select('entities.payload')
      .where('identifiers.scheme', '=', identifier.scheme)
      .where('identifiers.value', '=', identifier.value)
      .where('identifiers.namespace', '=', identifier.namespace || '')
      .where('identifiers.marketplace', '=', identifier.marketplace || '')
      .where('entities.provider', 'in', providers)
      .limit(100)
      .execute()

    return rows.map((row) => metadataEntitySchema.parse(JSON.parse(row.payload)))
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
          .selectFrom('entities')
          .select('payload')
          .where('id', 'in', requested)
          .where('provider', 'in', providers)
          .execute()

        for (const row of rows) {
          const entity = metadataEntitySchema.parse(JSON.parse(row.payload))
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
      .selectFrom('entity_fts')
      .innerJoin('entities', 'entities.rowid', 'entity_fts.rowid')
      .select('entities.payload')
      .where(sql<boolean>`entity_fts MATCH ${query}`)
      .where('entities.provider', 'in', command.providers)
      .where('entities.kind', 'in', command.kinds)
      .orderBy('entity_fts.rank')
      .limit(command.limit)
      .execute()

    return rows.map((row) => metadataEntitySchema.parse(JSON.parse(row.payload)))
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
      .selectFrom('entity_trigrams')
      .innerJoin('entities', 'entities.rowid', 'entity_trigrams.rowid')
      .select('entities.payload')
      .where(sql<boolean>`entity_trigrams MATCH ${expression}`)
      .where('entities.provider', 'in', command.providers)
      .where('entities.kind', 'in', command.kinds)
      .orderBy('entity_trigrams.rank')
      .limit(command.limit)
      .execute()

    return rows.map((row) => metadataEntitySchema.parse(JSON.parse(row.payload)))
  }
}
