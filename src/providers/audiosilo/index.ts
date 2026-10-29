import { errorAttributes, logger } from '../../telemetry/logger'
import type { EntityKind, MetadataBundle, MetadataEntity, MetadataQuery, ParsedParameters } from '../../types'
import { metadataBundleSchema } from '../../types/metadata'
import { emptyBundle } from '../../database/manager'
import { textSimilarity } from '../../metadata/search'
import { mapConcurrent } from '../../utils/concurrency'
import { UpstreamError } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { AudioSiloClient } from './client'
import { mapAudioSiloWork } from './mapper'
import type { AudioSiloRecording, RecordingChapters } from './types'

export default class AudioSiloProvider extends BaseProvider {
  private readonly client = new AudioSiloClient()

  override capabilities(): { search: EntityKind[]; lookup: EntityKind[] } {
    return { search: ['book', 'work'], lookup: ['work'] }
  }

  protected override async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const limit = Math.min(Number(params.limit) || 5, 10)
    const ids = await this.client.search(query.title, limit)
    const bundles = await mapConcurrent(ids, 3, (id) => this.lookupMetadata(id, params))

    if (query.author) {
      bundles.sort(
        (left, right) => this.authorScore(right, query.author || '') - this.authorScore(left, query.author || '')
      )
    }

    const entities = new Map<string, MetadataEntity>()
    const matches = new Set<string>()

    for (const bundle of bundles) {
      for (const entity of bundle.entities) entities.set(entity.id, entity)
      for (const id of bundle.matches) matches.add(id)
    }

    return metadataBundleSchema.parse({
      schemaVersion: 1,
      matches: [...matches].slice(0, limit),
      entities: [...entities.values()],
      complete: bundles.every((bundle) => bundle.complete)
    })
  }

  override async lookupMetadata(id: string, params: ParsedParameters): Promise<MetadataBundle> {
    return this.cachedMetadata('work', id, params, async () => {
      const work = await this.client.work(id)
      if (!work) return emptyBundle()

      const recordings = await mapConcurrent(work.recordings || [], 3, (recording) => {
        return this.loadChapters(work.id, recording)
      })
      const region = typeof params.region === 'string' ? params.region : 'us'

      return mapAudioSiloWork(work, recordings, region)
    })
  }

  private async loadChapters(workId: string, recording: AudioSiloRecording): Promise<RecordingChapters> {
    if (recording.chapter_count === 0) return { recording, chapters: [], complete: true }

    try {
      const chapters = await this.client.chapters(workId, recording.id)

      return { recording, chapters, complete: chapters.length === recording.chapter_count }
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error
      if (error.status !== undefined && error.status !== 404 && error.status !== 429 && error.status < 500) throw error

      logger.warn('Provider chapters unavailable', { provider: this.config.id, ...errorAttributes(error) })
      return { recording, chapters: [], complete: false }
    }
  }

  private authorScore(bundle: MetadataBundle, author: string): number {
    const work = bundle.entities.find((entity) => entity.kind === 'work')
    if (!work || !('contributors' in work)) return 0

    return Math.max(0, ...work.contributors.map((person) => textSimilarity(author, person.name)))
  }
}
