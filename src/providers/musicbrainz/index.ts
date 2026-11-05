import type { BookMetadata, ParsedParameters } from '../../types'
import { BaseProvider } from '../BaseProvider'
import { fetchRelease, searchReleases } from './client'
import { mapRelease } from './mapper'

export default class MusicBrainzProvider extends BaseProvider {
  protected async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Math.min(Math.max(Number(params.limit) || 5, 1), 10)
    const ids = await searchReleases(title, author, limit)
    const books: BookMetadata[] = []

    for (const id of ids) {
      const book = await this.getBookById(id, params)
      if (book) books.push(book)
    }

    return books
  }

  protected async fetchBook(id: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const release = await fetchRelease(id)

    return release ? mapRelease(release) : null
  }
}
