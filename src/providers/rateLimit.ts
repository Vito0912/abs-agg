const DEFAULT_PROVIDER_COOLDOWN_MS = 60_000
const MINIMUM_PROVIDER_COOLDOWN_MS = 1_000
interface ProviderCooldown {
  until: number
  cause?: unknown
}

const cooldowns = new Map<string, ProviderCooldown>()

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
  constructor(
    provider: string,
    readonly retryAfterMs: number,
    options?: ErrorOptions
  ) {
    super(
      `${provider} is temporarily paused after an upstream rate limit. Retry in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      options
    )
    this.name = 'ProviderCooldownError'
  }
}

export function pauseProvider(provider: string, durationMs = DEFAULT_PROVIDER_COOLDOWN_MS, cause?: unknown): void {
  const requestedDuration = Number.isFinite(durationMs) ? durationMs : DEFAULT_PROVIDER_COOLDOWN_MS
  const boundedDuration = Math.max(MINIMUM_PROVIDER_COOLDOWN_MS, requestedDuration)
  const until = Date.now() + boundedDuration
  const existing = cooldowns.get(provider)
  cooldowns.set(provider, {
    until: Math.max(existing?.until || 0, until),
    cause: cause ?? existing?.cause
  })
}

export async function runWithProviderCooldown<T>(provider: string, operation: () => Promise<T>): Promise<T> {
  const cooldown = cooldowns.get(provider)
  const remainingMs = (cooldown?.until || 0) - Date.now()
  if (remainingMs > 0) throw new ProviderCooldownError(provider, remainingMs, { cause: cooldown?.cause })
  cooldowns.delete(provider)

  try {
    return await operation()
  } catch (error) {
    const durationMs = cooldownDuration(error)
    if (durationMs !== undefined) pauseProvider(provider, durationMs, error)
    throw error
  }
}

export function providerRetryAfterMs(provider: string, error: unknown): number | undefined {
  if (error instanceof ProviderCooldownError) return error.retryAfterMs

  const durationMs = cooldownDuration(error)
  if (durationMs === undefined) return undefined

  const remainingMs = (cooldowns.get(provider)?.until || 0) - Date.now()
  const requestedDuration = Number.isFinite(durationMs) ? durationMs : DEFAULT_PROVIDER_COOLDOWN_MS

  return Math.max(MINIMUM_PROVIDER_COOLDOWN_MS, remainingMs, requestedDuration)
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
