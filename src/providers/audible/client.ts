import { httpClient } from '../../utils/httpClient'
import { audibleDetailSchema, audibleSearchSchema } from './schemas'
import type { AudibleProduct, AudibleRegion } from './types'

const domains: Record<AudibleRegion, string> = {
  us: 'com',
  uk: 'co.uk',
  de: 'de',
  fr: 'fr',
  ca: 'ca',
  au: 'com.au',
  it: 'it',
  es: 'es',
  in: 'in',
  jp: 'co.jp',
  br: 'com.br'
}
const responseGroups = [
  'contributors',
  'media',
  'product_attrs',
  'product_desc',
  'product_extended_attrs',
  'rating',
  'series',
  'category_ladders'
].join(',')

export class AudibleClient {
  constructor(private readonly region: AudibleRegion) {}

  async search(title: string, author: string | null, limit: number): Promise<AudibleProduct[]> {
    const response = await httpClient.get(this.catalogUrl(), {
      params: {
        keywords: title,
        author: author || undefined,
        sort_by: 'Relevance',
        num_results: limit,
        page: 0,
        response_groups: responseGroups,
        image_sizes: '500'
      }
    })

    if (response.status !== 200) throw new Error(`Audible search returned HTTP ${response.status}`)

    return audibleSearchSchema.parse(response.data).products.filter(isAudiobook)
  }

  async book(asin: string): Promise<AudibleProduct | null> {
    const response = await httpClient.get(`${this.catalogUrl()}/${encodeURIComponent(asin)}`, {
      params: { response_groups: responseGroups, image_sizes: '500' }
    })

    if (response.status === 404) return null

    const product = audibleDetailSchema.parse(response.data).product
    if (product.asin !== asin) throw new Error('Audible returned a different ASIN than requested')

    return isAudiobook(product) ? product : null
  }

  private catalogUrl(): string {
    return `https://api.audible.${domains[this.region]}/1.0/catalog/products`
  }
}

function isAudiobook(product: AudibleProduct): boolean {
  return product.content_delivery_type === 'SinglePartBook' || product.content_delivery_type === 'MultiPartBook'
}
