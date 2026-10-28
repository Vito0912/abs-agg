import type { ValidationRule } from '../types'

export class ParameterValidator {
  static validate(
    value: string,
    rule: ValidationRule
  ): { valid: boolean; parsedValue?: string | number; error?: string } {
    switch (rule.type) {
      case 'enum':
        return this.validateEnum(value, rule)
      case 'regex':
        return this.validateRegex(value, rule)
      case 'number':
        return this.validateNumber(value, rule, false)
      case 'int':
        return this.validateNumber(value, rule, true)
      case 'string':
        return this.validateString(value, rule)
      default:
        return { valid: false, error: 'Unknown validation type' }
    }
  }

  private static validateEnum(
    value: string,
    rule: ValidationRule
  ): { valid: boolean; parsedValue?: string; error?: string } {
    if (!rule.values || rule.values.length === 0) {
      return { valid: false, error: 'Enum values not defined' }
    }
    if (rule.values.includes(value)) {
      return { valid: true, parsedValue: value }
    }
    return { valid: false, error: `Value must be one of: ${rule.values.join(', ')}` }
  }

  private static validateRegex(
    value: string,
    rule: ValidationRule
  ): { valid: boolean; parsedValue?: string; error?: string } {
    if (!rule.pattern) {
      return { valid: false, error: 'Regex pattern not defined' }
    }
    try {
      const regex = new RegExp(rule.pattern)
      if (regex.test(value)) {
        return { valid: true, parsedValue: value }
      }
      return { valid: false, error: `Value does not match pattern: ${rule.pattern}` }
    } catch (e) {
      return { valid: false, error: 'Invalid regex pattern' }
    }
  }

  private static validateNumber(
    value: string,
    rule: ValidationRule,
    intOnly: boolean
  ): { valid: boolean; parsedValue?: number; error?: string } {
    const num = Number(value)
    if (!Number.isFinite(num)) {
      return { valid: false, error: 'Value must be a number' }
    }
    if (intOnly && !Number.isSafeInteger(num)) {
      return { valid: false, error: 'Value must be an integer' }
    }
    if (rule.min !== undefined && num < rule.min) {
      return { valid: false, error: `Value must be at least ${rule.min}` }
    }
    if (rule.max !== undefined && num > rule.max) {
      return { valid: false, error: `Value must be at most ${rule.max}` }
    }
    return { valid: true, parsedValue: num }
  }

  private static validateString(
    value: string,
    rule: ValidationRule
  ): { valid: boolean; parsedValue?: string; error?: string } {
    if (rule.min !== undefined && value.length < rule.min) {
      return { valid: false, error: `Value must be at least ${rule.min} characters` }
    }
    if (rule.max !== undefined && value.length > rule.max) {
      return { valid: false, error: `Value must be at most ${rule.max} characters` }
    }
    return { valid: true, parsedValue: value }
  }
}
