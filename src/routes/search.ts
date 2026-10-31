import type { Request, Response } from 'express'
import { z } from 'zod'
import { observeOperation, recordSearchResults } from '../telemetry/operations'
import { errorAttributes, logger } from '../telemetry/logger'
import { absMatches } from '../metadata/projection'
import { enrichMetadata } from '../metadata/enrichment'
import { availableCatalogProviders } from '../metadata/catalog-providers'
import type { MetadataBundle, MetadataQuery } from '../types'
import { setRequestLogAttributes } from '../telemetry/context'
import { browserSourceError, shouldRejectBrowserRequest } from '../middleware/browserSource'

const querySchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(300).optional(),
  cache: z.enum(['true', 'false', 'refresh']).optional(),
  enrich: z.enum(['true', 'false']).optional()
})

const pendingSearches = new Set<Promise<void>>()

class InvalidSearchRequest extends Error {
  constructor(readonly details: z.ZodError) {
    super('Invalid request parameters')
  }
}

function parseQuery(req: Request): MetadataQuery {
  const result = querySchema.safeParse({ ...req.query, title: req.query.title || req.query.query })
  if (!result.success) throw new InvalidSearchRequest(result.error)

  return { title: result.data.title, author: result.data.author }
}

async function search(req: Request): Promise<MetadataBundle> {
  if (!req.provider || !req.parsedParams) throw new Error('Provider request was not initialized')

  const query = parseQuery(req)
  const params = { ...req.parsedParams }

  const provider = req.provider
  const providerId = provider.getConfig().id
  const bundle = await observeOperation('provider.search', { provider: providerId }, async () => {
    const result = await provider.searchMetadata(query, params)
    recordSearchResults(providerId, result.matches.length, result.complete)

    return result
  })
  const enrichmentEnabled = process.env.ENABLE_CROSS_PROVIDER_ENRICHMENT === 'true'
  if (!enrichmentEnabled || req.query.enrich === 'false') return bundle

  return enrichMetadata(bundle, await availableCatalogProviders())
}

export async function searchHandler(req: Request, res: Response): Promise<void> {
  const rejected = shouldRejectBrowserRequest(req)
  if (rejected) res.status(403).json({ error: browserSourceError })

  if (pendingSearches.size >= 32) {
    if (!rejected) {
      res.setHeader('Retry-After', '1')
      res.status(503).json({ error: 'Metadata search capacity reached' })
    }
    return
  }

  const pending = processSearch(req, res, rejected)
  pendingSearches.add(pending)

  try {
    await pending
  } finally {
    pendingSearches.delete(pending)
  }
}

export async function drainSearches(): Promise<void> {
  await Promise.allSettled(pendingSearches)
}

async function processSearch(req: Request, res: Response, rejected: boolean): Promise<void> {
  try {
    const bundle = await search(req)
    if (rejected) return

    const matches = absMatches(bundle)
    setRequestLogAttributes({ 'search.returned_books': matches.length })
    res.json({ matches })
  } catch (error) {
    sendSearchError(error, req, res)
  }
}

function sendSearchError(error: unknown, req: Request, res: Response): void {
  if (error instanceof InvalidSearchRequest) {
    if (!res.headersSent) res.status(400).json({ error: error.message, details: error.details.issues })
    return
  }

  logger.error('Provider request failed', {
    provider: req.provider?.getConfig().id || 'none',
    ...errorAttributes(error)
  })
  if (!res.headersSent) res.status(500).json({ error: 'Metadata provider request failed' })
}
