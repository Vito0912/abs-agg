import { z } from 'zod'

const personSchema = z.object({ name: z.string().trim().min(1) })
const peopleSchema = z.union([personSchema, z.array(personSchema)]).transform((value) => {
  return Array.isArray(value) ? value : [value]
})

export const skoobeGraphSchema = z.object({ '@graph': z.array(z.record(z.string(), z.unknown())) })

export const skoobeBookSchema = z.object({
  '@type': z.enum(['Book', 'Audiobook']),
  name: z.string().trim().min(1),
  bookFormat: z.string().optional(),
  author: peopleSchema.optional(),
  readBy: peopleSchema.optional(),
  datePublished: z.string().optional(),
  description: z.string().optional(),
  genre: z.array(z.string()).optional(),
  image: z.url().optional(),
  inLanguage: z.string().optional(),
  numberOfPages: z.number().int().positive().optional(),
  publisher: personSchema.optional(),
  duration: z.string().optional(),
  isbn: z.string().optional()
})
