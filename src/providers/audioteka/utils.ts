import * as cheerio from 'cheerio'
import { AudiotekaLanguageConfig, AudiotekaSearchMatch, AudiotekaFullMetadata } from './types'

const BASE_URL = 'https://audioteka.com'

export function cleanCoverUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.split('?')[0]
}

export function parseDuration(durationStr: string | undefined): number | undefined {
  if (!durationStr) return undefined

  let hours = 0
  let minutes = 0

  const durationRegex = /^(?:(\d+)\s+[^\d\s]+)?\s*(?:(\d+)\s+[^\d\s]+)?$/
  const matches = durationStr.match(durationRegex)

  if (matches) {
    if (matches[1]) {
      hours = parseInt(matches[1], 10)
    }
    if (matches[2]) {
      minutes = parseInt(matches[2], 10)
    }
  } else {
    return undefined
  }

  if (isNaN(hours)) hours = 0
  if (isNaN(minutes)) minutes = 0

  const durationInMinutes = hours * 60 + minutes
  return durationInMinutes > 0 ? durationInMinutes : undefined
}

export function extractLabeledValue($: cheerio.CheerioAPI, labels: string[], findLinks: boolean = false): string {
  for (const label of labels) {
    const tableValue = $('table tr')
      .filter(function () {
        const text = $(this).find('td:first-child').text().trim()
        return text === label
      })
      .find('td:last-child')

    if (tableValue.length > 0) {
      if (findLinks) {
        const links = tableValue.find('a')
        if (links.length > 0) {
          return links
            .map((_, el) => $(el).text().trim())
            .get()
            .join(', ')
        }
      }
      const text = tableValue.text().trim()
      if (text) return text
    }
  }

  for (const label of labels) {
    let result = ''
    $('dt').each((_, el) => {
      const text = $(el).text().trim()
      if (text === label) {
        const ddElement = $(el).next('dd')
        if (findLinks) {
          const ddLinks = ddElement.find('a')
          if (ddLinks.length > 0) {
            result = ddLinks
              .map((_, linkEl) => $(linkEl).text().trim())
              .get()
              .join(', ')
          }
        }
        if (!result) {
          result = ddElement.text().trim()
        }
      }
    })
    if (result) return result
  }

  for (const label of labels) {
    const divValue = $('.product-detail-item')
      .filter(function () {
        return $(this).find('.label').text().trim() === label
      })
      .find('.value')

    if (divValue.length > 0) {
      if (findLinks) {
        const links = divValue.find('a')
        if (links.length > 0) {
          return links
            .map((_, el) => $(el).text().trim())
            .get()
            .join(', ')
        }
      }
      const text = divValue.text().trim()
      if (text) return text
    }
  }

  return ''
}

export function extractLabeledArray($: cheerio.CheerioAPI, labels: string[]): string[] {
  for (const label of labels) {
    const values = $('table tr')
      .filter(function () {
        const text = $(this).find('td:first-child').text().trim()
        return text === label
      })
      .find('td:last-child a')
      .map((_, el) => $(el).text().trim())
      .get()

    if (values.length > 0) return values
  }

  for (const label of labels) {
    let result: string[] = []
    $('dt').each((_, el) => {
      const text = $(el).text().trim()
      if (text === label) {
        result = $(el)
          .next('dd')
          .find('a')
          .map((_, linkEl) => $(linkEl).text().trim())
          .get()
      }
    })
    if (result.length > 0) return result
  }

  for (const label of labels) {
    const values = $('.product-detail-item')
      .filter(function () {
        return $(this).find('.label').text().trim() === label
      })
      .find('.value a')
      .map((_, el) => $(el).text().trim())
      .get()

    if (values.length > 0) return values
  }

  return []
}

export function parseSearchResults($: cheerio.CheerioAPI): AudiotekaSearchMatch[] {
  const matches: AudiotekaSearchMatch[] = []
  const $books = $('li[class*="teaser_teaser__"]')

  $books.each((_, element) => {
    const $book = $(element)

    const title = $book.find('[class*="teaser_title__"]').text().trim()
    const bookPath = $book.find('[class*="teaser_link__"]').attr('href')
    const bookUrl = bookPath ? BASE_URL + bookPath : ''
    const author = $book.find('[class*="teaser_author__"]').text().trim()
    const cover = cleanCoverUrl($book.find('[class*="teaser_coverImage__"]').attr('src'))
    const rating = parseFloat($book.find('[class*="teaser-footer_rating__"]').text().trim()) || undefined

    const id = $book.attr('data-item-id') || bookUrl.split('/').pop() || ''

    if (title && bookUrl && author) {
      matches.push({
        id,
        title,
        authors: [author],
        url: bookUrl,
        cover,
        rating
      })
    }
  })

  return matches
}

export function parseBookDetails(
  $: cheerio.CheerioAPI,
  match: AudiotekaSearchMatch,
  langConfig: AudiotekaLanguageConfig
): AudiotekaFullMetadata {
  const labels = langConfig.labels

  let narrator = extractLabeledValue($, labels.narrator, true)

  if (narrator && !narrator.includes(',')) {
    if (narrator.match(/[a-ząćęłńóśźż][A-ZĄĆĘŁŃÓŚŹŻ]/)) {
      narrator = narrator.replace(/([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])/g, '$1, $2')
    }
    if (narrator.match(/[a-záčďéěíňóřšťúůýž][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/)) {
      narrator = narrator.replace(/([a-záčďéěíňóřšťúůýž])([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])/g, '$1, $2')
    }
    if (narrator.match(/[a-zäöüß][A-ZÄÖÜ]/)) {
      narrator = narrator.replace(/([a-zäöüß])([A-ZÄÖÜ])/g, '$1, $2')
    }
    if (narrator.match(/[a-ząčęėįšųūž][A-ZĄČĘĖĮŠŲŪŽ]/)) {
      narrator = narrator.replace(/([a-ząčęėįšųūž])([A-ZĄČĘĖĮŠŲŪŽ])/g, '$1, $2')
    }
  }

  const durationStr = extractLabeledValue($, labels.duration)
  const duration = parseDuration(durationStr)

  const publisher = extractLabeledValue($, labels.publisher, true) || extractLabeledValue($, labels.publisher)

  const genres = extractLabeledArray($, labels.category)

  const series = $('.collections_list__09q3I li a, .product-series a, .series-info a')
    .map((_, el) => $(el).text().trim())
    .get()

  const descriptionHtml = $(
    '.description_description__6gcfq, .product-description, .book-description, .product-desc'
  ).html()

  let description: string | undefined
  if (descriptionHtml) {
    description = descriptionHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
  }

  const cover =
    cleanCoverUrl(
      $('.product-top_cover__Pth8B, .product-cover img, .book-cover img, .product-image img').attr('src')
    ) || match.cover

  return {
    ...match,
    cover,
    narrator: narrator || undefined,
    duration,
    publisher: publisher || undefined,
    description,
    genres: genres.length > 0 ? genres : undefined,
    series: series.length > 0 ? series : undefined,
    language: langConfig.languageName
  }
}
