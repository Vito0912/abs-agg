import type { EntityKind, Identifier, MetadataBundle, MetadataEntity, MetadataSource } from '../../types'
import {
  metadataBundleSchema,
  workSchema,
  bookSchema,
  authorSchema,
  seriesSchema,
  chapterSchema
} from '../../types/metadata'
import { entityId, bookIdentifiers, sourceScope } from '../../metadata/identity'
import { publicationDate } from '../../metadata/dates'
import { sanitizeDescription } from '../../metadata/book'
import { audioSiloUrl } from './client'
import type { AudioSiloWork, AudioSiloRecording, RecordingChapters } from './types'

const defaultScope = sourceScope({})

function fields(kind: EntityKind, sourceId: string, name: string) {
  const source: MetadataSource = {
    provider: 'audiosilo',
    sourceId,
    scope: defaultScope,
    stable: true,
    fetchedAt: Date.now(),
    quality: 'detail'
  }

  const identifiers: Identifier[] = [{ scheme: 'provider', namespace: 'audiosilo', value: sourceId }]

  return {
    schemaVersion: 1,
    kind,
    id: entityId('audiosilo', kind, sourceId, defaultScope),
    name,
    identifiers,
    source,
    relations: [],
    provenance: {}
  }
}

function workDescription(work: AudioSiloWork): string | undefined {
  if (work.description) return sanitizeDescription(work.description)
  if (!work.community_description) return undefined

  const description = sanitizeDescription(work.community_description.text)
  const attribution = `AudioSilo Meta contributors — CC BY-SA 4.0. Source: ${audioSiloUrl}/api/v1/works/${encodeURIComponent(work.id)}`

  return `${description || ''}<p>${attribution} License: https://creativecommons.org/licenses/by-sa/4.0/</p>`
}

function createWork(work: AudioSiloWork) {
  const common = fields('work', work.id, work.title)
  const identifiers: Identifier[] = [...common.identifiers]
  if (work.xref?.wikidata) identifiers.push({ scheme: 'wikidata', value: work.xref.wikidata })
  if (work.xref?.openlibrary) identifiers.push({ scheme: 'openlibrary', value: work.xref.openlibrary })
  if (work.xref?.goodreads) identifiers.push({ scheme: 'provider', namespace: 'goodreads', value: work.xref.goodreads })

  return workSchema.parse({
    ...common,
    identifiers,
    subtitle: work.subtitle,
    description: workDescription(work),
    language: work.language,
    firstPublished: publicationDate(work.first_published),
    contributors: work.authors.map((person) => ({
      name: person.name,
      role: 'author',
      sourceId: person.id,
      authorId: entityId('audiosilo', 'author', person.id, defaultScope)
    })),
    genres: work.genres || [],
    tags: [],
    ratings: [],
    alternativeNames: []
  })
}

function recordingIdentifiers(recording: AudioSiloRecording, region: string): Identifier[] {
  const identifiers: Identifier[] = []
  const asins = [...recording.asin].sort(
    (left, right) => Number(right.region === region) - Number(left.region === region)
  )

  for (const item of asins) identifiers.push(...bookIdentifiers(undefined, item.asin, item.region))
  for (const isbn of recording.isbn) identifiers.push(...bookIdentifiers(isbn))

  return identifiers
}

function createBook(work: AudioSiloWork, recording: AudioSiloRecording, workId: string, region: string) {
  const sourceId = `${work.id}/${recording.id}`
  const common = fields('book', sourceId, work.title)

  return bookSchema.parse({
    ...common,
    identifiers: [...recordingIdentifiers(recording, region), ...common.identifiers],
    subtitle: work.subtitle,
    format: 'audiobook',
    language: work.language,
    publisher: recording.publisher,
    published: publicationDate(recording.release_date),
    durationSeconds: recording.runtime_min === undefined ? undefined : recording.runtime_min * 60,
    abridged: recording.abridged,
    image: recording.cover_url,
    contributors: [
      ...work.authors.map((person) => ({
        name: person.name,
        role: 'author',
        sourceId: person.id,
        authorId: entityId('audiosilo', 'author', person.id, defaultScope)
      })),
      ...recording.narrators.map((person) => ({
        name: person.name,
        role: 'narrator',
        sourceId: person.id,
        authorId: entityId('audiosilo', 'author', person.id, defaultScope)
      }))
    ],
    relations: [{ type: 'editionOf', targetId: workId }],
    genres: work.genres || [],
    tags: [],
    ratings: []
  })
}

function addPeople(work: AudioSiloWork, entities: Map<string, MetadataEntity>): void {
  const people = [...work.authors, ...(work.recordings || []).flatMap((recording) => recording.narrators)]

  for (const person of people) {
    const author = authorSchema.parse({ ...fields('author', person.id, person.name), alternativeNames: [] })
    author.source.quality = 'summary'
    entities.set(author.id, author)
  }
}

function addSeries(work: AudioSiloWork, entities: Map<string, MetadataEntity>, members: MetadataEntity[]): void {
  for (const membership of work.series) {
    const series = seriesSchema.parse(fields('series', membership.id, membership.name))
    series.source.quality = 'summary'
    entities.set(series.id, series)

    for (const member of members) {
      member.relations.push({
        type: 'partOf',
        targetId: series.id,
        sequence: membership.position,
        order: 'unspecified'
      })
    }
  }
}

function addChapters(book: MetadataEntity, data: RecordingChapters, entities: Map<string, MetadataEntity>): void {
  for (const [index, item] of data.chapters.entries()) {
    const sourceId = `${book.source.sourceId}/chapter:${index}`
    const common = fields('chapter', sourceId, item.title || `Chapter ${index + 1}`)
    const chapter = chapterSchema.parse({
      ...common,
      source: { ...common.source, stable: false },
      sequence: index + 1,
      startSeconds: item.start_ms / 1000,
      endSeconds: (item.start_ms + item.length_ms) / 1000,
      timeline: 'book',
      relations: [{ type: 'chapterOf', targetId: book.id }]
    })

    book.relations.push({ type: 'hasChapter', targetId: chapter.id })
    entities.set(chapter.id, chapter)
  }
}

export function mapAudioSiloWork(work: AudioSiloWork, recordings: RecordingChapters[], region: string): MetadataBundle {
  const entities = new Map<string, MetadataEntity>()
  const normalizedWork = createWork(work)
  const books = recordings.map((data) => createBook(work, data.recording, normalizedWork.id, region))

  addPeople(work, entities)
  addSeries(work, entities, [normalizedWork, ...books])
  entities.set(normalizedWork.id, normalizedWork)

  for (const [index, book] of books.entries()) {
    addChapters(book, recordings[index], entities)
    if (!recordings[index].complete) book.source.quality = 'summary'
    entities.set(book.id, book)
  }

  return metadataBundleSchema.parse({
    schemaVersion: 1,
    matches: books.length ? books.map((book) => book.id) : [normalizedWork.id],
    entities: [...entities.values()],
    complete: recordings.every((recording) => recording.complete)
  })
}
