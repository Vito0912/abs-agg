import { cacheSettings } from '../config'
import type { MetadataBundle } from '../types'

export const permanentExpiry = Number.MAX_SAFE_INTEGER

export function bundleExpiry(bundle: MetadataBundle, ttlMs: number) {
  const now = Date.now()
  const positiveResult = bundle.matches.length > 0
  const freshTtlMs =
    bundle.complete && positiveResult ? Math.round(ttlMs * (0.9 + Math.random() * 0.2)) : cacheSettings.negativeTtlMs
  const freshUntil = now + freshTtlMs

  return {
    freshUntil,
    staleUntil: positiveResult ? permanentExpiry : freshUntil,
    errorUntil: positiveResult ? permanentExpiry : freshUntil
  }
}
