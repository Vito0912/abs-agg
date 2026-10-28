import { z } from 'zod'

export const dreifragChapterSchema = z.object({
  titel: z.string(),
  start: z.number(),
  end: z.number()
})

export const dreifragRoleSchema = z.object({
  rolle: z.string(),
  sprecher: z.string(),
  pseudonym: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const dreifragLinksSchema = z.object({
  json: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cover: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cover_itunes: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  cover_kosmos: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  dreifragezeichen: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  spotify: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  appleMusic: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  bookbeat: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  amazonMusic: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  amazon: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  youTubeMusic: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  deezer: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const dreifragEpisodeSchema = z.object({
  nummer: z.number(),
  titel: z.string(),
  autor: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  hörspielskriptautor: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  gesamtbeschreibung: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  beschreibung: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  veröffentlichungsdatum: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  gesamtdauer: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  kapitel: z
    .array(dreifragChapterSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  sprechrollen: z
    .array(dreifragRoleSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  links: dreifragLinksSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const dreifragDataSchema = z.object({
  serie: z.array(dreifragEpisodeSchema)
})

export const dreifragSpezialEpisodeSchema = z.object({
  titel: z.string(),
  autor: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  hörspielskriptautor: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  gesamtbeschreibung: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  beschreibung: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  metabeschreibung: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  veröffentlichungsdatum: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  gesamtdauer: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  kapitel: z
    .array(dreifragChapterSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  sprechrollen: z
    .array(dreifragRoleSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  links: dreifragLinksSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const dreifragSpezialDataSchema = z.object({
  spezial: z.array(dreifragSpezialEpisodeSchema)
})

export const dreifragKidsDataSchema = z.object({
  kids: z.array(dreifragEpisodeSchema)
})

export const dreifragSourceSchema = z.union([z.literal('serie'), z.literal('spezial'), z.literal('kids')])

export const dreifragScoredItemSchema = z.object({
  source: dreifragSourceSchema,
  score: z.number(),
  ep: z.union([dreifragEpisodeSchema, dreifragSpezialEpisodeSchema])
})
