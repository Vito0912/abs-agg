import type { z } from 'zod'
import type { validationRuleSchema, providerParameterSchema, providerConfigSchema } from './config'
import type { EntityKind } from './metadata'

export type ValidationRule = z.infer<typeof validationRuleSchema>
export type ProviderParameter = z.infer<typeof providerParameterSchema>
export type ProviderConfig = z.infer<typeof providerConfigSchema>
export type CacheMode = 'default' | 'refresh' | 'disabled'
export type ParsedParameters = Record<string, string | number>

export interface MetadataQuery {
  title: string
  author?: string
  kind?: EntityKind
  limit?: number
}
