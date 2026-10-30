import type { MetadataEntity } from '../types'
import { metadataEntitySchema } from '../types/metadata'
import type { MetadataDatabase } from './tables'

async function selectVersions(database: MetadataDatabase, keys: number[]) {
  return database
    .selectFrom('entity_versions as version')
    .innerJoin('source_entities as entity', 'entity.entity_key', 'version.entity_key')
    .innerJoin('identifier_values as source', 'source.identifier_key', 'entity.source_identifier')
    .leftJoin('people as person', 'person.person_key', 'version.person_key')
    .selectAll('version')
    .select([
      'entity.public_id',
      'entity.provider',
      'entity.kind',
      'entity.scope_key',
      'source.value as source_id',
      'person.name as person_name'
    ])
    .where('version.version_key', 'in', keys)
    .execute()
}

type VersionRow = Awaited<ReturnType<typeof selectVersions>>[number]
interface VersionDraft {
  fields: Record<string, unknown>
  identifiers: unknown[]
  contributors: unknown[]
  relations: unknown[]
  ratings: unknown[]
  genres: string[]
  tags: string[]
  alternativeNames: string[]
  provenance: Record<string, unknown>
}

function dateValue(value: string | null, precision: string | null) {
  return value === null ? undefined : { value, precision }
}

function versionDetails(row: VersionRow): Record<string, unknown> {
  switch (row.kind) {
    case 'book':
      return {
        subtitle: row.subtitle ?? undefined,
        image: row.image ?? undefined,
        format: row.format ?? undefined,
        publisher: row.publisher ?? undefined,
        published: dateValue(row.publication_date, row.publication_precision),
        durationSeconds: row.duration_seconds ?? undefined,
        pageCount: row.page_count ?? undefined,
        abridged: row.abridged === null ? undefined : Boolean(row.abridged)
      }
    case 'work':
      return {
        subtitle: row.subtitle ?? undefined,
        image: row.image ?? undefined,
        firstPublished: dateValue(row.publication_date, row.publication_precision)
      }
    case 'author':
      return {
        sortName: row.sort_name ?? undefined,
        image: row.image ?? undefined,
        birthDate: dateValue(row.birth_date, row.birth_precision),
        deathDate: dateValue(row.death_date, row.death_precision)
      }
    case 'series':
      return { image: row.image ?? undefined, totalBooks: row.total_books ?? undefined }
    case 'chapter':
      return {
        sequence: row.sequence ?? undefined,
        startSeconds: row.start_seconds ?? undefined,
        endSeconds: row.end_seconds ?? undefined,
        timeline: row.timeline ?? undefined,
        fileId: row.file_id ?? undefined
      }
  }
}

export class MetadataVersionReader {
  constructor(private readonly database: MetadataDatabase) {}

  async load(keys: number[]): Promise<Map<number, MetadataEntity>> {
    const result = new Map<number, MetadataEntity>()
    const unique = [...new Set(keys)]
    for (let offset = 0; offset < unique.length; offset += 400) {
      const batch = unique.slice(offset, offset + 400)
      const records = await this.loadBatch(batch)
      for (const [key, entity] of records) result.set(key, entity)
    }

    return result
  }

  private async loadBatch(keys: number[]): Promise<Map<number, MetadataEntity>> {
    const rows = await selectVersions(this.database, keys)
    const scopeKeys = [...new Set(rows.flatMap((row) => (row.scope_key === null ? [] : [row.scope_key])))]
    const scopes = await this.loadScopes(scopeKeys)
    const drafts = new Map<number, VersionDraft>()

    for (const row of rows) {
      drafts.set(row.version_key, {
        fields: {
          schemaVersion: 1,
          id: row.public_id,
          kind: row.kind,
          name: row.name ?? row.person_name,
          description: row.description ?? undefined,
          language: row.language ?? undefined,
          source: {
            provider: row.provider,
            sourceId: row.source_id,
            scope: scopes.get(row.scope_key ?? -1),
            stable: Boolean(row.stable),
            fetchedAt: row.fetched_at,
            quality: row.detail_level,
            url: row.source_url_is_key ? row.source_id : (row.source_url ?? undefined)
          },
          ...versionDetails(row)
        },
        identifiers: [],
        contributors: [],
        relations: [],
        ratings: [],
        genres: [],
        tags: [],
        alternativeNames: [],
        provenance: {}
      })
    }

    await this.loadIdentifiers(keys, drafts)
    await this.loadContributors(keys, drafts)
    await this.loadRelations(keys, drafts)
    await this.loadRatings(keys, drafts)
    await this.loadTerms(keys, drafts)
    await this.loadProvenance(keys, drafts)

    const result = new Map<number, MetadataEntity>()
    for (const [key, draft] of drafts) {
      const { fields, ...collections } = draft
      result.set(key, metadataEntitySchema.parse({ ...fields, ...collections }))
    }

    return result
  }

