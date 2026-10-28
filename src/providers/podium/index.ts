import { z } from 'zod'
import type { BookMetadata, ParsedParameters } from '../../types'
import { mapConcurrent } from '../../utils/concurrency'
import { httpClient, UpstreamError } from '../../utils/httpClient'
import { markPartialResult } from '../../utils/requestContext'
import { BaseProvider } from '../BaseProvider'
import { parsePodiumBook, parsePodiumSearch, podiumOrigin, podiumTitlePath } from './parser'

const headers = { Accept: 'text/html' }

export default class PodiumProvider extends BaseProvider {
  protected async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limitDefault = this.config.parameters.find((parameter) => parameter.name === 'limit')?.default
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(20)
      .parse(params.limit ?? limitDefault)
    const response = await httpClient.get(`${podiumOrigin}/titles`, {
      params: { q: [title, author].filter(Boolean).join(' ') },
      headers,
      responseType: 'text'
    })
    if (response.status !== 200) throw new UpstreamError('Podium search failed', response.status)

    const paths = parsePodiumSearch(z.string().parse(response.data), limit)
    const outcomes = await mapConcurrent(paths, 3, async (path) => {
      try {
        const book = await this.cachedBook(path.split('/')[2], params, () => this.fetchDetails(path))
        if (!book) markPartialResult()

        return { book }
      } catch (error) {
        markPartialResult()
        console.error(`Podium details failed for ${path}:`, error)
        return { book: null, error }
      }
    })

    const books = outcomes.flatMap((outcome) => (outcome.book ? [outcome.book] : []))
    const failure = outcomes.find((outcome) => 'error' in outcome)
    if (!books.length && failure) throw failure.error

    return books
  }

  private async fetchDetails(path: string): Promise<BookMetadata | null> {
    const titlePath = podiumTitlePath(path)
    const response = await httpClient.get(`${podiumOrigin}${titlePath}`, { headers, responseType: 'text' })
    if (response.status === 404) return null
    if (response.status !== 200) throw new UpstreamError('Podium title details failed', response.status)

    return parsePodiumBook(z.string().parse(response.data), titlePath)
  }
}
