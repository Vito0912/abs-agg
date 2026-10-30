import type { Author, Book, Chapter, MetadataEntity, Series, Work } from '../types'
import type { EntityVersionTable, MetadataDatabase } from './tables'

import { entityId, normalizeText, stableHash } from '../metadata/identity'
import { IdentityRepository } from './identities'

type VersionDetails = Pick<
  EntityVersionTable,
  | 'subtitle'
  | 'image'
  | 'format'
  | 'publisher'
  | 'publication_date'
  | 'publication_precision'
  | 'duration_seconds'
  | 'page_count'
  | 'abridged'
  | 'sort_name'
  | 'birth_date'
  | 'birth_precision'
  | 'death_date'
  | 'death_precision'
  | 'total_books'
  | 'sequence'
  | 'start_seconds'
  | 'end_seconds'
  | 'timeline'
  | 'file_id'
>
export class MetadataVersionWriter {
  private readonly identities: IdentityRepository

  constructor(private readonly database: MetadataDatabase) {
    this.identities = new IdentityRepository(database)
  }

  async store(entity: MetadataEntity, createdAt = Date.now()): Promise<number> {
    const revision = stableHash({ ...entity, source: { ...entity.source, fetchedAt: 0 } })
    const existing = await this.database
      .selectFrom('entity_versions')
      .select('version_key')
      .where('revision', '=', revision)
      .executeTakeFirst()
    if (existing) return existing.version_key

    const entityKey = await this.identities.register(entity)
    const personKey = entity.kind === 'author' ? await this.identities.person(entityKey, entity.name) : null
    const sourceUrlIsKey = entity.source.url === entity.source.sourceId
    const version = await this.database
      .insertInto('entity_versions')
      .values({
        revision,
        entity_key: entityKey,
        name: entity.kind === 'author' ? null : entity.name,
        person_key: personKey,
        description: entity.description ?? null,
        language: entity.language ?? null,
        stable: Number(entity.source.stable),
        detail_level: entity.source.quality,
        source_url: sourceUrlIsKey ? null : (entity.source.url ?? null),
        source_url_is_key: Number(sourceUrlIsKey),
        fetched_at: entity.source.fetchedAt,
        created_at: createdAt,
        ...this.detailValues(entity)
      })
      .returning('version_key')
      .executeTakeFirstOrThrow()
    const versionKey = version.version_key

    await this.storeIdentifiers(versionKey, entity)
    await this.storeRelations(versionKey, entity)
    await this.storeProvenance(versionKey, entity)
    if ('contributors' in entity) await this.storeCreativeMetadata(versionKey, entity)
    if ('alternativeNames' in entity) {
      await this.storeTerms(versionKey, 'alternative', entity.alternativeNames)
    }

    return versionKey
  }

  private detailValues(entity: MetadataEntity): VersionDetails {
    const common: VersionDetails = {
      subtitle: null,
      image: 'image' in entity ? (entity.image ?? null) : null,
      format: null,
      publisher: null,
      publication_date: null,
      publication_precision: null,
      duration_seconds: null,
      page_count: null,
      abridged: null,
      sort_name: null,
      birth_date: null,
      birth_precision: null,
      death_date: null,
      death_precision: null,
      total_books: null,
      sequence: null,
      start_seconds: null,
      end_seconds: null,
      timeline: null,
      file_id: null
    }

    switch (entity.kind) {
      case 'book':
        return { ...common, ...bookValues(entity) }
      case 'work':
        return { ...common, ...workValues(entity) }
      case 'author':
        return { ...common, ...authorValues(entity) }
      case 'series':
        return { ...common, ...seriesValues(entity) }
      case 'chapter':
        return { ...common, ...chapterValues(entity) }
    }
  }

