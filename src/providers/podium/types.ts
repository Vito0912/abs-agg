import type { z } from 'zod'
import type { podiumBookSchema } from './schemas'

export type PodiumBook = z.infer<typeof podiumBookSchema>
