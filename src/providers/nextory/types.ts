import type { z } from 'zod'
import type { nextoryFormatSchema, nextoryProductSchema } from './schemas'

export type NextoryFormat = z.infer<typeof nextoryFormatSchema>
export type NextoryProduct = z.infer<typeof nextoryProductSchema>
