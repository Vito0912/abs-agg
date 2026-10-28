import type { z } from 'zod'
import { storedCatalog } from '../../cache/catalog'
import type { CacheIdentity } from '../../cache/types'
import { httpClient, UpstreamError } from '../../utils/httpClient'
import { normalizeText } from '../../metadata/identity'
import { bundleBooks } from '../../metadata/projection'
import type { MetadataBundle } from '../../types'
import { normalizeSoundboothCatalog } from './mapper'
import {
  soundboothContributorSchema,
  soundboothItemSchema,
  soundboothListSchema,
  soundboothSeriesSchema
} from './schemas'
import type { SoundboothCatalog, SoundboothCatalogIndex } from './types'

export const catalogIntervalMs = 86400000

const headers = {
  Accept: 'application/vnd.iglu.v2',
  'Content-Type': 'application/json; charset=UTF-8',
  'User-Agent': 'Dart/3.11 (dart:io)',
  'x-iglu-api-key': 'Bearer 7uVdUeKpooGrKVohTTGMHdPwQdYdeQIR',
  'x-iglu-app-version': '3.0.21+470'
}

async function fetchList<T extends { _id: string }>(
  name: string,
  record: z.ZodType<T>,
  options: Record<string, boolean> = {}
): Promise<T[]> {
  const response = await httpClient.post(
    `https://api.soundbooththeater.com/functions/u/${name}/list`,
    { limit: 50000, includeAll: true, ...options },
    { headers }
  )
  if (response.status !== 200) throw new UpstreamError(`Soundbooth Theater ${name} catalog failed`, response.status)

  const docs = soundboothListSchema(record).parse(response.data).data.docs
  return [...new Map(docs.map((doc) => [doc._id, doc])).values()]
}

async function fetchCatalog(): Promise<SoundboothCatalog> {
  const fetchedAt = Date.now()
  const [items, contributors, series] = await Promise.all([
    fetchList('items', soundboothItemSchema, {
      includeInLibrary: false,
      includeTotalDuration: true,
      includeParentDocuments: false
    }),
    fetchList('team-members', soundboothContributorSchema),
    fetchList('series', soundboothSeriesSchema)
  ])

  return { fetchedAt, items, contributors, series }
}

export async function loadSoundboothCatalog(identity: CacheIdentity): Promise<MetadataBundle> {
  return storedCatalog(
    identity,
    'catalog',
    catalogIntervalMs,
    async () => normalizeSoundboothCatalog(await fetchCatalog()),
    {
      minimumRefreshIntervalMs: catalogIntervalMs
    }
  )
}

export function indexSoundboothCatalog(bundle: MetadataBundle): SoundboothCatalogIndex {
  const entries = []
  const sourceIds = new Map<string, string>()
  for (const entity of bundle.entities) {
    if (entity.kind === 'book') sourceIds.set(entity.source.sourceId, entity.id)
  }

  for (const book of bundleBooks(bundle)) {
    const id = book.bookId ? sourceIds.get(book.bookId) : undefined
    if (!id) continue

    entries.push({
      id,
      book,
      title: normalizeText(book.title),
      series: normalizeText(book.series?.map((series) => series.series).join(' ') || ''),
      authors: normalizeText(book.author || '')
    })
  }

  return { bundle, entries }
}
