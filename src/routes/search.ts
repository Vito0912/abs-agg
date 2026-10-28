import type { Request, Response } from 'express'
import { z } from 'zod'
import { absMatches } from '../metadata/projection'
import { enrichMetadata } from '../metadata/enrichment'
import { dbManager } from '../database/manager'
import type { MetadataBundle, MetadataQuery } from '../types'

const querySchema = z.object({
  title: z.string().trim().min(1).max(500),
  author: z.string().trim().min(1).max(300).optional(),
  cache: z.enum(['true', 'false', 'refresh']).optional(),
  enrich: z.enum(['true', 'false']).optional()
})

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

  const bundle = await req.provider.searchMetadata(query, params)
  const enrichmentEnabled = process.env.ENABLE_CROSS_PROVIDER_ENRICHMENT === 'true'
  if (!enrichmentEnabled || req.query.enrich === 'false') return bundle

  return enrichMetadata(bundle, await dbManager.catalogProviders())
}

export async function searchHandler(req: Request, res: Response): Promise<void> {
  try {
    const bundle = await search(req)
    res.json({ matches: absMatches(bundle) })
  } catch (error) {
    sendSearchError(error, res)
  }
}

function sendSearchError(error: unknown, res: Response): void {
  if (error instanceof InvalidSearchRequest) {
    res.status(400).json({ error: error.message, details: error.details.issues })
    return
  }

  console.error('Provider request failed:', error)
  res.status(500).json({ error: 'Metadata provider request failed' })
}
