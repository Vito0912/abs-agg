import type { RequestHandler } from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'

export function createAuthMiddleware(token = process.env.AUTH_TOKEN): RequestHandler {
  const expectedHash = token ? createHash('sha256').update(token).digest() : undefined

  return (req, res, next): void => {
    const authorization = req.get('Authorization') || ''
    const authorized =
      !expectedHash || timingSafeEqual(expectedHash, createHash('sha256').update(authorization).digest())
    if (!authorized) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    next()
  }
}
