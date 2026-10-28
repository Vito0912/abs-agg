import { z } from 'zod'

export const ardImageSchema = z.object({
  url: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  url1X1: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  attribution: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardPublicationServiceSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  organizationName: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  genre: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  brandingColor: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardEditorialCategorySchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardProgramSetSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  numberOfElements: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  synopsis: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  sharingUrl: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: ardImageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publicationService: ardPublicationServiceSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  editorialCategories: z
    .object({
      nodes: z
        .array(ardEditorialCategorySchema)
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardProgramSetSearchResponseSchema = z.object({
  data: z
    .object({
      search: z
        .object({
          programSets: z
            .object({
              numberOfElements: z
                .number()

                .nullish()
                .transform((value) => value ?? undefined)
                .optional(),
              nodes: z
                .array(ardProgramSetSchema)
                .nullish()
                .transform((value) => value ?? undefined)
                .optional()
            })
            .nullish()
            .transform((value) => value ?? undefined)
            .optional()
        })
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardSearchItemSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  synopsis: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publicationStartDateAndTime: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  duration: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: ardImageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  programSet: ardProgramSetSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardSearchProgramSetSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  numberOfElements: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  synopsis: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: ardImageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  sharingUrl: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  publicationService: ardPublicationServiceSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  editorialCategories: z
    .object({
      nodes: z
        .array(ardEditorialCategorySchema)
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardSearchEditorialCollectionSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  title: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  numberOfElements: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  synopsis: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  broadcastDuration: z
    .number()

    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  image: ardImageSchema
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardSearchResponseSchema = z.object({
  data: z
    .object({
      search: z
        .object({
          items: z
            .object({
              numberOfElements: z
                .number()

                .nullish()
                .transform((value) => value ?? undefined)
                .optional(),
              nodes: z
                .array(ardSearchItemSchema)
                .nullish()
                .transform((value) => value ?? undefined)
                .optional()
            })
            .nullish()
            .transform((value) => value ?? undefined)
            .optional(),
          programSets: z
            .object({
              numberOfElements: z
                .number()

                .nullish()
                .transform((value) => value ?? undefined)
                .optional(),
              nodes: z
                .array(ardSearchProgramSetSchema)
                .nullish()
                .transform((value) => value ?? undefined)
                .optional()
            })
            .nullish()
            .transform((value) => value ?? undefined)
            .optional(),
          editorialCollections: z
            .object({
              numberOfElements: z
                .number()

                .nullish()
                .transform((value) => value ?? undefined)
                .optional(),
              nodes: z
                .array(ardSearchEditorialCollectionSchema)
                .nullish()
                .transform((value) => value ?? undefined)
                .optional()
            })
            .nullish()
            .transform((value) => value ?? undefined)
            .optional(),
          editorialCategories: z
            .object({
              numberOfElements: z
                .number()

                .nullish()
                .transform((value) => value ?? undefined)
                .optional(),
              nodes: z
                .array(ardEditorialCategorySchema)
                .nullish()
                .transform((value) => value ?? undefined)
                .optional()
            })
            .nullish()
            .transform((value) => value ?? undefined)
            .optional()
        })
        .nullish()
        .transform((value) => value ?? undefined)
        .optional()
    })
    .nullish()
    .transform((value) => value ?? undefined)
    .optional()
})

export const ardSearchTypeSchema = z.union([z.literal('search'), z.literal('programsets')])
