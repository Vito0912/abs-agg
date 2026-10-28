import { load } from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { BookMetadata, Contributor, SeriesMetadata } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import { podiumBookSchema, podiumStructuredNodeSchema } from './schemas'
import type { PodiumBook } from './types'

export const podiumOrigin = 'https://podiumentertainment.com'

export function podiumTitlePath(href: string): string {
  const url = new URL(href, podiumOrigin)
  if (url.origin !== podiumOrigin || !/^\/titles\/\d+\/[-a-z0-9]+$/.test(url.pathname)) {
    throw new Error('Invalid Podium title URL')
  }

  return url.pathname
}

export function parsePodiumSearch(html: string, limit: number): string[] {
  const $ = load(html)
  const paths = new Set<string>()

  for (const element of $('main a:has(img[data-testid="grid-image"])').toArray()) {
    const href = $(element).attr('href')
    if (!href) throw new Error('Podium search result has no title URL')

    paths.add(podiumTitlePath(href))
    if (paths.size >= limit) break
  }

  if (!paths.size && !$('main').text().includes('No Titles Found')) {
    throw new Error('Podium search page has no recognized results')
  }

  return [...paths]
}

function structuredBook($: CheerioAPI): PodiumBook {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    const content = $(script).text().trim()
    if (!content) continue

    const value: unknown = JSON.parse(content)
    const nodes: unknown[] = Array.isArray(value) ? [...value] : [value]

    for (let index = 0; index < nodes.length; index++) {
      const node = podiumStructuredNodeSchema.parse(nodes[index])
      if (node['@graph']) nodes.push(...node['@graph'])
      if (node['@type'] === 'Audiobook' || node['@type'] === 'Book') {
        return podiumBookSchema.parse(nodes[index])
      }
    }
  }

  throw new Error('Podium title page has no structured book metadata')
}

function contributors($: CheerioAPI, book: PodiumBook): Contributor[] {
  const people: Contributor[] = []

  for (const role of ['author', 'narrator'] as const) {
    const selector = role === 'author' ? 'link-authors' : 'link-performers'
    for (const element of $(`[data-testid="${selector}"]`).toArray()) {
      const name = $(element).text().replace(/^,\s*/, '').trim()
      const href = $(element).attr('href')
      const sourceId = href ? /^\/(?:authors|performers)\/(\d+)\//.exec(href)?.[1] : undefined
      if (name) people.push({ name, role, sourceId })
    }
  }

  if (!people.some((person) => person.role === 'author') && book.author) {
    const authors = Array.isArray(book.author) ? book.author : [book.author]
    for (const author of authors) {
      const names = Array.isArray(author.name) ? author.name : [author.name]
      for (const name of names) people.push({ name, role: 'author' })
    }
  }

  return people
}

function seriesMetadata($: CheerioAPI): SeriesMetadata[] {
  const link = $('[data-testid="title-series"]').first()
  const label = link.text().trim()
  if (!label) return []

  const match = /^(.*), Book\s+(.+)$/.exec(label)
  const href = link.attr('href')
  const sourceId = href ? /^\/series\/(\d+)\//.exec(href)?.[1] : undefined

  return [{ series: match?.[1] || label, sequence: match?.[2], sourceId }]
}

function publishedDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return value

  const date = new Date(`${value} UTC`)
  if (Number.isNaN(date.getTime())) throw new Error('Unsupported Podium publication date')

  return date.toISOString().slice(0, 10)
}

function durationSeconds($: CheerioAPI): number | undefined {
  const label = $('[data-testid="label-duration"] span').last().text().trim()
  if (!label) return undefined

  const match = /^(?:(\d+) hr(?:,\s*)?)?(?:(\d+) min)?$/.exec(label)
  if (!match || !match.slice(1).some((part) => part !== undefined)) {
    throw new Error('Unsupported Podium audiobook duration')
  }

  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)

  return hours * 3600 + minutes * 60
}

export function parsePodiumBook(html: string, expectedPath: string): BookMetadata {
  const $ = load(html)
  const book = structuredBook($)
  const path = podiumTitlePath(book.url)
  const bookId = path.split('/')[2]
  if (bookId !== podiumTitlePath(expectedPath).split('/')[2]) throw new Error('Podium title identity mismatch')

  const people = contributors($, book)
  const formats = Array.isArray(book.bookFormat) ? book.bookFormat : [book.bookFormat]
  let format: BookMetadata['format']
  if (book['@type'] === 'Audiobook') format = 'audiobook'
  else if (formats.includes('EBook')) format = 'ebook'

  // Podium is just has synopsis for JSON LD
  const description = ['story-header', 'story-description']
    .map((testId) => $(`[data-testid="${testId}"]`).html())
    .filter(Boolean)
    .join('\n')

  return normalizeBookMetadata({
    title: book.name,
    bookId,
    format,
    contributors: people,
    author: people
      .filter((person) => person.role === 'author')
      .map((person) => person.name)
      .join(', '),
    narrator: people
      .filter((person) => person.role === 'narrator')
      .map((person) => person.name)
      .join(', '),
    description: description || book.description,
    cover: book.image,
    isbn: book.isbn,
    publisher: book.publisher?.name,
    publishedDate: publishedDate(book.datePublished),
    genres: book.genre,
    language: $('[data-testid="label-language"] span').last().text().trim() || undefined,
    durationSeconds: format === 'audiobook' ? durationSeconds($) : undefined,
    series: seriesMetadata($),
    quality: 'detail',
    poweredBy: 'Podium Entertainment'
  })
}
