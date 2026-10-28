import { createHash } from 'node:crypto'
import type { Identifier, ParsedParameters } from '../types'

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function parameterKey(params: ParsedParameters): string {
  return stableHash(Object.entries(params).sort(([left], [right]) => left.localeCompare(right)))
}

export function detailParameterKey(params: ParsedParameters): string {
  const detailParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== 'limit' && key !== 'searchby')
  )

  return parameterKey(detailParams)
}

export function sourceScope(params: ParsedParameters): string {
  return JSON.stringify(
    ['market', 'region', 'language', 'lang'].flatMap((key) => (params[key] === undefined ? [] : [[key, params[key]]]))
  )
}

export function entityId(provider: string, kind: string, sourceId: string, scope: string): string {
  return `${provider}:${kind}:${stableHash([sourceId, scope])}`
}

export function normalizeIsbn(input: string): string | undefined {
  const value = input.replace(/[\s-]/g, '').toUpperCase()

  if (/^\d{9}[\dX]$/.test(value)) {
    return convertIsbn10(value)
  }

  if (!/^97[89]\d{10}$/.test(value)) {
    return undefined
  }

  const expectedCheckDigit = isbn13CheckDigit(value.slice(0, 12))
  const actualCheckDigit = Number(value[12])

  if (actualCheckDigit !== expectedCheckDigit) {
    return undefined
  }

  return value
}

function convertIsbn10(value: string): string | undefined {
  let checksum = 0

  for (const [index, character] of [...value].entries()) {
    const digit = character === 'X' ? 10 : Number(character)
    const weight = 10 - index
    checksum += digit * weight
  }

  if (checksum % 11 !== 0) {
    return undefined
  }

  const isbn13Prefix = `978${value.slice(0, 9)}`
  const checkDigit = isbn13CheckDigit(isbn13Prefix)

  return `${isbn13Prefix}${checkDigit}`
}

function isbn13CheckDigit(prefix: string): number {
  let weightedSum = 0

  for (const [index, character] of [...prefix].entries()) {
    const weight = index % 2 === 0 ? 1 : 3
    weightedSum += Number(character) * weight
  }

  const remainder = weightedSum % 10

  return (10 - remainder) % 10
}

export function bookIdentifiers(isbn?: string, asin?: string, marketplace?: string): Identifier[] {
  const identifiers: Identifier[] = []
  const normalizedIsbn = isbn ? normalizeIsbn(isbn) : undefined
  if (normalizedIsbn) identifiers.push({ scheme: 'isbn', value: normalizedIsbn })
  const normalizedAsin = asin?.trim().toUpperCase()
  if (normalizedAsin && /^[A-Z0-9]{10}$/.test(normalizedAsin)) {
    identifiers.push({ scheme: 'asin', value: normalizedAsin, marketplace })
  }
  return identifiers
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

const languages: Record<string, string> = {
  english: 'en',
  eng: 'en',
  german: 'de',
  deutsch: 'de',
  deu: 'de',
  ger: 'de',
  french: 'fr',
  français: 'fr',
  fra: 'fr',
  fre: 'fr',
  spanish: 'es',
  spa: 'es',
  polish: 'pl',
  polski: 'pl',
  pol: 'pl',
  swedish: 'sv',
  swe: 'sv',
  italian: 'it',
  ita: 'it',
  dutch: 'nl',
  nld: 'nl',
  czech: 'cs',
  ces: 'cs'
}

export function normalizeLanguage(value: string | undefined): string | undefined {
  if (!value) return undefined
  const mapped = languages[value.toLowerCase()] || value.replace(/_/g, '-')
  try {
    return Intl.getCanonicalLocales(mapped)[0]
  } catch {
    return value.trim()
  }
}
