import type { z } from 'zod'
import type { overdriveFormatSchema, overdriveItemSchema } from './schemas'

export type OverdriveFormat = z.infer<typeof overdriveFormatSchema>
export type OverdriveItem = z.infer<typeof overdriveItemSchema>
