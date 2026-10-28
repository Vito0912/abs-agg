import type { Identifier, MetadataBundle, MetadataEntity } from '../types'
import { dbManager } from '../database/manager'
import { normalizeText } from './identity'

type BookEntity = Extract<MetadataEntity, { kind: 'work' | 'book' }>

function identifierKey(identifier: Identifier): string {
  return JSON.stringify([identifier.scheme, identifier.value, identifier.namespace || '', identifier.marketplace || ''])
}

function sharedIdentifier(target: BookEntity, donor: BookEntity): Identifier | undefined {
  const donorKeys = new Set(donor.identifiers.map(identifierKey))

  return target.identifiers.find((identifier) => {
    if (identifier.scheme !== 'isbn' && identifier.scheme !== 'asin') return false
    if (identifier.scheme === 'asin' && !identifier.marketplace) return false
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
  return entity.contributors
    .filter((person) => person.role === role)
    .map((person) => normalizeText(person.name))
    .sort()
    .join('|')
}

function canEnrich(target: BookEntity, donor: BookEntity): boolean {
  if (target.kind !== donor.kind || target.source.provider === donor.source.provider) return false
  if (!target.source.stable || !donor.source.stable) return false
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
  const candidates = donors.filter((donor) => donor.description && !donor.provenance.description)
  const descriptions = new Set(candidates.map((donor) => donor.description))
  if (descriptions.size !== 1 || target.description) return undefined

  return candidates.sort((left, right) => {
    return right.source.fetchedAt - left.source.fetchedAt || left.id.localeCompare(right.id)
  })[0]
}

async function enrichEntity(target: BookEntity, providers: string[]): Promise<void> {
  if (target.description) return

  const identifiers = target.identifiers.filter((identifier) => {
    return identifier.scheme === 'isbn' || (identifier.scheme === 'asin' && Boolean(identifier.marketplace))
  })
  const candidates = new Map<string, BookEntity>()

  for (const identifier of identifiers.slice(0, 4)) {
    const records = await dbManager.findIdentifier(identifier, providers)
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

export async function enrichMetadata(bundle: MetadataBundle, providers: string[]): Promise<MetadataBundle> {
  const result = structuredClone(bundle)
  const matches = new Set(result.matches)

  for (const entity of result.entities) {
    if (!matches.has(entity.id) || !('contributors' in entity)) continue
    await enrichEntity(entity, providers)
  }

  return result
}
