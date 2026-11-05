import { setTimeout as delay } from 'node:timers/promises'
import { httpClient, UpstreamError } from '../../utils/httpClient'
import { remainingRequestMs } from '../../utils/requestContext'
import { ProviderRateLimitError, runWithProviderCooldown } from '../rateLimit'
import { mbidSchema, releaseSchema, releaseSearchSchema } from './schemas'
import type { MusicBrainzRelease } from './types'

let pendingRequests = 0
let requestTail = Promise.resolve()
let nextRequestAt = 0

async function waitForTurn(previous: Promise<void>, deadlineAt: number): Promise<void> {
  let timeout: NodeJS.Timeout | undefined

  try {
    await Promise.race([
      previous,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new UpstreamError('MusicBrainz request queue timed out')),
          Math.max(0, deadlineAt - Date.now())
        )
      })
    ])
  } finally {
    clearTimeout(timeout)
  }
}

async function request(path: string, params: Record<string, string | number>): Promise<unknown | null> {
  if (pendingRequests >= 16) throw new UpstreamError('MusicBrainz request queue is full')

  const deadlineAt = Date.now() + remainingRequestMs()
  const previous = requestTail
  let releaseQueue = () => {}
  requestTail = new Promise<void>((resolve) => {
    releaseQueue = resolve
  })
  pendingRequests++

  try {
    await waitForTurn(previous, deadlineAt)
    const waitMs = Math.max(0, nextRequestAt - Date.now())
    if (Date.now() + waitMs >= deadlineAt) throw new UpstreamError('MusicBrainz request deadline exceeded')
    if (waitMs > 0) await delay(waitMs)

    return await runWithProviderCooldown('musicbrainz', async () => {
      try {
        const response = await httpClient.get(`https://musicbrainz.org/ws/2/${path}`, {
          params: { ...params, fmt: 'json' },
          headers: { 'User-Agent': 'abs-agg/1.1.0 (https://github.com/vito0912/abs-agg)' },
          retry: false
        })

        return response.status === 404 ? null : response.data
      } catch (error) {
        if (error instanceof UpstreamError && (error.status === 503 || error.status === 429)) {
          throw new ProviderRateLimitError(
            'musicbrainz',
            'Service throttled or temporarily unavailable',
            error.retryAfterMs
          )
        }
        throw error
      } finally {
        nextRequestAt = Date.now() + 1100
      }
    })
  } finally {
    void previous.then(() => {
      pendingRequests--
      releaseQueue()
    })
  }
}

function searchTerm(value: string): string {
  return `"${value.trim().replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, '\\$&')}"`
}

export async function searchReleases(title: string, author: string | null, limit: number): Promise<string[]> {
  const terms = ['secondarytype:audiobook']
  if (title.trim()) terms.push(`release:${searchTerm(title)}`)
  if (author?.trim()) terms.push(`artist:${searchTerm(author)}`)
  if (terms.length === 1) return []

  const data = await request('release/', { query: terms.join(' AND '), limit })
  const result = releaseSearchSchema.parse(data)

  const ids = result.releases
    .filter((release) => release['release-group']['secondary-types'].includes('Audiobook'))
    .map((release) => release.id)

  return [...new Set(ids)].slice(0, limit)
}

export async function fetchRelease(id: string): Promise<MusicBrainzRelease | null> {
  mbidSchema.parse(id)
  const data = await request(`release/${id}`, {
    inc: 'artist-credits+labels+recordings+release-groups+recording-rels+work-rels+artist-rels+work-level-rels+recording-level-rels+series-rels+genres'
  })
  if (data === null) return null

  return releaseSchema.parse(data)
}
