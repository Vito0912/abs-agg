import type { Identifier, MetadataEntity } from '../../types'
import type { BookEntity, EnrichmentCandidate, EnrichmentLookup } from './types'
import { normalizeIsbn, normalizeSharedName, normalizeText } from '../identity'

function enrichmentIdentifier(identifier: Identifier): Identifier | undefined {
  if (identifier.scheme === 'isbn') {
    const value = normalizeIsbn(identifier.value)
    return value ? { ...identifier, value } : undefined
  }
  if (identifier.scheme !== 'asin') return undefined
  const value = identifier.value.trim().toUpperCase()
  if (!/^[A-Z0-9]{10}$/.test(value) || !identifier.marketplace?.trim()) return undefined

  return { ...identifier, value }
}

function hasInvalidIdentifiers(entity: BookEntity): boolean {
  return entity.identifiers.some((identifier) => {
    if (identifier.scheme === 'isbn') return !normalizeIsbn(identifier.value)
    if (identifier.scheme === 'asin') return !/^[A-Z0-9]{10}$/.test(identifier.value.trim().toUpperCase())
    return false
  })
}

function identifierKey(identifier: Identifier): string {
  const canonical = enrichmentIdentifier(identifier) ?? identifier
  return JSON.stringify([canonical.scheme, canonical.value, canonical.namespace || '', canonical.marketplace || ''])
}

function hasIdentifier(target: BookEntity, donor: BookEntity, identifier: Identifier): boolean {
  const key = identifierKey(identifier)

  return (
    target.identifiers.some((candidate) => identifierKey(candidate) === key) &&
    donor.identifiers.some((candidate) => identifierKey(candidate) === key)
  )
}

function hasIdentifierConflict(target: BookEntity, donor: BookEntity): boolean {
  for (const scheme of ['isbn', 'asin']) {
    const targetIds = target.identifiers.filter((identifier) => identifier.scheme === scheme).map(identifierKey)
    const donorIds = donor.identifiers.filter((identifier) => identifier.scheme === scheme).map(identifierKey)

    if (targetIds.length > 0 && donorIds.length > 0 && !targetIds.some((value) => donorIds.includes(value))) return true
  }

  return false
}

function peopleKey(entity: BookEntity, role: 'author' | 'narrator'): string {
  const names = entity.contributors.filter((person) => person.role === role).map((person) => normalizeText(person.name))

  if (names.length === 0) return ''
  return JSON.stringify([...new Set(names)].sort())
}

function claimsConflict(left: BookEntity, right: BookEntity): boolean {
  if (left.kind !== right.kind) return false
  if (normalizeText(left.name) !== normalizeText(right.name)) return true
  if (left.subtitle?.trim() && right.subtitle?.trim() && normalizeText(left.subtitle) !== normalizeText(right.subtitle))
    return true

  const leftAuthors = peopleKey(left, 'author')
  const rightAuthors = peopleKey(right, 'author')
  if (leftAuthors && rightAuthors && leftAuthors !== rightAuthors) return true
  if (left.language && right.language && left.language !== right.language) return true

  if (left.kind !== 'book' || right.kind !== 'book') return false
  if (left.format && right.format && left.format !== right.format) return true
  if (left.abridged !== undefined && right.abridged !== undefined && left.abridged !== right.abridged) return true

  const leftNarrators = peopleKey(left, 'narrator')
  const rightNarrators = peopleKey(right, 'narrator')
  if (leftNarrators && rightNarrators && leftNarrators !== rightNarrators) return true
  if (left.durationSeconds !== undefined && right.durationSeconds !== undefined) {
    const difference = Math.abs(left.durationSeconds - right.durationSeconds)
    const longerDuration = Math.max(left.durationSeconds, right.durationSeconds, 1)
    if (difference / longerDuration > 0.02) return true
  }

  return false
}

function hasConflictingClaims(records: MetadataEntity[]): boolean {
  const books = records.filter((entity): entity is BookEntity => 'contributors' in entity)

  for (let index = 0; index < books.length; index++) {
    for (let otherIndex = index + 1; otherIndex < books.length; otherIndex++) {
      if (claimsConflict(books[index], books[otherIndex])) return true
    }
  }

  return false
}

