import { BaseProvider } from '../BaseProvider'
import { BookMetadata, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { dbManager } from '../../database/manager'
import { httpClient } from '../../utils/httpClient'
import path from 'path'
import fs from 'fs'

const configPath = path.join(__dirname, 'config.json')
const config: ProviderConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

const BASE_URL = 'https://www.bigfinish.com'
const SEARCH_URL = `${BASE_URL}/api/search`

const isEnvEnabled = (value: string | undefined): boolean => value?.trim().toLowerCase() === 'true'
const ENABLE_SERIES_MAPPING = isEnvEnabled(process.env.seriesmapping)
const ENABLE_CHARACTERS = isEnvEnabled(process.env.characters)

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

const SERIES_MAPPING_PATH = path.join(
  process.cwd(),
  'data',
  'series-mapping.json'
)

function getSeriesMapping(): Record<string, string> {
  try {
    return JSON.parse(
      fs.readFileSync(SERIES_MAPPING_PATH, 'utf8')
    ) as Record<string, string>
  } catch (error) {
    console.error(`Failed to load ${SERIES_MAPPING_PATH}`, error)
    return {}
  }
}

interface BigFinishSearchResult {
  id: number
  release_slug: string
  name: string
  range_id: number | null
  description: string | null
  duration: string | null
  image: string | null
  contributors: { name: string }[]
}

interface BigFinishSearchResponse {
  hits: BigFinishSearchResult[]
  estimatedTotalHits: number
  limit: number
  offset: number
  query: string
}

interface ParsedBookData {
  schemaVersion: 3
  url: string
  title: string | null
  series: string | null
  seriesTag: string | null
  releaseDate: string | null
  about: string | null
  duration: string | null
  writtenBy: string | null
  narratedBy: string | null
  tags?: string[]
  coverUrl: string | null
  isbn: string | null
}

interface NamedContributor {
  name?: string
  label?: string
}

interface BigFinishReleaseData {
  title?: string
  range?: string
  release_number?: string | number
  release_date?: string
  image?: string
  about?: { summary?: string | null }
  written_by?: NamedContributor[]
  cast?: NamedContributor[]
  production_credits?: Record<string, NamedContributor[] | Record<string, unknown> | undefined>
}

export default class BigFinishProvider extends BaseProvider {
  constructor() {
    super(config)
  }

  async search(
    title: string,
    _author: string | null,
    params: ParsedParameters,
    options?: { skipCache?: boolean }
  ): Promise<BookMetadata[]> {
    const limit = Math.min((params.limit as number) || 3, 5)
    const skipCache = options?.skipCache === true

    const query = title.replace(/:/g, ' ')

    const searchRes = await httpClient.post(SEARCH_URL, { q: query, limit, offset: 0 }, { headers: SEARCH_HEADERS })

    if (searchRes.status !== 200) {
      throw new Error(`Big Finish search API error: ${searchRes.status}`)
    }

    const searchData = searchRes.data as BigFinishSearchResponse
    const hits = (searchData.hits ?? []).slice(0, limit)

    const books: BookMetadata[] = []

    for (const hit of hits) {
      if (!hit.release_slug) continue

      const productUrl = `${BASE_URL}/releases/v/${hit.release_slug}`

      let bookData: ParsedBookData | null = null

      if (!skipCache) {
        const bookCache = dbManager.getBookCache(this.config.id, productUrl)
        if (bookCache) {
          try {
            const cachedData = JSON.parse(bookCache) as ParsedBookData
            if (cachedData.schemaVersion === 3) bookData = cachedData
          } catch {}
        }
      }

      if (!bookData) {
        const pageRes = await httpClient.get(productUrl, {
          headers: RSC_HEADERS,
          responseType: 'text'
        })

        if (pageRes.status === 200) {
          const rsc = typeof pageRes.data === 'string' ? pageRes.data : String(pageRes.data)
          bookData = this.parseProductPage(productUrl, rsc, hit)

          if (bookData && !skipCache) {
            dbManager.setBookCache(this.config.id, productUrl, JSON.stringify(bookData))
          }
        }
      }

      if (bookData) {
        const metadata = this.mapToMetadata(bookData)
        if (metadata.title) {
          books.push(metadata)
        }
      }
    }

    return books
  }

  private parseProductPage(url: string, rsc: string, hit: BigFinishSearchResult): ParsedBookData | null {
    const releaseData = this.extractReleaseData(rsc)
    if (!releaseData) return null

    const titleParts = this.extractTitleParts(releaseData.title || hit.name)
    const narratorNames = this.namesFrom(releaseData.cast?.filter((person) => person.label?.toLowerCase() === 'narrator'))
    const narrators = ENABLE_CHARACTERS ? this.formatNarrators(releaseData.cast) : narratorNames
    const narratorTags = ENABLE_CHARACTERS ? this.extractNarratorTags(releaseData.cast) : []
    const authors = this.namesFrom(releaseData.written_by)
    const technicalDetails = releaseData.production_credits?.technical_details as Record<string, unknown> | undefined
    const duration =
      technicalDetails?.duration_digital_verified_minutes ||
      technicalDetails?.duration_physical_verified_minutes ||
      hit.duration
    const isbn = technicalDetails?.digital_retail_isbn || technicalDetails?.physical_retail_isbn
    const description = this.resolveRscText(rsc, releaseData.about?.summary) || hit.description || null
    const about = ENABLE_CHARACTERS ? this.appendContributors(description, releaseData) : description

    return {
      schemaVersion: 3,
      url,
      title: releaseData.title || hit.name || null,
      series: ENABLE_SERIES_MAPPING ? this.formatSeries(releaseData.range || titleParts.series) : releaseData.range || titleParts.series,
      seriesTag: releaseData.release_number ? String(releaseData.release_number) : titleParts.seriesTag,
      releaseDate: releaseData.release_date || null,
      about,
      duration: duration ? String(duration) : null,
      writtenBy: authors.join(', ') || null,
      narratedBy: narrators.join(', ') || null,
      tags: narratorTags.length > 0 ? narratorTags : undefined,
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
            const payload = JSON.parse(rsc.slice(start, index + 1)) as { releaseData?: BigFinishReleaseData }
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

  private formatNarrators(cast: NamedContributor[] | undefined): string[] {
    const narrators = this.namesFrom(cast?.filter((person) => person.label?.toLowerCase() === 'narrator'))
    const rolesByName = new Map<string, Set<string>>()

    for (const person of cast || []) {
      const name = person.name?.trim()
      const label = person.label?.trim()
      if (!name || !label || label.toLowerCase() === 'narrator') continue

      for (const role of this.splitRoleLabels(label)) {
        const roles = rolesByName.get(name) ?? new Set<string>()
        roles.add(role)
        rolesByName.set(name, roles)
      }
    }

    return narrators.map((name) => {
      const roles = Array.from(rolesByName.get(name) || []).sort()
      return roles.length > 0 ? `${name} (${roles.join(', ')})` : name
    })
  }

  private extractNarratorTags(cast: NamedContributor[] | undefined): string[] {
    const tags = new Set<string>()

    for (const person of cast || []) {
      const label = person.label?.trim()
      if (!label || label.toLowerCase() === 'narrator') continue

      for (const role of this.splitRoleLabels(label)) {
        tags.add(role)
      }
    }

    return [...tags].sort()
  }

  private splitRoleLabels(label: string): string[] {
    return [...new Set(label.split('/').map((role) => role.trim()).filter(Boolean))]
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
    if (!series) return null
  
    const seriesMapping = getSeriesMapping()
    const mappedSeries = seriesMapping[series.trim()] ?? series
  
    return mappedSeries.replace(/\s*:\s*/g, ' - ')
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
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
      author: data.writtenBy,
      narrator: data.narratedBy,
      description: data.about,
      cover: data.coverUrl,
      isbn: data.isbn,
      tags: data.tags,
      series,
      language: 'Eng',
      publishedYear,
      publisher: 'Big Finish',
      duration
    })
  }
}
