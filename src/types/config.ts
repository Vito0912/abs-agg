import { z } from 'zod'
import { absBookSchema } from './abs'
import { ParameterValidator } from '../utils/validator'

export const validationRuleSchema = z.object({
  type: z.enum(['enum', 'regex', 'number', 'int', 'string']),
  values: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional()
})

export const providerParameterSchema = z
  .object({
    name: z.string().min(1),
    required: z.boolean(),
    description: z.string().optional(),
    default: z.union([z.string(), z.number()]).optional(),
    validation: validationRuleSchema
  })
  .superRefine((parameter, context) => {
    if (parameter.default === undefined) return

    const validation = ParameterValidator.validate(String(parameter.default), parameter.validation)
    if (!validation.valid) {
      context.addIssue({ code: 'custom', path: ['default'], message: validation.error || 'Invalid default value' })
    }
  })

export const providerConfigSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  provider: z.object({ name: z.string().min(1), url: z.url().optional() }),
  credits: z.array(z.object({ url: z.url() })).optional(),
  available: z.boolean().optional(),
  addToAudiobookshelf: z.boolean().optional(),
  description: z.string(),
  url: z.string(),
  parameters: z.array(providerParameterSchema),
  returnedFields: z.array(absBookSchema.keyof()),
  comments: z.array(z.string()),
  requiredEnv: z.array(z.string()).optional()
})
