const DEFAULT_PROVIDER_COOLDOWN_MS = 60_000
const MINIMUM_PROVIDER_COOLDOWN_MS = 1_000
const cooldownUntil = new Map<string, number>()

export class ProviderRateLimitError extends Error {
  constructor(
    provider: string,
    message: string,
    readonly retryAfterMs?: number
  ) {
    super(`${provider} rate limit reached: ${message}`)
    this.name = 'ProviderRateLimitError'
  }
}

export class ProviderCooldownError extends Error {
  constructor(provider: string, retryAfterMs: number) {
    super(
      `${provider} is temporarily paused after an upstream rate limit. Retry in ${Math.ceil(retryAfterMs / 1000)} seconds.`
    )
    this.name = 'ProviderCooldownError'
  }
}

export function pauseProvider(provider: string, durationMs = DEFAULT_PROVIDER_COOLDOWN_MS): void {
  const requestedDuration = Number.isFinite(durationMs) ? durationMs : DEFAULT_PROVIDER_COOLDOWN_MS
  const boundedDuration = Math.max(MINIMUM_PROVIDER_COOLDOWN_MS, requestedDuration)
  const until = Date.now() + boundedDuration
  cooldownUntil.set(provider, Math.max(cooldownUntil.get(provider) || 0, until))
}

export async function runWithProviderCooldown<T>(provider: string, operation: () => Promise<T>): Promise<T> {
  const remainingMs = (cooldownUntil.get(provider) || 0) - Date.now()
  if (remainingMs > 0) throw new ProviderCooldownError(provider, remainingMs)
  cooldownUntil.delete(provider)

  try {
    return await operation()
  } catch (error) {
    const durationMs = cooldownDuration(error)
    if (durationMs !== undefined) pauseProvider(provider, durationMs)
    throw error
  }
}

function cooldownDuration(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  if (error instanceof ProviderRateLimitError) {
    return error.retryAfterMs ?? DEFAULT_PROVIDER_COOLDOWN_MS
  }
  if (!('status' in error) || error.status !== 429) return undefined
  if ('retryAfterMs' in error && typeof error.retryAfterMs === 'number') return error.retryAfterMs
  if ('retryAfterSeconds' in error && typeof error.retryAfterSeconds === 'number') {
    const hasRateLimitState =
      ('limit' in error && typeof error.limit === 'number') ||
      ('remaining' in error && typeof error.remaining === 'number')
    if (error.retryAfterSeconds === 1 && !hasRateLimitState) return DEFAULT_PROVIDER_COOLDOWN_MS

    return error.retryAfterSeconds * 1000
  }

  return DEFAULT_PROVIDER_COOLDOWN_MS
}
