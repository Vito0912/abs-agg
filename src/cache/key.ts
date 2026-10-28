import { detailParameterKey, parameterKey, stableHash } from '../metadata/identity'
import type { CacheKeyRequest } from './types'

export function buildCacheKey(request: CacheKeyRequest): string {
  const provider = encodeURIComponent(request.provider)
  const input = keyInput(request)

  return `v1:${provider}:${request.version}:${request.type}:${stableHash(input)}`
}

function keyInput(request: CacheKeyRequest): unknown[] {
  switch (request.type) {
    case 'search':
      return [
        request.query.title,
        request.query.author || null,
        request.query.kind || null,
        parameterKey(request.params)
      ]
    case 'detail':
      return [request.kind, request.id, detailParameterKey(request.params)]
    case 'catalog':
      return [request.name]
  }
}
