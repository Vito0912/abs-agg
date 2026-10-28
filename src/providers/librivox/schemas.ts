import { z } from 'zod'

export const librivoxAuthorSchema = z.object({
  id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  dob: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  dod: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const librivoxSectionSchema = z.object({
  id: z.string(),
  section_number: z.string(),
  title: z.string(),
  listen_url: z.string(),
  language: z.string(),
  playtime: z.string(),
  file_name: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  readers: z
    .array(
      z.object({
        reader_id: z.string(),
        display_name: z.string()
      })
    )
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const librivoxGenreSchema = z.object({
  id: z.string(),
  name: z.string()
})

export const librivoxBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_text_source: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  language: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  copyright_year: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  num_sections: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_rss: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_zip_file: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_project: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_librivox: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_iarchive: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url_other: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  totaltime: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  totaltimesecs: z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  authors: z
    .array(librivoxAuthorSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  coverart_jpg: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  coverart_pdf: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  coverart_thumbnail: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  sections: z
    .array(librivoxSectionSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  genres: z
    .array(librivoxGenreSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  translators: z
    .array(librivoxAuthorSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const librivoxApiResponseSchema = z.object({
  books: z
    .array(librivoxBookSchema)
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})
