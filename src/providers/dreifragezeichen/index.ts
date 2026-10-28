import { z } from 'zod'
import { storedCatalog } from '../../cache/catalog'
import { normalizeBooks } from '../../metadata/normalize'
import { bundleBooks } from '../../metadata/projection'
import { mergeMetadataBundles, selectMetadataBundle } from '../../metadata/bundle'
import type { BookMetadata, MetadataBundle, MetadataQuery, ParsedParameters, ProviderConfig } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { httpClient } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { dreifragEpisodeSchema, dreifragSpezialEpisodeSchema } from './schemas'
import type { DreifragEpisode, DreifragSource, DreifragSpezialEpisode } from './types'

const SOURCES: { key: DreifragSource; url: string; dataField: string }[] = [
  { key: 'serie', url: 'https://dreimetadaten.de/data/Serie.json', dataField: 'serie' },
  { key: 'spezial', url: 'https://dreimetadaten.de/data/Spezial.json', dataField: 'spezial' },
  { key: 'kids', url: 'https://dreimetadaten.de/data/Kids.json', dataField: 'kids' }
]

export default class DreifragezeichenProvider extends BaseProvider {
  override readonly adapterVersion = 2

  constructor(config: ProviderConfig) {
    super(config)
  }

  private async loadCollection(source: DreifragSource): Promise<MetadataBundle> {
    const definition = SOURCES.find((entry) => entry.key === source)
    if (!definition) throw new Error(`Unknown collection: ${source}`)

    const schema = dreifragEpisodeSchema.or(dreifragSpezialEpisodeSchema).array().max(50000)
    const bundle = await storedCatalog(this.cacheIdentity, source, 7 * 86400000, async (): Promise<MetadataBundle> => {
      const response = await httpClient.get<unknown>(definition.url)
      if (response.status !== 200) throw new Error(`Die drei ??? catalog error: ${response.status}`)

      const data = z.record(z.string(), z.unknown()).parse(response.data)
      const episodes = schema.parse(data[definition.dataField])
      const fetchedAt = Date.now()
      const books = episodes.map((episode) => ({ ...this.mapToMetadata(episode, source), fetchedAt }))

      return normalizeBooks(books, this.config.id, {})
    })

    return bundle
  }

  private async loadAll(): Promise<{ source: DreifragSource; bundle: MetadataBundle; books: BookMetadata[] }[]> {
    return Promise.all(
      SOURCES.map(async ({ key }) => {
        const bundle = await this.loadCollection(key)
        return { source: key, bundle, books: bundleBooks(bundle) }
      })
    )
  }

