import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { ardProgramSetSearchResponseSchema, ardSearchResponseSchema } from './schemas'
import type { ArdProgramSet, ArdSearchItem, ArdSearchProgramSet, ArdSearchResponse } from './types'

const ARD_API_BASE = 'https://api.ardaudiothek.de'

export default class ArdAudiothekProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Math.min(Number(params.limit) || 5, 20)
    const searchType = params.searchType === 'programsets' ? 'programsets' : 'search'

    if (searchType === 'programsets') {
      return this.searchProgramSets(title, limit)
    }

    return this.searchGeneral(title, limit)
  }

  private async searchGeneral(title: string, limit: number): Promise<BookMetadata[]> {
    const searchUrl = `${ARD_API_BASE}/search?query=${encodeURIComponent(title)}&offset=0&limit=${limit}`

    const searchRes = await httpClient.get(searchUrl)
    if (searchRes.status !== 200) {
      throw new Error(`ARD Audiothek API error: ${searchRes.status}`)
    }
    const searchJson = ardSearchResponseSchema.parse(searchRes.data)

    return this.mapGeneralSearchResults(searchJson, limit)
  }

  private mapGeneralSearchResults(searchJson: ArdSearchResponse, limit: number): BookMetadata[] {
    const books: BookMetadata[] = []
    const search = searchJson.data?.search

    const programSets = search?.programSets?.nodes
    if (programSets) {
      for (const item of programSets) {
        const metadata = this.mapSearchProgramSetToMetadata(item)
        if (metadata.title) {
          books.push(metadata)
        }
      }
    }

    const items = search?.items?.nodes
    if (items) {
      for (const item of items) {
        const metadata = this.mapSearchItemToMetadata(item)
        if (metadata.title) {
          books.push(metadata)
        }
      }
    }

    return books.slice(0, limit)
  }

  private mapSearchProgramSetToMetadata(item: ArdSearchProgramSet): BookMetadata {
    const imageUrl = item.image?.url1X1?.replace('{width}', '1200') || item.image?.url?.replace('{width}', '1200')
    const { cleanTitle, authorName } = this.parseTitle(item.title || '')

    const genres: string[] = []
    if (item.publicationService?.genre) {
      genres.push(item.publicationService.genre)
    }

    const tags: string[] = []
    if (item.editorialCategories?.nodes) {
      for (const category of item.editorialCategories.nodes) {
        if (category.title) {
          tags.push(category.title.trim())
        }
      }
    }

    return normalizeBookMetadata({
      title: cleanTitle,
      bookId: item.id ? `programset:${item.id}` : undefined,
      sourceUrl: item.sharingUrl,
      format: 'audiobook',
      author: authorName,
      description: item.synopsis,
      cover: imageUrl,
      publisher: item.publicationService?.organizationName || 'ARD',
      genres: genres.length > 0 ? genres : undefined,
      tags: tags.length > 0 ? tags : undefined,
      language: 'de'
    })
  }

  private mapSearchItemToMetadata(item: ArdSearchItem): BookMetadata {
    const imageUrl = item.image?.url1X1?.replace('{width}', '1200') || item.image?.url?.replace('{width}', '1200')
    const { cleanTitle, authorName } = this.parseTitle(item.title || '')

    const genres: string[] = []
    if (item.programSet?.publicationService?.genre) {
      genres.push(item.programSet.publicationService.genre)
    }

    const tags: string[] = []
    if (item.programSet?.editorialCategories?.nodes) {
      for (const category of item.programSet.editorialCategories.nodes) {
        if (category.title) {
          tags.push(category.title.trim())
        }
      }
    }

    const series = item.programSet?.title
      ? [{ series: item.programSet.title, sourceId: item.programSet.id, sequence: undefined }]
      : undefined

    return normalizeBookMetadata({
      title: cleanTitle,
      bookId: item.id ? `item:${item.id}` : undefined,
      format: 'audiobook',
      author: authorName,
      description: item.synopsis,
      cover: imageUrl,
      publisher: item.programSet?.publicationService?.organizationName || 'ARD',
      genres: genres.length > 0 ? genres : undefined,
      tags: tags.length > 0 ? tags : undefined,
      series: series,
      durationSeconds: item.duration,
      language: 'de'
    })
  }

  private async searchProgramSets(title: string, limit: number): Promise<BookMetadata[]> {
    const searchUrl = `${ARD_API_BASE}/search/programsets?query=${encodeURIComponent(title)}`

    const searchRes = await httpClient.get(searchUrl)
    if (searchRes.status !== 200) {
      throw new Error(`ARD Audiothek API error: ${searchRes.status}`)
    }
    const searchJson = ardProgramSetSearchResponseSchema.parse(searchRes.data)
    const searchResults = searchJson.data?.search?.programSets?.nodes || []

    const books: BookMetadata[] = []

    for (const item of searchResults.slice(0, limit)) {
      const metadata = this.mapArdToMetadata(item)
      if (metadata.title) {
        books.push(metadata)
      }
    }

    return books
  }

  private mapArdToMetadata(item: ArdProgramSet): BookMetadata {
    const { cleanTitle, authorName } = this.parseTitle(item.title || '')

    const description = item.synopsis

    let coverUrl: string | undefined
    const imageTemplateUrl = item.image?.url1X1 || item.image?.url
    if (imageTemplateUrl) {
      coverUrl = imageTemplateUrl.replace('{width}', '1200')
    }

    const publisher = item.publicationService?.organizationName || 'ARD'

    const genres: string[] = []
    const publicationGenre = item.publicationService?.genre
    if (publicationGenre) {
      genres.push(publicationGenre)
    }

    const tags: string[] = []
    if (item.editorialCategories?.nodes) {
      for (const category of item.editorialCategories.nodes) {
        if (category.title) {
          tags.push(category.title.trim())
        }
      }
    }

    const series = cleanTitle
      ? [
          {
            series: cleanTitle,
            sourceId: item.id,
            sequence: undefined
          }
        ]
      : undefined

    return normalizeBookMetadata({
      title: cleanTitle,
      bookId: item.id ? `programset:${item.id}` : undefined,
      sourceUrl: item.sharingUrl,
      format: 'audiobook',
      author: authorName,
      description: description,
      cover: coverUrl,
      publisher: publisher,
      genres: genres.length > 0 ? genres : undefined,
      tags: tags.length > 0 ? tags : undefined,
      series: series,
      language: 'de'
    })
  }

  private parseTitle(rawTitle: string): { cleanTitle: string; authorName?: string } {
    const cleaned = rawTitle.replace(/[„"""\u201c\u201d\u201e\u201f»«]/g, '').trim()
    let authorName: string | undefined
    let cleanTitle = cleaned

    if (cleaned.includes(' von ')) {
      const parts = cleaned.split(' von ')
      if (parts.length > 1) {
        cleanTitle = parts[0].trim()
        authorName = parts[1].trim()
      }
    } else if (cleaned.includes(': ')) {
      const parts = cleaned.split(': ')
      if (parts.length > 1) {
        const potentialAuthor = parts[0].trim()
        if (potentialAuthor.length < 50 && !this.looksLikeTitle(potentialAuthor)) {
          authorName = potentialAuthor
          cleanTitle = parts.slice(1).join(': ').trim()
        }
      }
    } else if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ')
      if (parts.length === 2) {
        cleanTitle = parts[0].trim()
        authorName = parts[1].trim()
      }
    }

    return { cleanTitle, authorName }
  }

  private looksLikeTitle(str: string): boolean {
    const titleIndicators = [
      'die ',
      'der ',
      'das ',
      'ein ',
      'eine ',
      'teil ',
      'folge ',
      'staffel ',
      'episode ',
      'kapitel '
    ]
    const lowerStr = str.toLowerCase()
    return titleIndicators.some((indicator) => lowerStr.startsWith(indicator) || lowerStr.includes(` ${indicator}`))
  }
}
