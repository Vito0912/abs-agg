import type { BookMetadata, Contributor } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import type { NextoryFormat, NextoryProduct } from './types'

export function nextoryBookFormat(type: string): 'audiobook' | 'ebook' | undefined {
  if (type === 'hls') return 'audiobook'
  if (type === 'epub') return 'ebook'

  return undefined
}

function coverUrl(template: string | null | undefined): string | undefined {
  if (!template) return undefined

  const url = new URL(template.replace('{$width}', '1000'))
  url.searchParams.set('w', '1000')
  url.searchParams.set('h', '1000')

  return url.toString()
}

function contributors(product: NextoryProduct, format: NextoryFormat, isAudio: boolean): Contributor[] {
  const people: Contributor[] = product.authors.map((person) => ({
    name: person.name,
    sourceId: String(person.id),
    role: 'author'
  }))

  for (const person of isAudio ? product.narrators || [] : []) {
    people.push({ name: person.name, sourceId: String(person.id), role: 'narrator' })
  }

  for (const person of format.translators || []) {
    people.push({ name: person.name, sourceId: String(person.id), role: 'translator' })
  }

  return people
}

export function mapNextoryBook(product: NextoryProduct, format: NextoryFormat): BookMetadata {
  const bookFormat = nextoryBookFormat(format.type)
  const isAudio = bookFormat === 'audiobook'
  const hasRating = product.average_rating != null && (product.number_of_rates || 0) > 0

  return normalizeBookMetadata({
    title: product.title,
    bookId: `${product.id}:${format.identifier}`,
    format: bookFormat,
    author: product.authors.map((person) => person.name).join(', '),
    narrator: isAudio ? product.narrators?.map((person) => person.name).join(', ') : undefined,
    contributors: contributors(product, format, isAudio),
    description: product.description_full || product.blurb || undefined,
    language: product.language || undefined,
    isbn: format.isbn || undefined,
    cover: coverUrl(format.img_url),
    publisher: format.publisher?.name,
    publishedDate: format.publication_date || undefined,
    durationSeconds: isAudio ? (format.duration ?? undefined) : undefined,
    pageCount: bookFormat === 'ebook' && format.pages ? format.pages : undefined,
    series: product.series
      ? [{ series: product.series.name, sourceId: String(product.series.id), sequence: product.volume?.toString() }]
      : undefined,
    ratings: hasRating
      ? [
          {
            source: 'Nextory',
            value: product.average_rating,
            minimum: 0,
            maximum: 5,
            ratingCount: product.number_of_rates
          }
        ]
      : undefined,
    poweredBy: 'Nextory'
  })
}
