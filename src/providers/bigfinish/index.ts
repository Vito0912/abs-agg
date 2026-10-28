import { z } from 'zod'
import type { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { bigFinishReleaseDataSchema, bigFinishSearchResponseSchema } from './schemas'
import type { BigFinishReleaseData, BigFinishSearchResult, NamedContributor, ParsedBookData } from './types'

const BASE_URL = 'https://www.bigfinish.com'
const SEARCH_URL = `${BASE_URL}/api/search`

const SEARCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  Origin: BASE_URL,
  Connection: 'keep-alive'
}

const RSC_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  rsc: '1'
}

export default class BigFinishProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async searchBooks(title: string, _author: string | null, params: ParsedParameters): Promise<BookMetadata[]> {
    const limit = Math.min(Number(params.limit) || 3, 5)

    const query = title.replace(/:/g, ' ')

    const searchRes = await httpClient.post(SEARCH_URL, { q: query, limit, offset: 0 }, { headers: SEARCH_HEADERS })

    if (searchRes.status !== 200) {
      throw new Error(`Big Finish search API error: ${searchRes.status}`)
    }

    const searchData = bigFinishSearchResponseSchema.parse(searchRes.data)
    const hits = (searchData.hits.filter((hit) => hit.indexUid == 'audiobook_models') ?? []).slice(0, limit)

    const books: BookMetadata[] = []

    for (const hit of hits) {
      if (!hit.release_slug) continue

      const productUrl = `${BASE_URL}/releases/v/${hit.release_slug}`

      const metadata = await this.cachedBook(productUrl, params, async () => {
        const pageRes = await httpClient.get(productUrl, {
          headers: RSC_HEADERS,
          responseType: 'text'
        })

        if (pageRes.status !== 200) throw new Error(`Big Finish details error: ${pageRes.status}`)

        const rsc = String(pageRes.data)
        const bookData = this.parseProductPage(productUrl, rsc, hit)
        return bookData ? this.mapToMetadata(bookData) : null
      })

      if (metadata?.title) books.push(metadata)
    }

