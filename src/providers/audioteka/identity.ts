import { z } from 'zod'
import type { CheerioAPI } from 'cheerio'

const productIdentitySchema = z.object({ id: z.uuid(), slug: z.string().min(1) })
const flightPrefix = 'self.__next_f.push('

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch (error) {
    if (error instanceof SyntaxError) return undefined
    throw error
  }
}

function collectProductIds(value: unknown, ids: Map<string, string>, depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 64) return

  if ('app:product' in value) {
    const products = productIdentitySchema.array().parse(value['app:product'])
    for (const product of products) {
      const previous = ids.get(product.slug)
      if (previous && previous !== product.id) throw new Error('Ambiguous Audioteka product slug')
      ids.set(product.slug, product.id)
    }
    return
  }

  for (const child of Object.values(value)) collectProductIds(child, ids, depth + 1)
}

export function audiotekaProductIds($: CheerioAPI): Map<string, string> {
  const chunks: string[] = []
  for (const script of $('script').toArray()) {
    const text = $(script).text().trim()
    if (!text.startsWith(flightPrefix) || !text.endsWith(')')) continue

    const chunk = z.tuple([z.number(), z.string()]).safeParse(parseJson(text.slice(flightPrefix.length, -1)))
    if (chunk.success && chunk.data[0] === 1) chunks.push(chunk.data[1])
  }

  const ids = new Map<string, string>()
  for (const line of chunks.join('').split('\n')) {
    const row = /^[\da-f]+:([\[{].*)$/i.exec(line)
    if (row) collectProductIds(parseJson(row[1]), ids)
  }

  return ids
}
