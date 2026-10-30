import type { Identifier, MetadataBundle, MetadataEntity } from '../types'
import { dbManager } from '../database/manager'
import { normalizeIsbn, normalizeText } from './identity'

interface IdentifierLookup {
  findIdentifier(identifier: Identifier, providers: string[]): Promise<MetadataEntity[]>
}

type BookEntity = Extract<MetadataEntity, { kind: 'work' | 'book' }>

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

function hasDescription(entity: BookEntity): boolean {
  return Boolean(entity.description?.trim())
}

function identifierKey(identifier: Identifier): string {
  const canonical = enrichmentIdentifier(identifier) ?? identifier
  return JSON.stringify([canonical.scheme, canonical.value, canonical.namespace || '', canonical.marketplace || ''])
}

function sharedIdentifier(target: BookEntity, donor: BookEntity): Identifier | undefined {
  const donorKeys = new Set(donor.identifiers.map(identifierKey))

  return target.identifiers.find((identifier) => {
    if (!enrichmentIdentifier(identifier)) return false
    return donorKeys.has(identifierKey(identifier))
  })
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

  return [...new Set(names)].sort().join('|')
}

function canEnrich(target: BookEntity, donor: BookEntity): boolean {
  if (target.kind !== donor.kind || target.source.provider === donor.source.provider) return false
  if (!target.source.stable || !donor.source.stable) return false
  if (hasInvalidIdentifiers(target) || hasInvalidIdentifiers(donor)) return false
  if (normalizeText(target.name) !== normalizeText(donor.name)) return false
  if (!target.language || target.language !== donor.language) return false

  const targetAuthors = peopleKey(target, 'author')
  if (!targetAuthors || targetAuthors !== peopleKey(donor, 'author')) return false
  if (hasIdentifierConflict(target, donor) || !sharedIdentifier(target, donor)) return false

  if (target.kind === 'book' && donor.kind === 'book') {
    if (!target.format || target.format !== donor.format) return false
    if (target.abridged !== undefined && donor.abridged !== undefined && target.abridged !== donor.abridged)
      return false

    const targetNarrators = peopleKey(target, 'narrator')
    const donorNarrators = peopleKey(donor, 'narrator')
    if (targetNarrators && donorNarrators && targetNarrators !== donorNarrators) return false

    if (target.durationSeconds && donor.durationSeconds) {
      const relativeDifference = Math.abs(target.durationSeconds - donor.durationSeconds) / target.durationSeconds
      if (relativeDifference > 0.02) return false
    }
  }

  return true
}

function descriptionDonor(target: BookEntity, donors: BookEntity[]): BookEntity | undefined {
  const candidates = donors.filter((donor) => hasDescription(donor) && !donor.provenance.description)
  const descriptions = new Set(candidates.map((donor) => donor.description))
  if (descriptions.size !== 1 || hasDescription(target)) return undefined

  return candidates.sort((left, right) => {
    return right.source.fetchedAt - left.source.fetchedAt || left.id.localeCompare(right.id)
  })[0]
}

async function enrichEntity(target: BookEntity, providers: string[], database: IdentifierLookup): Promise<void> {
  if (hasDescription(target) || hasInvalidIdentifiers(target)) return

  const identifiers = target.identifiers.flatMap((identifier) => {
    const eligible = enrichmentIdentifier(identifier)
    return eligible ? [eligible] : []
  })
  const candidates = new Map<string, BookEntity>()

  for (const identifier of identifiers.slice(0, 4)) {
    const records = await database.findIdentifier(identifier, providers)
    if (records.length >= 100) return

    for (const record of records) {
      if ('contributors' in record && canEnrich(target, record)) candidates.set(record.id, record)
    }
  }

  const donor = descriptionDonor(target, [...candidates.values()])
  if (!donor) return
  const evidence = sharedIdentifier(target, donor)
  if (!evidence || (evidence.scheme !== 'isbn' && evidence.scheme !== 'asin')) return

  target.description = donor.description
  target.provenance.description = {
    provider: donor.source.provider,
    entityId: donor.id,
    fetchedAt: donor.source.fetchedAt,
    evidence: evidence.scheme
  }
}

export async function enrichMetadata(
  bundle: MetadataBundle,
  providers: string[],
  database: IdentifierLookup = dbManager
): Promise<MetadataBundle> {
  const result = structuredClone(bundle)
  const matches = new Set(result.matches)

  for (const entity of result.entities) {
    if (!matches.has(entity.id) || !('contributors' in entity)) continue
    await enrichEntity(entity, providers, database)
  }

  return result
}
