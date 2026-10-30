import { errorAttributes, logger } from '../../telemetry/logger'
import { z } from 'zod'
import type { BookMetadata, ParsedParameters } from '../../types'
import { mapConcurrent } from '../../utils/concurrency'
import { httpClient, UpstreamError } from '../../utils/httpClient'
import { markPartialResult } from '../../utils/requestContext'
import { BaseProvider } from '../BaseProvider'
import { parseSkoobeBook, parseSkoobeSearch } from './parser'

const searchTypes: Record<string, number> = { all: -1, ebook: 0, audiobook: 1 }
const origin = 'https://www.skoobe.de'
const headers = { Accept: 'text/html' }

export default class SkoobeProvider extends BaseProvider {
  protected async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limitDefault = this.config.parameters.find((parameter) => parameter.name === 'limit')?.default
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(6)
      .parse(params.limit ?? limitDefault)
    const typeDefault = this.config.parameters.find((parameter) => parameter.name === 'type')?.default
    const type = z.enum(['all', 'ebook', 'audiobook']).parse(params.type ?? typeDefault)
    const response = await httpClient.get(`${origin}/searchpage`, {
      params: { term: [title, author].filter(Boolean).join(' '), s_type: searchTypes[type] },
      headers,
      responseType: 'text'
    })
    if (response.status !== 200) throw new UpstreamError('Skoobe search failed', response.status)

    const paths = parseSkoobeSearch(z.string().parse(response.data), limit)
    const outcomes = await mapConcurrent(paths, 3, async (bookPath) => {
      try {
        const book = await this.cachedBook(bookPath, params, () => this.fetchDetails(bookPath))
        if (!book) markPartialResult()
        return { book }
      } catch (error) {
        markPartialResult()
        logger.error('Provider details failed', { provider: this.config.id, ...errorAttributes(error) })
        return { book: null, error }
      }
    })

    const books = outcomes.flatMap((outcome) => (outcome.book ? [outcome.book] : []))
    const failure = outcomes.find((outcome) => 'error' in outcome)
    if (!books.length && failure) throw failure.error

    return books
  }

  private async fetchDetails(bookPath: string): Promise<BookMetadata | null> {
    const response = await httpClient.get(`${origin}${bookPath}`, { headers, responseType: 'text' })
    if (response.status === 404) return null
    if (response.status !== 200) throw new UpstreamError('Skoobe book details failed', response.status)

    return parseSkoobeBook(z.string().parse(response.data))
  }
}