  private async storeCreativeMetadata(
    versionKey: number,
    entity: Extract<MetadataEntity, { kind: 'book' | 'work' }>
  ): Promise<void> {
    await this.storeTerms(versionKey, 'genre', entity.genres)
    await this.storeTerms(versionKey, 'tag', entity.tags)

    for (const [position, contributor] of entity.contributors.entries()) {
      const inferredSourceId = contributor.sourceId || `name:${normalizeText(contributor.name)}`
      const scope = contributor.sourceId ? entity.source.scope : '[]'
      const authorId = contributor.authorId || entityId(entity.source.provider, 'author', inferredSourceId, scope)
      const authorKey = await this.identities.reference(authorId, entity.source.provider, 'author')
      const personKey = await this.identities.person(authorKey, contributor.name)
      const sourceIdentifier =
        contributor.sourceId === undefined
          ? null
          : await this.identities.identifier({
              scheme: 'provider',
              namespace: entity.source.provider,
              value: contributor.sourceId
            })
      await this.database
        .insertInto('version_contributors')
        .values({
          version_key: versionKey,
          position,
          person_key: personKey,
          linked: Number(Boolean(contributor.authorId)),
          role: contributor.role,
          source_identifier: sourceIdentifier
        })
        .execute()
    }

    for (const [position, rating] of entity.ratings.entries()) {
      await this.database
        .insertInto('version_ratings')
        .values({
          version_key: versionKey,
          position,
          source: rating.source,
          value: rating.value,
          minimum: rating.minimum,
          maximum: rating.maximum,
          rating_count: rating.ratingCount ?? null,
          review_count: rating.reviewCount ?? null,
          aspect: rating.aspect
        })
        .execute()
    }
  }

  private async storeTerms(versionKey: number, category: 'genre' | 'tag' | 'alternative', values: string[]) {
    for (const [position, value] of values.entries()) {
      await this.database
        .insertInto('version_terms')
        .values({ version_key: versionKey, category, position, value })
        .execute()
    }
  }

  private async storeIdentifiers(versionKey: number, entity: MetadataEntity): Promise<void> {
    for (const [position, identifier] of entity.identifiers.entries()) {
      const identifierKey = await this.identities.identifier(identifier)
      await this.database
        .insertInto('version_identifiers')
        .values({
          version_key: versionKey,
          position,
          identifier_key: identifierKey
        })
        .execute()
    }
  }

  private async storeRelations(versionKey: number, entity: MetadataEntity): Promise<void> {
    for (const [position, relation] of entity.relations.entries()) {
      const targetKind = { editionOf: 'work', partOf: 'series', hasChapter: 'chapter', chapterOf: 'book' } as const
      const targetKey = await this.identities.reference(
        relation.targetId,
        entity.source.provider,
        targetKind[relation.type]
      )
      await this.database
        .insertInto('version_relations')
        .values({
          version_key: versionKey,
          position,
          target_key: targetKey,
          type: relation.type,
          sequence: relation.sequence ?? null,
          ordering: relation.order ?? null
        })
        .execute()
    }
  }

  private async storeProvenance(versionKey: number, entity: MetadataEntity): Promise<void> {
    for (const [field, attribution] of Object.entries(entity.provenance)) {
      const donorKey = await this.identities.reference(attribution.entityId, attribution.provider, entity.kind)
      await this.database
        .insertInto('version_provenance')
        .values({
          version_key: versionKey,
          field,
          provider: attribution.provider,
          donor_key: donorKey,
          fetched_at: attribution.fetchedAt,
          evidence: attribution.evidence
        })
        .execute()
    }
  }
}

function bookValues(book: Book): Partial<VersionDetails> {
  return {
    subtitle: book.subtitle ?? null,
    format: book.format ?? null,
    publisher: book.publisher ?? null,
    publication_date: book.published?.value ?? null,
    publication_precision: book.published?.precision ?? null,
    duration_seconds: book.durationSeconds ?? null,
    page_count: book.pageCount ?? null,
    abridged: book.abridged === undefined ? null : Number(book.abridged)
  }
}

function workValues(work: Work): Partial<VersionDetails> {
  return {
    subtitle: work.subtitle ?? null,
    publication_date: work.firstPublished?.value ?? null,
    publication_precision: work.firstPublished?.precision ?? null
  }
}

function authorValues(author: Author): Partial<VersionDetails> {
  return {
    sort_name: author.sortName ?? null,
    birth_date: author.birthDate?.value ?? null,
    birth_precision: author.birthDate?.precision ?? null,
    death_date: author.deathDate?.value ?? null,
    death_precision: author.deathDate?.precision ?? null
  }
}

function seriesValues(series: Series): Partial<VersionDetails> {
  return { total_books: series.totalBooks ?? null }
}

function chapterValues(chapter: Chapter): Partial<VersionDetails> {
  return {
    sequence: chapter.sequence ?? null,
    start_seconds: chapter.startSeconds ?? null,
    end_seconds: chapter.endSeconds ?? null,
    timeline: chapter.timeline ?? null,
    file_id: chapter.fileId ?? null
  }
}
