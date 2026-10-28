import type { BookMetadata } from '../types'
import { bookMetadataSchema, seriesMetadataSchema } from '../types/providerBook'
import { parameterKey } from '../metadata/identity'

export function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

export function validateSeriesArray(value: unknown) {
  const result = seriesMetadataSchema.array().safeParse(value)
  if (!result.success || result.data.length === 0) return undefined

  return result.data
}

export function normalizeBookMetadata(data: Record<string, unknown>): BookMetadata {
  const cleaned = Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (typeof value === 'string') return [key, value.trim() || undefined]
      return [key, value]
    })
  )

  const year = cleaned.publishedYear
  if (typeof year === 'number' && Number.isInteger(year)) {
    cleaned.publishedYear = String(year)
  }

  return bookMetadataSchema.parse({ ...cleaned, title: cleaned.title || '' })
}

export const createParametersHash = parameterKey
