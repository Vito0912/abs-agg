import { z } from 'zod'

function positiveInteger(name: string, fallback: number): number {
  const value = process.env[name]
  if (value === undefined) return fallback
  return z.coerce
    .number()
    .int()
    .positive()
    .parse(value, { error: () => `Invalid ${name}` })
}

export const cacheSettings = {
  databasePath: process.env.METADATA_DATABASE_PATH || './data/metadata.sqlite',
  searchTtlMs: positiveInteger('CACHE_SEARCH_TTL_SECONDS', 3600) * 1000,
  detailTtlMs: positiveInteger('CACHE_DETAIL_TTL_SECONDS', 86400) * 1000,
  negativeTtlMs: positiveInteger('CACHE_NEGATIVE_TTL_SECONDS', 120) * 1000
}
