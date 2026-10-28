import { z } from 'zod'
import { httpClient } from '../../utils/httpClient'
import { BOOK_DETAILS_QUERY, HARDCOVER_API_URL, SEARCH_QUERY } from './queries'
import { hardcoverBooksResponseSchema, hardcoverSearchResponseSchema } from './schemas'
import type { HardcoverBook } from './types'

export class HardcoverClient {
  constructor(private readonly token: string) {}

  async searchIds(title: string, author: string | null, limit: number): Promise<number[]> {
    const query = author ? `${title} ${author}` : title
    const response = await this.request(SEARCH_QUERY, { query, perPage: limit, page: 1 })
    const data = hardcoverSearchResponseSchema.parse(response)

    return (data.search?.ids || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
  }

  async books(ids: number[]): Promise<HardcoverBook[]> {
    const response = await this.request(BOOK_DETAILS_QUERY, { ids })
    return hardcoverBooksResponseSchema.parse(response).books || []
  }

  private async request(query: string, variables: Record<string, unknown>): Promise<unknown> {
    const response = await httpClient.post<unknown>(
      HARDCOVER_API_URL,
      { query, variables },
      {
        headers: { authorization: `Bearer ${this.token}` }
      }
    )

    if (response.status !== 200) throw new Error(`Hardcover API error: ${response.status}`)

    const envelope = z
      .object({
        data: z.unknown().optional(),
        errors: z.array(z.object({ message: z.string() })).optional()
      })
      .parse(response.data)

    if (envelope.errors?.length) {
      throw new Error(`Hardcover GraphQL error: ${envelope.errors.map((error) => error.message).join('; ')}`)
    }

    return envelope.data
  }
}
