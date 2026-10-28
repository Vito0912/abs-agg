import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { thaliaResponseSchema } from './schemas'
import type { ThaliaSearchResult } from './types'

export default class ThaliaProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Math.min(Number(params.limit) || 5, 30)

    const searchUrl = `https://app.thalia.de/api/rest/suche/v5/?suchbegriff=${encodeURIComponent(title.replace(/\s+/g, '+'))}&gewuenschteSeite=1&artikelServiceAufrufen=true&anzahlArtikelProSeite=${limit}`

    const searchRes = await httpClient.get(searchUrl)
    if (searchRes.status !== 200) throw new Error('Thalia search API error')
    const searchJson = thaliaResponseSchema.parse(searchRes.data)
    const searchResults = searchJson.artikelliste || []

    const audiobookFilter: string[] = ['Hörbuch', 'Hörspiel', 'Audiobook']
    const bookFilter: string[] = ['Buch', 'eBook', 'E-Book', 'Taschenbuch', 'Hardcover']

    const books: BookMetadata[] = []
    for (const result of searchResults
      .filter((f) =>
        params.type
          ? (audiobookFilter.some((format) => f.formatbezeichnung.includes(format)) && params.type === 'audiobook') ||
            (bookFilter.some((format) => f.formatbezeichnung.includes(format)) && params.type === 'ebook') ||
            (bookFilter.concat(audiobookFilter).some((format) => f.formatbezeichnung.includes(format)) &&
              params.type === 'all')
          : true
      )
      .slice(0, limit)) {
      const metadata = this.mapThaliaToMetadata(result)
      if (metadata.title) {
        books.push(metadata)
      }
    }

    return books
  }

  private mapThaliaToMetadata(result: ThaliaSearchResult): BookMetadata {
    return normalizeBookMetadata({
      title: result.titel,
      bookId: result.identifier.matnr,
      format: result.formatbezeichnung.includes('Hör') ? 'audiobook' : undefined,
      author: result.personen
        ?.filter((person) => person.typ === 'Autor')
        .map((person) => person.name)
        .join(', '),
      narrator: result.personen
        ?.filter((person) => person.typ === 'Sprecher')
        .map((person) => person.name)
        .join(', '),
      isbn: result.identifier.isbn13 || result.identifier.isbn10,
      cover: result.coverbild.gross?.uri,
      publishedYear: result.erscheinungsdatum?.jahr,
      series: result.serie ? [{ series: result.serie.name, sequence: result.serie.nummer }] : undefined
    })
  }
}
