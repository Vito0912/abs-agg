import type { z } from 'zod'
import type { graphicAudioBookSchema } from './schemas'

export type GraphicAudioBook = z.infer<typeof graphicAudioBookSchema>
