import type { BookMetadata, Contributor, Rating } from '../../types'
import { normalizeBookMetadata } from '../../utils/helpers'
import type { AudibleProduct, AudibleRegion } from './types'

function contributors(product: AudibleProduct): Contributor[] {
  return [
    ...(product.authors || []).map((author) => ({
      name: author.name,
      role: 'author' as const,
      sourceId: author.asin
    })),
    ...(product.narrators || []).map((narrator) => ({
      name: narrator.name,
      role: 'narrator' as const,
      sourceId: narrator.asin
    }))
  ]
}

function ratings(product: AudibleProduct): Rating[] {
  const result: Rating[] = []
  const source = product.rating
  if (!source) return result

  const distributions = [
    { aspect: 'overall' as const, distribution: source.overall_distribution },
    { aspect: 'performance' as const, distribution: source.performance_distribution },
    { aspect: 'story' as const, distribution: source.story_distribution }
  ]

  for (const { aspect, distribution } of distributions) {
    if (!distribution || distribution.num_ratings === 0) continue

    result.push({
      source: 'audible',
      aspect,
      value: distribution.average_rating,
      minimum: 0,
      maximum: 5,
      ratingCount: distribution.num_ratings,
      reviewCount: aspect === 'overall' ? source.num_reviews : undefined
    })
  }

  return result
}

function cover(product: AudibleProduct): string | undefined {
  const images = Object.entries(product.product_images || {})
  images.sort(([left], [right]) => Number(right) - Number(left))

  return images[0]?.[1]
}

export function mapAudibleBook(product: AudibleProduct, region: AudibleRegion): BookMetadata {
  let abridged: boolean | undefined
  if (product.format_type === 'abridged') abridged = true
  if (product.format_type === 'unabridged') abridged = false

  const genres = (product.category_ladders || []).flatMap((category) => {
    if (category.root && category.root !== 'Genres') return []

    return category.ladder.map((entry) => entry.name)
  })

  return normalizeBookMetadata({
    bookId: product.asin,
    title: product.title,
    subtitle: product.subtitle,
    format: 'audiobook',
    asin: product.asin,
    marketplace: region,
    isbn: product.isbn,
    contributors: contributors(product),
    publisher: product.publisher_name,
    description: product.publisher_summary || product.merchandising_summary,
    cover: cover(product),
    publishedDate: product.release_date,
    language: product.language,
    durationSeconds: product.runtime_length_min == null ? undefined : product.runtime_length_min * 60,
    abridged,
    genres: [...new Set(genres)],
    ratings: ratings(product),
    series: product.series?.map((series) => ({
      series: series.title,
      sourceId: series.asin,
      sequence: series.sequence
    }))
  })
}