  private async loadScopes(keys: number[]): Promise<Map<number, string>> {
    const scopes = new Map<number, [string, string | number | boolean][]>()
    for (const key of keys) scopes.set(key, [])
    if (keys.length === 0) return new Map()

    const rows = await this.database
      .selectFrom('scope_parameters')
      .selectAll()
      .where('scope_key', 'in', keys)
      .orderBy('position')
      .execute()
    for (const row of rows) {
      let value: string | number | boolean = row.value
      if (row.value_type === 'number') value = Number(row.value)
      if (row.value_type === 'boolean') value = row.value === 'true'
      scopes.get(row.scope_key)?.push([row.name, value])
    }

    return new Map([...scopes].map(([key, parameters]) => [key, JSON.stringify(parameters)]))
  }

  private async loadIdentifiers(keys: number[], drafts: Map<number, VersionDraft>): Promise<void> {
    const rows = await this.database
      .selectFrom('version_identifiers as link')
      .innerJoin('identifier_values as identifier', 'identifier.identifier_key', 'link.identifier_key')
      .selectAll('identifier')
      .select('link.version_key')
      .where('link.version_key', 'in', keys)
      .orderBy('link.position')
      .execute()
    for (const row of rows) {
      drafts.get(row.version_key)?.identifiers.push({
        scheme: row.scheme,
        value: row.value,
        namespace: row.namespace || undefined,
        marketplace: row.marketplace || undefined
      })
    }
  }

  private async loadContributors(keys: number[], drafts: Map<number, VersionDraft>): Promise<void> {
    const rows = await this.database
      .selectFrom('version_contributors as credit')
      .innerJoin('people as person', 'person.person_key', 'credit.person_key')
      .innerJoin('source_entities as author', 'author.entity_key', 'person.entity_key')
      .leftJoin('identifier_values as source', 'source.identifier_key', 'credit.source_identifier')
      .select([
        'credit.version_key',
        'credit.role',
        'person.name as name',
        'credit.linked',
        'author.public_id',
        'source.value as source_id'
      ])
      .where('credit.version_key', 'in', keys)
      .orderBy('credit.position')
      .execute()
    for (const row of rows) {
      drafts.get(row.version_key)?.contributors.push({
        name: row.name,
        role: row.role,
        authorId: row.linked ? row.public_id : undefined,
        sourceId: row.source_id ?? undefined
      })
    }
  }

  private async loadRelations(keys: number[], drafts: Map<number, VersionDraft>): Promise<void> {
    const rows = await this.database
      .selectFrom('version_relations as relation')
      .innerJoin('source_entities as target', 'target.entity_key', 'relation.target_key')
      .select(['relation.version_key', 'relation.type', 'relation.sequence', 'relation.ordering', 'target.public_id'])
      .where('relation.version_key', 'in', keys)
      .orderBy('relation.position')
      .execute()
    for (const row of rows) {
      drafts.get(row.version_key)?.relations.push({
        type: row.type,
        targetId: row.public_id,
        sequence: row.sequence ?? undefined,
        order: row.ordering ?? undefined
      })
    }
  }

  private async loadRatings(keys: number[], drafts: Map<number, VersionDraft>): Promise<void> {
    const rows = await this.database
      .selectFrom('version_ratings')
      .selectAll()
      .where('version_key', 'in', keys)
      .orderBy('position')
      .execute()
    for (const row of rows) {
      drafts.get(row.version_key)?.ratings.push({
        source: row.source,
        value: row.value,
        minimum: row.minimum,
        maximum: row.maximum,
        ratingCount: row.rating_count ?? undefined,
        reviewCount: row.review_count ?? undefined,
        aspect: row.aspect
      })
    }
  }

  private async loadTerms(keys: number[], drafts: Map<number, VersionDraft>): Promise<void> {
    const rows = await this.database
      .selectFrom('version_terms')
      .selectAll()
      .where('version_key', 'in', keys)
      .orderBy('position')
      .execute()
    for (const row of rows) {
      const draft = drafts.get(row.version_key)
      if (row.category === 'genre') draft?.genres.push(row.value)
      if (row.category === 'tag') draft?.tags.push(row.value)
      if (row.category === 'alternative') draft?.alternativeNames.push(row.value)
    }
  }

  private async loadProvenance(keys: number[], drafts: Map<number, VersionDraft>): Promise<void> {
    const rows = await this.database
      .selectFrom('version_provenance as attribution')
      .innerJoin('source_entities as donor', 'donor.entity_key', 'attribution.donor_key')
      .selectAll('attribution')
      .select('donor.public_id')
      .where('attribution.version_key', 'in', keys)
      .execute()
    for (const row of rows) {
      const draft = drafts.get(row.version_key)
      if (draft)
        draft.provenance[row.field] = {
          provider: row.provider,
          entityId: row.public_id,
          fetchedAt: row.fetched_at,
          evidence: row.evidence
        }
    }
  }
}
