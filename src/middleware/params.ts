import type { Request, Response, NextFunction } from 'express'
import { providerRegistry } from '../providers/ProviderRegistry'
import { ParameterValidator } from '../utils/validator'
import type { ParsedParameters } from '../types'

export function parseProviderParams(req: Request, res: Response, next: NextFunction): void {
  const { providerId, params } = req.params
  const provider = providerRegistry.get(typeof providerId === 'string' ? providerId : '')

  if (!provider) {
    res.status(404).json({ error: `Provider not found: ${providerId}` })
    return
  }

  const config = provider.getConfig()
  const parsedParams: ParsedParameters = {}
  const paramString = Array.isArray(params) ? params : []

  const paramPairs: { name: string; value: string }[] = []
  for (const segment of paramString) {
    const colonIndex = segment.indexOf(':')
    if (colonIndex <= 0 || colonIndex === segment.length - 1) {
      res.status(400).json({ error: `Invalid provider parameter: ${segment}` })
      return
    }

    const name = segment.slice(0, colonIndex)
    const value = segment.slice(colonIndex + 1)
    if (paramPairs.some((parameter) => parameter.name === name)) {
      res.status(400).json({ error: `Duplicate provider parameter: ${name}` })
      return
    }

    paramPairs.push({ name, value })
  }

  const providedParamNames = new Set(paramPairs.map((p) => p.name))

  for (const paramDef of config.parameters) {
    const paramPair = paramPairs.find((p) => p.name === paramDef.name)

    if (!paramPair) {
      if (paramDef.default !== undefined) {
        const validation = ParameterValidator.validate(String(paramDef.default), paramDef.validation)
        if (validation.parsedValue !== undefined) parsedParams[paramDef.name] = validation.parsedValue
      } else if (paramDef.required) {
        res.status(400).json({
          error: `Missing required parameter: ${paramDef.name}`
        })
        return
      }
      continue
    }

    const validation = ParameterValidator.validate(paramPair.value, paramDef.validation)

    if (!validation.valid) {
      res.status(400).json({
        error: `Invalid parameter ${paramDef.name}: ${validation.error}`
      })
      return
    }

    if (validation.parsedValue !== undefined) {
      parsedParams[paramDef.name] = validation.parsedValue
    }
  }

  const validParamNames = new Set(config.parameters.map((p) => p.name))
  for (const paramName of providedParamNames) {
    if (!validParamNames.has(paramName)) {
      res.status(400).json({
        error: `Unknown parameter: ${paramName}`
      })
      return
    }
  }

  req.parsedParams = parsedParams
  req.provider = provider
  next()
}

declare global {
  namespace Express {
    interface Request {
      parsedParams?: ParsedParameters
      provider?: import('../providers/BaseProvider').BaseProvider
    }
  }
}
