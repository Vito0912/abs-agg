import type { z } from 'zod'
import type { skoobeBookSchema } from './schemas'

export type SkoobeBook = z.infer<typeof skoobeBookSchema>
