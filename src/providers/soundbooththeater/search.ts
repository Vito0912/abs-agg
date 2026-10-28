import { normalizeText } from '../../metadata/identity'
import { textSimilarity } from '../../metadata/search'
import type { SoundboothCatalogIndex } from './types'

export function searchSoundboothCatalog(
  catalog: SoundboothCatalogIndex,
  title: string,
  author: string | undefined,
  limit: number
): string[] {
  const query = normalizeText(title.slice(0, 500))
  if (!query) return []

  const tokens = query.split(' ').slice(0, 12)
  const authorQuery = author ? normalizeText(author.slice(0, 300)) : undefined
  const candidates = []

  for (const entry of catalog.entries) {
    const combinedTitle = `${entry.series} ${entry.title}`
    const sharedTokens = tokens.filter((token) => combinedTitle.includes(token)).length
    if (!sharedTokens) continue

    const exactMatch = entry.title === query ? 2 : 0
    const titleMatch = entry.title.includes(query) ? 1 : 0
    const authorMatch = authorQuery && entry.authors.includes(authorQuery) ? 1 : 0
    candidates.push({ entry, score: sharedTokens / tokens.length + exactMatch + titleMatch + authorMatch })
  }

  candidates.sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title))
  const ranked = candidates.slice(0, 200).map(({ entry }) => {
    const titleScore = Math.max(
      textSimilarity(query, entry.title),
      textSimilarity(query, entry.series),
      textSimilarity(query, `${entry.series} ${entry.title}`)
    )
    const authorScore = authorQuery ? textSimilarity(authorQuery, entry.authors) : 0
    const score = authorQuery ? titleScore * 0.8 + authorScore * 0.2 : titleScore

    return { id: entry.id, score }
  })

  return ranked
    .filter((result) => result.score >= 0.45)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit)
    .map((result) => result.id)
}
