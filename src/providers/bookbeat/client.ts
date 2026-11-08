import { httpClient } from '../../utils/httpClient'
import { bookBeatSearchSchema } from './schemas'
import type { BookBeatBook } from './types'

const marketIds: Readonly<Record<string, number>> = {
  austria: 43,
  belgium: 32,
  bulgaria: 359,
  croatia: 385,
  cyprus: 357,
  czechia: 420,
  denmark: 45,
  estonia: 372,
  finland: 358,
  france: 33,
  germany: 49,
  greece: 30,
  hungary: 36,
  ireland: 353,
  italy: 39,
  latvia: 371,
  lithuania: 370,
  luxembourg: 352,
  malta: 356,
  netherlands: 31,
  norway: 47,
  poland: 48,
  portugal: 351,
  romania: 40,
  slovakia: 421,
  slovenia: 386,
  spain: 34,
  sweden: 46,
  switzerland: 41,
  'united-kingdom': 44
}

export async function searchBookBeatBooks(
  title: string,
  market: string,
  includeErotic: boolean,
  limit: number
): Promise<BookBeatBook[]> {
  const marketId = marketIds[market]
  if (marketId === undefined) throw new Error('Unsupported BookBeat market')

  const response = await httpClient.get('https://search-api.bookbeat.com/api/appsearch/books', {
    params: { market: marketId, includeErotic, query: title, limit, v: 18 }
  })
  if (response.status !== 200) throw new Error(`BookBeat search error: ${response.status}`)

  const envelope = bookBeatSearchSchema.parse(response.data)

  return envelope._embedded.books.slice(0, limit)
}
