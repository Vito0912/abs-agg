export interface SeriesMetadata {
  series: string
  sequence?: string
}

export interface BookMetadata {
  title: string
  subtitle?: string
  author?: string
  narrator?: string
  publisher?: string
  publishedYear?: string
  description?: string
  cover?: string
  isbn?: string
  asin?: string
  bookId?: string
  genres?: string[]
  tags?: string[]
  series?: SeriesMetadata[]
  language?: string
  duration?: number
  poweredBy?: string
}

export interface SearchResult {
  matches: BookMetadata[]
}

export interface ValidationRule {
  type: 'enum' | 'regex' | 'number' | 'int' | 'string'
  values?: string[]
  pattern?: string
  min?: number
  max?: number
}

export interface ProviderParameter {
  name: string
  required: boolean
  validation: ValidationRule
  description?: string
}

export interface ProviderConfig {
  id: string
  name: string
  available?: boolean
  addToAudiobookshelf?: boolean
  description: string
  url: string
  parameters: ProviderParameter[]
  returnedFields: (keyof BookMetadata)[]
  comments: string[]
  requiredEnv?: string[]
}

export interface ParsedParameters {
  [key: string]: string | number
}
