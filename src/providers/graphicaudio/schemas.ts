import { z } from 'zod'

export const graphicAudioBookSchema = z.object({
  link: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cover: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  seriesName: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  rawtitle: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  episodeNumber: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  episodePart: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  episodeCode: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  totalParts: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  subtitle: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  author: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  releaseDate: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  isbn: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  genre: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  copyright: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cast: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  asin: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
