import { z } from 'zod'
import type { MetadataBundle, MetadataQuery, ParsedParameters } from '../../types'
import { normalizeBooks } from '../../metadata/normalize'
import { httpClient, UpstreamError } from '../../utils/httpClient'
import { BaseProvider } from '../BaseProvider'
import { mapOverdriveBook } from './mapper'
import { overdriveLibrarySchema, overdriveSearchSchema } from './schemas'

const formats = {
  ebook: ['ebook-overdrive', 'ebook-media-do', 'ebook-overdrive-provisional'],
  audiobook: ['audiobook-overdrive', 'audiobook-overdrive-provisional']
}

export default class OverdriveProvider extends BaseProvider {
  protected override async searchEntities(query: MetadataQuery, params: ParsedParameters): Promise<MetadataBundle> {
    const library = overdriveLibrarySchema.parse(params.library)
    const defaultType = this.config.parameters.find((parameter) => parameter.name === 'type')?.default
    const type = z.enum(['all', 'ebook', 'audiobook']).parse(params.type ?? defaultType)
    const defaultLimit = this.config.parameters.find((parameter) => parameter.name === 'limit')?.default
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(24)
      .parse(params.limit ?? defaultLimit)
    const requestedFormats = type === 'all' ? [...formats.ebook, ...formats.audiobook] : formats[type]

    const response = await httpClient.get(
      `https://thunder.api.overdrive.com/v2/libraries/${encodeURIComponent(library)}/media`,
      {
        maxRedirects: 0,
        params: {
          query: [query.title, query.author].filter(Boolean).join(' '),
          show: 'all',
          format: requestedFormats.join(','),
          perPage: limit,
          page: 1,
          truncateDescription: false,
          'x-client-id': 'dewey'
        }
      }
    )
    if (response.status !== 200) throw new UpstreamError('OverDrive library search failed', response.status)

    const data = overdriveSearchSchema.parse(response.data)
    const items = data.items.filter((item) => type === 'all' || item.type.id === type).slice(0, limit)
    const sourceIds = new Map(items.map((item) => [item.reserveId.toLowerCase(), item.id]))
    const books = items.flatMap((item) => {
      const book = mapOverdriveBook(item)
      return book ? [book] : []
    })
    const bundle = normalizeBooks(books, this.config.id, {})

    for (const entity of bundle.entities) {
      if (entity.kind !== 'book') continue
      const titleId = sourceIds.get(entity.source.sourceId)
      if (titleId) entity.identifiers.push({ scheme: 'provider', namespace: 'overdrive:title', value: titleId })
    }

    return bundle
  }
}
