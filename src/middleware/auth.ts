import { RequestHandler } from 'express'

export function createAuthMiddleware(token = process.env.AUTH_TOKEN): RequestHandler {
  return (req, res, next): void => {
    if (token && req.get('Authorization') !== token) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    next()
  }
}
