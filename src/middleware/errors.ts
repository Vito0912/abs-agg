import type { ErrorRequestHandler } from 'express'
import { errorAttributes, logger } from '../telemetry/logger'

export const handleRequestError: ErrorRequestHandler = (error: unknown, _req, res, next): void => {
  if (res.headersSent) {
    next(error)
    return
  }

  let status = error instanceof URIError ? 400 : 500
  if (error instanceof Error && 'status' in error) {
    if (error.status === 400 || error.status === 413 || error.status === 415) status = error.status
  }

  if (status === 500) logger.error('HTTP request failed', errorAttributes(error))

  res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Invalid request' })
}
