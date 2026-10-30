import { z } from 'zod'
import { entityKindSchema, identifierSchema, metadataBundleSchema } from '../types/metadata'

const storeBundleSchema = z.object({
  operation: z.literal('storeBundle'),
  key: z.string(),
  provider: z.string(),
  bundle: metadataBundleSchema,
  generation: z.number().int(),
  startedAt: z.number().int(),
  freshUntil: z.number().int(),
  staleUntil: z.number().int(),
  errorUntil: z.number().int()
})

export const databaseCommandSchema = z.discriminatedUnion('operation', [
  storeBundleSchema,
  z.object({
    operation: z.literal('ingestMetadata'),
    bundle: metadataBundleSchema,
    generation: z.number().int(),
    startedAt: z.number().int()
  }),
  z.object({ operation: z.literal('generation') }),
  z.object({ operation: z.literal('readBundle'), key: z.string() }),
  z.object({ operation: z.literal('deleteEntry'), key: z.string() }),
  z.object({ operation: z.literal('readCatalog'), key: z.string() }),
  z.object({
    operation: z.literal('claimCatalogRefresh'),
    key: z.string(),
    provider: z.string(),
    now: z.number().int(),
    nextAllowedAt: z.number().int()
  }),
  z.object({
    operation: z.literal('storeCatalog'),
    key: z.string(),
    provider: z.string(),
    bundle: metadataBundleSchema,
    generation: z.number().int(),
    startedAt: z.number().int(),
    freshUntil: z.number().int(),
    errorUntil: z.number().int()
  }),
  z.object({
    operation: z.literal('searchCandidates'),
    title: z.string().max(500),
    kinds: z.array(entityKindSchema),
    providers: z.array(z.string()),
    limit: z.number().int().min(1).max(300)
  }),
  z.object({
    operation: z.literal('loadEntities'),
    ids: z.array(z.string()).max(5000),
    providers: z.array(z.string())
  }),
  z.object({ operation: z.literal('findIdentifier'), identifier: identifierSchema, providers: z.array(z.string()) }),
  z.object({ operation: z.literal('stats') }),
  z.object({ operation: z.literal('catalogProviders') }),
  z.object({
    operation: z.literal('prune'),
    now: z.number().int()
  }),
  z.object({ operation: z.literal('clear'), provider: z.string().optional(), catalog: z.boolean() }),
  z.object({ operation: z.literal('close') })
])

export const databaseRequestSchema = z.object({ id: z.number().int(), command: databaseCommandSchema })
export const databaseReadySchema = z.object({ type: z.literal('database-ready') })
export const databaseReplySchema = z.discriminatedUnion('ok', [
  z.object({ id: z.number().int(), ok: z.literal(true), value: z.unknown() }),
  z.object({
    id: z.number().int(),
    ok: z.literal(false),
    error: z.string(),
    code: z.enum(['invalid-cache', 'database'])
  })
])
export const cachedBundleSchema = z.object({
  bundle: metadataBundleSchema,
  freshUntil: z.number(),
  staleUntil: z.number(),
  errorUntil: z.number()
})
export const cachedCatalogSchema = z.object({
  bundle: metadataBundleSchema,
  fresh_until: z.number(),
  error_until: z.number()
})
export const catalogManifestSchema = z.object({
  normalized: z.literal(true),
  entityCount: z.number().int().nonnegative(),
  matchCount: z.number().int().nonnegative(),
  complete: z.boolean()
})
export const databaseStatsSchema = z.object({
  entries: z.number(),
  entities: z.number(),
  snapshots: z.number(),
  catalogs: z.number()
})

export type DatabaseCommand = z.infer<typeof databaseCommandSchema>
export type StoreBundleCommand = z.infer<typeof storeBundleSchema>
export type SearchCandidatesCommand = Extract<DatabaseCommand, { operation: 'searchCandidates' }>
export type StoreCatalogCommand = Extract<DatabaseCommand, { operation: 'storeCatalog' }>
