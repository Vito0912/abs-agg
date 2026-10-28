import { mapConcurrent } from '../../utils/concurrency'
import { z } from 'zod'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { deezerAlbumDetailsSchema, deezerSearchAlbumSchema } from './schemas'
import type { DeezerAlbumDetails, DeezerSearchAlbum } from './types'

export default class DeezerProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const accessToken = process.env.DEEZER_ACCESS_TOKEN
    const authParam = accessToken ? `&access_token=${encodeURIComponent(accessToken)}` : ''

    const limit = Math.min(Number(params.limit) || 5, 10)

    let query = author ? `artist:"${author}" album:"${title}"` : `album:"${title}"`
    let searchUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=${limit}${authParam}`

    let searchRes = await httpClient.get(searchUrl)
    let albums: DeezerSearchAlbum[] =
      searchRes.status === 200 ? z.object({ data: deezerSearchAlbumSchema.array() }).parse(searchRes.data).data : []

    if (albums.length === 0) {
      const fallbackQuery = author ? `${title} ${author}` : title
      searchUrl = `https://api.deezer.com/search/album?q=${encodeURIComponent(fallbackQuery)}&limit=${limit}${authParam}`
      searchRes = await httpClient.get(searchUrl)
      albums =
        searchRes.status === 200 ? z.object({ data: deezerSearchAlbumSchema.array() }).parse(searchRes.data).data : []
    }

    const books = await mapConcurrent(albums.slice(0, limit), 3, (album) => {
      return this.getBookById(String(album.id), params)
    })

    return books.filter((book): book is BookMetadata => book !== null)
  }

  protected async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    if (!/^\d+$/.test(bookId)) throw new Error('Invalid Deezer album ID')

    const token = process.env.DEEZER_ACCESS_TOKEN
    const response = await httpClient.get<DeezerAlbumDetails>(`https://api.deezer.com/album/${bookId}`, {
      params: token ? { access_token: token } : undefined
    })

    if (response.status === 404) return null
    if (response.status !== 200) throw new Error(`Deezer details error: ${response.status}`)

    return this.mapDeezerToMetadata(deezerAlbumDetailsSchema.parse(response.data))
  }

  private mapDeezerToMetadata(album: DeezerAlbumDetails): BookMetadata {
    const publishedYear = album.release_date ? album.release_date.slice(0, 4) : undefined
    const coverUrl = album.cover_xl || album.cover_big || album.cover_medium || album.cover
    const genres = album.genres?.data?.map((g) => g.name?.trim()).filter((name): name is string => Boolean(name))

    return normalizeBookMetadata({
      title: album.title,
      author: album.artist?.name,
      publisher: album.label,
      publishedYear,
      cover: coverUrl,
      genres: genres && genres.length > 0 ? genres : undefined,
      durationSeconds: album.duration,
      contributors: album.artist?.name
        ? [{ name: album.artist.name, role: 'author', sourceId: String(album.artist.id) }]
        : [],
      bookId: String(album.id),
      poweredBy: this.config.id
    })
  }
}
