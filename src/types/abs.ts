import { bookMetadataSchema } from './providerBook'
import { metadataBundleSchema } from './metadata'
import { z } from 'zod'

export const absBookSchema = bookMetadataSchema.extend({ metadata: metadataBundleSchema })
export type AbsBook = z.infer<typeof absBookSchema>
