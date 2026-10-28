import type { MetadataEntity } from '../types'
import { normalizeText } from './identity'

function editSimilarity(left: string, right: string): number {
  const a = [...left.slice(0, 200)]
  const b = [...right.slice(0, 200)]
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let row = 1; row <= a.length; row++) {
    const current = [row]

    for (let column = 1; column <= b.length; column++) {
      const substitution = previous[column - 1] + Number(a[row - 1] !== b[column - 1])
      current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, substitution)
    }

    previous = current
  }

  const length = Math.max(a.length, b.length)
  return length === 0 ? 1 : 1 - previous[b.length] / length
}

export function textSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  if (!normalizedLeft || !normalizedRight) return 0
  if (normalizedLeft === normalizedRight) return 1

  const leftTokens = new Set(normalizedLeft.split(' '))
  const rightTokens = new Set(normalizedRight.split(' '))
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const tokenScore = shared / Math.max(leftTokens.size, rightTokens.size)
  const distanceScore = editSimilarity(normalizedLeft, normalizedRight)

  return Math.max(tokenScore, distanceScore)
}

function hasConflictingNumbers(query: string, name: string): boolean {
  const queryNumbers = query.match(/\d+/g) || []
  const nameNumbers = name.match(/\d+/g) || []

  return queryNumbers.length > 0 && nameNumbers.length > 0 && queryNumbers.join(',') !== nameNumbers.join(',')
}

export function rankCandidates(candidates: MetadataEntity[], title: string, author?: string): MetadataEntity[] {
  const scored = candidates.map((entity) => {
    let score = textSimilarity(title, entity.name)
    if (hasConflictingNumbers(title, entity.name)) score *= 0.3

    if (author && 'contributors' in entity) {
      const names = entity.contributors.filter((person) => person.role === 'author')
      const authorScore = Math.max(0, ...names.map((person) => textSimilarity(author, person.name)))
      score = score * 0.8 + authorScore * 0.2
    }

    return { entity, score }
  })

  return scored
    .filter((result) => result.score >= 0.45)
    .sort((left, right) => right.score - left.score || left.entity.id.localeCompare(right.entity.id))
    .map((result) => result.entity)
}
