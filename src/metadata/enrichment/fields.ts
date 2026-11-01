import type { Book, Contributor, Work } from '../../types'
import { contributorSchema } from '../../types/metadata'
import { normalizeSharedName } from '../identity'
import type { BookEntity, EnrichmentCandidate } from './types'

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  return true
}

function comparisonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(comparisonValue).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, field]) => field !== undefined)
    entries.sort(([left], [right]) => left.localeCompare(right))
    return Object.fromEntries(entries.map(([key, field]) => [key, comparisonValue(field)]))
  }
  return typeof value === 'string' ? value.trim() : value
}

export function borrowedField(entity: BookEntity, field: string): boolean {
  return Object.keys(entity.provenance).some((path) => {
    return path === field || path.startsWith(`${field}.`) || field.startsWith(`${path}.`)
  })
}

function selectValue<Entity extends BookEntity, Value>(
  candidates: EnrichmentCandidate<Entity>[],
  field: string,
  read: (entity: Entity) => Value
): { candidate: EnrichmentCandidate<Entity>; value: Value } | undefined {
  const values = candidates.flatMap((candidate) => {
    if (borrowedField(candidate.entity, field)) return []
    const value = read(candidate.entity)
    return hasValue(value) ? [{ candidate, value }] : []
  })
  const distinct = new Set(values.map(({ value }) => JSON.stringify(comparisonValue(value))))
  if (distinct.size !== 1) return undefined

  return values[0]
}

export function attributeField(target: BookEntity, field: string, candidate: EnrichmentCandidate): void {
  target.provenance[field] = {
    provider: candidate.entity.source.provider,
    entityId: candidate.entity.id,
    fetchedAt: candidate.entity.source.fetchedAt,
    evidence: candidate.evidence
  }
}

function fillField<Entity extends BookEntity, Key extends keyof Entity & string>(
  target: Entity,
  candidates: EnrichmentCandidate<Entity>[],
  field: Key
): void {
  if (hasValue(target[field])) return
  const selected = selectValue(candidates, field, (entity) => entity[field])
  if (!selected) return

  target[field] = structuredClone(selected.value)
  attributeField(target, field, selected.candidate)
}

function fillContributors(target: BookEntity, candidates: EnrichmentCandidate[]): void {
  for (const role of contributorSchema.shape.role.options) {
    if (target.kind === 'work' && (role === 'narrator' || role === 'performer')) continue
    if (target.kind === 'book' && target.format === 'ebook' && (role === 'narrator' || role === 'performer')) continue
    if (target.contributors.some((person) => person.role === role)) continue

    const field = `contributors.${role}`
    const selected = selectValue(candidates, field, (entity) => {
      return entity.contributors
        .filter((person) => person.role === role)
        .map((person) => normalizeSharedName(person.name))
        .sort()
    })
    if (!selected) continue

    const contributors: Contributor[] = selected.candidate.entity.contributors
      .filter((person) => person.role === role)
      .map((person) => ({ name: person.name, role }))
    target.contributors.push(...contributors)
    attributeField(target, field, selected.candidate)
  }
}

function fillCommonFields(target: BookEntity, candidates: EnrichmentCandidate[]): void {
  fillField(target, candidates, 'language')
  fillField(target, candidates, 'image')
  fillField(target, candidates, 'ratings')
  fillContributors(target, candidates)

  const sameLanguage = candidates.filter((candidate) => {
    return Boolean(target.language) && candidate.entity.language === target.language
  })
  fillField(target, sameLanguage, 'description')
  fillField(target, sameLanguage, 'subtitle')
  fillField(target, sameLanguage, 'genres')
  fillField(target, sameLanguage, 'tags')
}

function fillBookFields(target: Book, candidates: EnrichmentCandidate[]): void {
  const books: EnrichmentCandidate<Book>[] = []
  for (const candidate of candidates) {
    if (candidate.entity.kind === 'book') books.push({ ...candidate, entity: candidate.entity })
  }

  fillField(target, books, 'format')
  fillField(target, books, 'publisher')
  fillField(target, books, 'published')
  fillField(target, books, 'pageCount')
  fillField(target, books, 'abridged')
  if (target.format === 'audiobook') {
    const audiobooks = books.filter((candidate) => candidate.entity.format === 'audiobook')
    fillField(target, audiobooks, 'durationSeconds')
  }
}

function fillWorkFields(target: Work, candidates: EnrichmentCandidate[]): void {
  const works: EnrichmentCandidate<Work>[] = []
  for (const candidate of candidates) {
    if (candidate.entity.kind === 'work') works.push({ ...candidate, entity: candidate.entity })
  }

  fillField(target, works, 'firstPublished')
  fillField(target, works, 'alternativeNames')
}

export function fillMissingFields(target: BookEntity, candidates: EnrichmentCandidate[]): void {
  if (target.kind === 'book') fillBookFields(target, candidates)
  else fillWorkFields(target, candidates)
  fillCommonFields(target, candidates)
}