function canEnrich(target: BookEntity, donor: BookEntity, evidence: Identifier): boolean {
  if (target.kind !== donor.kind || target.source.provider === donor.source.provider) return false
  if (!target.source.stable || !donor.source.stable) return false
  if (hasInvalidIdentifiers(target) || hasInvalidIdentifiers(donor)) return false
  if (claimsConflict(target, donor)) return false
  if (hasIdentifierConflict(target, donor) || !hasIdentifier(target, donor, evidence)) return false

  return true
}

export async function findEnrichmentCandidates(
  target: BookEntity,
  providers: string[],
  database: EnrichmentLookup
): Promise<EnrichmentCandidate[]> {
  if (hasInvalidIdentifiers(target) || hasBorrowedIdentity(target)) return []

  const identifiers = target.identifiers.flatMap((identifier) => {
    const eligible = enrichmentIdentifier(identifier)
    return eligible ? [eligible] : []
  })
  const candidates = new Map<string, EnrichmentCandidate>()
  const allowedProviders = new Set(providers)

  for (const identifier of identifiers.slice(0, 4)) {
    const records = await database.findIdentifier(identifier, providers)
    if (records.length >= 100 || hasConflictingClaims(records)) return []

    for (const record of records) {
      if (!('contributors' in record) || !allowedProviders.has(record.source.provider)) continue
      if (hasBorrowedIdentity(record)) continue
      if (!hasIdentifier(target, record, identifier) || !canEnrich(target, record, identifier)) continue

      candidates.set(record.id, {
        entity: record,
        evidence: identifier.scheme === 'isbn' ? 'isbn' : 'asin'
      })
      if (candidates.size >= 100) return []
    }
  }

  const result = candidates.size > 0 ? [...candidates.values()] : await findTitleCandidates(target, providers, database)
  if (hasConflictingClaims([target, ...result.map((candidate) => candidate.entity)])) return []

  return result.sort((left, right) => {
    return right.entity.source.fetchedAt - left.entity.source.fetchedAt || left.entity.id.localeCompare(right.entity.id)
  })
}

function hasBorrowedIdentity(entity: BookEntity): boolean {
  return Object.keys(entity.provenance).some((field) => {
    return [
      'name',
      'subtitle',
      'identifiers',
      'language',
      'format',
      'abridged',
      'durationSeconds',
      'contributors'
    ].some((identityField) => field === identityField || field.startsWith(`${identityField}.`))
  })
}

function authorNames(entity: BookEntity): string {
  const names = entity.contributors
    .filter((person) => person.role === 'author')
    .map((person) => normalizeSharedName(person.name))
  if (names.length === 0) return ''
  return JSON.stringify([...new Set(names)].sort())
}

function matchingTitle(target: BookEntity, donor: BookEntity): boolean {
  if (target.kind !== donor.kind || normalizeText(target.name) !== normalizeText(donor.name)) return false
  const authors = authorNames(target)
  if (!authors || authors !== authorNames(donor)) return false
  const targetSubtitle = normalizeText(target.subtitle || '')
  const donorSubtitle = normalizeText(donor.subtitle || '')
  if (targetSubtitle !== donorSubtitle) return false

  return !claimsConflict(target, donor)
}

async function findTitleCandidates(
  target: BookEntity,
  providers: string[],
  database: EnrichmentLookup
): Promise<EnrichmentCandidate[]> {
  if (!database.findTitle || target.name.length > 500 || !authorNames(target)) return []
  const records = await database.findTitle(target.name, target.kind, providers)
  if (records.length >= 100) return []

  const candidates: EnrichmentCandidate[] = []
  for (const record of records) {
    if (!('contributors' in record) || !providers.includes(record.source.provider)) continue
    if (target.source.provider === record.source.provider || !record.source.stable || !target.source.stable) continue
    if (hasBorrowedIdentity(record) || hasInvalidIdentifiers(record) || !matchingTitle(target, record)) continue

    candidates.push({
      entity: record,
      evidence: 'title-author-subtitle'
    })
  }

  return candidates
}