  private normalizeStr(s: string): string {
    return s
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private extractNumber(s: string): number | null {
    const match = s.match(/\b(\d+)\b/)
    return match ? parseInt(match[1], 10) : null
  }

  private scoreEpisode(query: string, book: BookMetadata, source: DreifragSource): number {
    let score = 0
    const queryNorm = this.normalizeStr(query)
    const titleNorm = this.normalizeStr(book.title)
    const sourceKeyword: Record<DreifragSource, string> = { serie: 'serie', spezial: 'spezial', kids: 'kids' }

    if (queryNorm.includes(sourceKeyword[source])) {
      score += 300
    } else if (
      (queryNorm.includes('spezial') && source !== 'spezial') ||
      (queryNorm.includes('kids') && source !== 'kids')
    ) {
      score -= 200
    }

    const sequence = book.series?.[0]?.sequence
    const nummer = sequence === undefined ? null : Number(sequence)
    const queryNumber = this.extractNumber(queryNorm)
    if (queryNumber !== null && nummer !== null) {
      if (queryNumber === nummer) {
        score += 1000
      } else {
        score -= 50
      }
    }

    const prefix =
      source === 'serie'
        ? 'die drei fragezeichen'
        : source === 'spezial'
          ? 'die drei fragezeichen spezial'
          : 'die drei fragezeichen kids'
    const fullTitleNorm = this.normalizeStr(`${prefix} ${nummer ?? ''} ${book.title}`)

    if (titleNorm.includes(queryNorm) || fullTitleNorm.includes(queryNorm)) {
      score += 200
    }

    const queryWords = queryNorm.split(/\s+/).filter((w) => w.length > 2 && !/^\d+$/.test(w))
    for (const word of queryWords) {
      if (sourceKeyword[source] === word) continue
      if (titleNorm.includes(word)) {
        score += 30
      } else if (word.length >= 4) {
        for (const tw of titleNorm.split(/\s+/)) {
          if (tw.startsWith(word.slice(0, Math.max(4, Math.floor(word.length * 0.75))))) {
            score += 10
            break
          }
        }
      }
    }

    return score
  }

  protected override async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const limit = params.limit ? Number(params.limit) : 5
    const collections = await this.loadAll()
    const scored: { score: number; book: BookMetadata }[] = []

    for (const { source, books } of collections) {
      for (const book of books) {
        const score = this.scoreEpisode(query.title, book, source)
        if (score > 0) scored.push({ score, book })
      }
    }

    scored.sort((left, right) => right.score - left.score)
    const catalog = mergeMetadataBundles(collections.map(({ bundle }) => bundle))
    const sourceIds = new Map<string, string>()
    for (const entity of catalog.entities) {
      if (entity.kind === 'book') sourceIds.set(entity.source.sourceId, entity.id)
    }

    const matches = scored.slice(0, limit).flatMap(({ book }) => {
      const id = book.bookId ? sourceIds.get(book.bookId) : undefined
      return id ? [id] : []
    })

    return selectMetadataBundle(catalog, matches)
  }

  async fetchBook(bookId: string, _params: ParsedParameters): Promise<BookMetadata | null> {
    const collections = await this.loadAll()
    for (const { books } of collections) {
      const book = books.find((entry) => entry.bookId === bookId)
      if (book) return book
    }

    return null
  }

  private episodeId(episode: DreifragEpisode | DreifragSpezialEpisode, source: DreifragSource): string {
    const localId = 'nummer' in episode ? String(episode.nummer) : episode.links?.json || episode.titel
    return `${source}:${localId}`
  }

  private mapToMetadata(ep: DreifragEpisode | DreifragSpezialEpisode, source: DreifragSource): BookMetadata {
    const nummer = 'nummer' in ep ? ep.nummer : undefined
    const seriesName =
      source === 'serie' ? 'Die drei ???' : source === 'spezial' ? 'Die drei ??? Spezial' : 'Die drei ??? Kids'

    const paddedNumber = nummer !== undefined ? String(nummer).padStart(3, '0') : undefined
    const fullTitle = ep.titel ?? ''
    const subtitle = paddedNumber ? `${seriesName} ${paddedNumber}` : seriesName

    const narrator = ep.sprechrollen
      ? ep.sprechrollen
          .map((r) => r.sprecher)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ')
      : undefined

    let publishedYear: string | undefined
    if (ep.veröffentlichungsdatum) {
      const year = ep.veröffentlichungsdatum.slice(0, 4)
      if (/^\d{4}$/.test(year)) publishedYear = year
    }

    const durationSeconds = ep.gesamtdauer === undefined ? undefined : ep.gesamtdauer / 1000
    const cover = ep.links?.cover_itunes
    const seriesEntry = nummer !== undefined ? { series: seriesName, sequence: String(nummer) } : { series: seriesName }

    return normalizeBookMetadata({
      title: fullTitle,
      bookId: this.episodeId(ep, source),
      format: 'audiobook',
      chapters: ep.kapitel?.map((chapter, index) => ({
        title: chapter.titel,
        sequence: index + 1,
        startSeconds: chapter.start / 1000,
        endSeconds: chapter.end / 1000
      })),
      subtitle,
      author: ep.autor,
      narrator,
      description: ep.gesamtbeschreibung ?? ep.beschreibung,
      cover,
      publishedYear,
      series: [seriesEntry],
      durationSeconds,
      language: 'de',
      poweredBy: 'dreimetadaten.de'
    })
  }
}
