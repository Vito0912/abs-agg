import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response, NextFunction } from 'express'
import type { CacheMode } from '../types'
import { setRequestLogAttributes } from '../telemetry/context'

interface RequestContext {
  cacheMode: CacheMode
  partial: boolean
  deadlineAt: number
}

const storage = new AsyncLocalStorage<RequestContext>()

export function cacheMode(): CacheMode {
  return storage.getStore()?.cacheMode || 'default'
}

export function markPartialResult(): void {
  const context = storage.getStore()
  if (context) context.partial = true
}

export function isPartialResult(): boolean {
  return storage.getStore()?.partial || false
}

export function runWithContext<T>(mode: CacheMode, callback: () => T): T {
  const deadlineAt = storage.getStore()?.deadlineAt ?? Date.now() + 45000

  return storage.run({ cacheMode: mode, partial: false, deadlineAt }, callback)
}

export function remainingRequestMs(): number {
  const deadlineAt = storage.getStore()?.deadlineAt
  if (deadlineAt === undefined) return 15000

  return Math.max(0, deadlineAt - Date.now())
}

export function attachRequestContext(req: Request, _res: Response, next: NextFunction): void {
  const query = req.query.title || req.query.query
  setRequestLogAttributes({
    'search.query': typeof query === 'string' ? query.slice(0, 500) : undefined,
    'search.author': typeof req.query.author === 'string' ? req.query.author.slice(0, 300) : undefined,
    'search.returned_books': 0
  })

  let mode: CacheMode = 'default'
  if (req.query.cache === 'refresh') mode = 'refresh'
  if (req.query.cache === 'false' || process.env.SKIP_CACHE === 'true' || process.env.DISABLE_CACHE === 'true') {
    mode = 'disabled'
  }
  runWithContext(mode, next)
}
