import type { z } from 'zod'
import type { audibleProductSchema, audibleRegionSchema } from './schemas'

export type AudibleProduct = z.infer<typeof audibleProductSchema>
export type AudibleRegion = z.infer<typeof audibleRegionSchema>
