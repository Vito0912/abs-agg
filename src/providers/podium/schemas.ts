import { z } from 'zod'

const personSchema = z.object({
  name: z.union([z.string().min(1), z.array(z.string().min(1))])
})

export const podiumBookSchema = z.object({
  '@type': z.enum(['Audiobook', 'Book']),
  name: z.string().trim().min(1),
  url: z.url(),
  description: z.string().optional(),
  image: z.url().optional(),
  datePublished: z.string().optional(),
  genre: z.array(z.string()).optional(),
  publisher: z.object({ name: z.string() }).optional(),
  author: z.union([personSchema, z.array(personSchema)]).optional(),
  bookFormat: z.union([z.string(), z.array(z.string())]).optional(),
  isbn: z.string().optional()
})

export const podiumStructuredNodeSchema = z.object({
  '@type': z.string().optional(),
  '@graph': z.array(z.unknown()).optional()
})