    return books
  }

  private parseProductPage(url: string, rsc: string, hit: BigFinishSearchResult): ParsedBookData | null {
    const releaseData = this.extractReleaseData(rsc)
    if (!releaseData) return null

    const titleParts = this.extractTitleParts(releaseData.title || hit.name)
    const castNarrators = releaseData.cast || []
    const contributors = releaseData.contributors?.length ? releaseData.contributors : hit.contributors || []
    const narrators = this.namesFrom([...contributors, ...castNarrators])
    const authors = this.namesFrom(releaseData.written_by)
    const rawDetails = releaseData.production_credits?.technical_details
    const technicalDetails = z.record(z.string(), z.unknown()).optional().parse(rawDetails)
    const duration =
      technicalDetails?.duration_digital_verified_minutes ||
      technicalDetails?.duration_physical_verified_minutes ||
      hit.duration
    const isbn = technicalDetails?.digital_retail_isbn || technicalDetails?.physical_retail_isbn
    const description = this.resolveRscText(rsc, releaseData.about?.summary) || hit.description || null

    return {
      schemaVersion: 3,
      url,
      title: releaseData.title || hit.name || null,
      series: this.formatSeries(releaseData.range || titleParts.series),
      seriesTag: releaseData.release_number ? String(releaseData.release_number) : titleParts.seriesTag,
      releaseDate: releaseData.release_date || null,
      about: this.appendContributors(description, releaseData),
      duration: duration ? String(duration) : null,
      writtenBy: authors.join(', ') || null,
      narratedBy: narrators.join(', ') || null,
      coverUrl: releaseData.image || hit.image || null,
      isbn: typeof isbn === 'string' ? isbn : null
    }
  }

  private extractReleaseData(rsc: string): BigFinishReleaseData | null {
    const marker = '{"releaseData":'
    const start = rsc.indexOf(marker)
    if (start === -1) return null

    let inString = false
    let escaped = false
    let depth = 0
    for (let index = start; index < rsc.length; index++) {
      const character = rsc[index]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      else if (character === '{') depth++
      else if (character === '}') {
        depth--
        if (depth === 0) {
          try {
            const payload = z
              .object({ releaseData: bigFinishReleaseDataSchema.optional() })
              .parse(JSON.parse(rsc.slice(start, index + 1)))
            return payload.releaseData || null
          } catch {
            return null
          }
        }
      }
    }
    return null
  }

  private resolveRscText(rsc: string, value: string | null | undefined): string | null {
    if (!value) return null
    if (!/^\$[0-9a-z]+$/i.test(value)) return value

    const reference = value.slice(1)
    const record = new RegExp(`${reference}:T([0-9a-f]+),`, 'i').exec(rsc)
    if (!record || record.index === undefined) return null

    const length = parseInt(record[1], 16)
    const start = record.index + record[0].length
    return rsc.slice(start, start + length)
  }

  private namesFrom(people: NamedContributor[] | undefined): string[] {
    return [
      ...new Set((people || []).map((person) => person.name?.trim()).filter((name): name is string => Boolean(name)))
    ]
  }

  private appendContributors(description: string | null, releaseData: BigFinishReleaseData): string | null {
    const entries: string[] = []
    const add = (role: string, people: NamedContributor[] | undefined) => {
      const names = this.namesFrom(people)
      if (names.length)
        entries.push(`<li><strong>${this.escapeHtml(role)}:</strong> ${names.map(this.escapeHtml).join(', ')}</li>`)
    }

    for (const person of releaseData.cast || []) {
      if (person.label?.toLowerCase() !== 'narrator') add(person.label || 'Cast', [person])
    }
    for (const [role, people] of Object.entries(releaseData.production_credits || {})) {
      if (role !== 'writer' && Array.isArray(people)) add(this.formatRole(role), people)
    }

    if (!entries.length) return description
    return `${description || ''}<hr/><p><strong>Contributors</strong></p><ul>${entries.join('')}</ul>`
  }

  private formatRole(role: string): string {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  private formatSeries(series: string | null | undefined): string | null {
    return series ? series.replace(/\s*:\s*/g, ' - ') : null
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character
    )
  }

  private extractTitleParts(fullName: string): {
    series: string | null
    seriesTag: string | null
    title: string
  } {
    // Strip trailing "(Tag)" e.g. "(15B)" or "(4)"
    const tagMatch = fullName.match(/\((\d+[A-Z]?)\)\s*$/)
    const seriesTag = tagMatch ? tagMatch[1] : null
    const withoutTag = tagMatch ? fullName.slice(0, tagMatch.index).trim() : fullName

    // Split on the LAST colon to separate series from episode title
    const lastColon = withoutTag.lastIndexOf(':')
    if (lastColon === -1) {
      return { series: null, seriesTag, title: withoutTag }
    }

    const series = withoutTag.slice(0, lastColon).trim()
    const title = withoutTag.slice(lastColon + 1).trim()

    return {
      series: series || null,
      seriesTag,
      title: title || withoutTag
    }
  }

  private mapToMetadata(data: ParsedBookData): BookMetadata {
    const publishedYear = data.releaseDate ? data.releaseDate.split('-')[0] : undefined

    const series = data.series ? [{ series: data.series, sequence: data.seriesTag || undefined }] : undefined

    const duration = data.duration ? parseInt(data.duration, 10) : undefined

    return normalizeBookMetadata({
      title: data.title,
      bookId: data.url,
      format: 'audiobook',
      author: data.writtenBy,
      narrator: data.narratedBy,
      description: data.about,
      cover: data.coverUrl,
      isbn: data.isbn,
      series,
      language: 'en',
      publishedYear,
      publisher: 'Big Finish',
      duration
    })
  }
}
