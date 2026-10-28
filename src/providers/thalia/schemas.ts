import { z } from 'zod'
import { ProduzentTyp } from './types'

const imageSchema = z.object({ uri: z.string(), width: z.number(), height: z.number() })
const personSchema = z.object({
  identNr: z.number().optional(),
  name: z.string(),
  typ: z.enum(ProduzentTyp),
  portrait: z.string().optional()
})
export const thaliaResponseSchema = z.object({
  uuid: z.string(),
  artikelliste: z.array(
    z.object({
      identifier: z.object({
        ean: z.string(),
        isbn13: z.string().optional(),
        isbn10: z.string().optional(),
        matnr: z.string(),
        mandantId: z.number()
      }),
      titel: z.string(),
      personen: personSchema.array().optional(),
      serie: z
        .object({
          name: z.string(),
          nummer: z.string().optional(),
          hatSerienslider: z.boolean(),
          teilString: z.string().optional(),
          link: z.string()
        })
        .optional(),
      link: z.string(),
      coverbild: z.object({
        klein: imageSchema,
        liste: imageSchema,
        listeGross: imageSchema,
        gross: imageSchema,
        ereader: imageSchema,
        ereaderGross: imageSchema
      }),
      erscheinungsdatum: z.object({ jahr: z.number(), monat: z.number(), tag: z.number().optional() }).optional(),
      formatbezeichnung: z.string(),
      anzahlSeiten: z.string().optional(),
      shop: z.object({ identNr: z.number(), label: z.string(), name: z.string() }),
      produzent: personSchema.optional()
    })
  )
})
