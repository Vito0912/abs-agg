import type { BookMetadata, MetadataBundle, MetadataEntity, ParsedParameters } from '../types'
import { metadataBundleSchema } from '../types/metadata'
import { bookMetadataSchema } from '../types/providerBook'
import { sourceScope } from './identity'
import { createBookEntity, createSource } from './book'
import { createRelatedAuthors, createRelatedChapters, createRelatedSeries, createRelatedWork } from './related'

export function normalizeBooks(books: BookMetadata[], provider: string, params: ParsedParameters): MetadataBundle {
  const entities = new Map<string, MetadataEntity>()
  const matches = new Set<string>()
  const scope = sourceScope(params)

  for (const input of books) {
    const book = bookMetadataSchema.parse(input)
    if (!book.title.trim()) continue

    const source = createSource(book, provider, scope)
    const entity = createBookEntity(book, source)
    const authors = createRelatedAuthors(book, entity)
    const work = createRelatedWork(book, entity)
    const series = createRelatedSeries(book, entity)
    const chapters = createRelatedChapters(book, entity)
    const related: MetadataEntity[] = [...authors, ...series, ...chapters]
    if (work) related.push(work)

    for (const record of related) entities.set(record.id, record)
    entities.set(entity.id, entity)
    matches.add(entity.id)
  }

  return metadataBundleSchema.parse({
    schemaVersion: 1,
    matches: [...matches],
    entities: [...entities.values()],
    complete: books.every((book) => book.quality !== 'summary')
  })
}
