import type { Request } from 'express'

const browserUserAgent = /^(?:Mozilla|Opera|Chrome|Chromium|Firefox|Safari|Edg|Edge|OPR)\//i

export const browserSourceError =
  'Requests using a generic browser User-Agent must include a valid Origin or Referer header. ' +
  'Automated clients must set an application-specific User-Agent, such as MyApp/1.0 (+https://myapp.example.com). ' +
  'If your client cannot meet these requirements, please self-host abs-agg'

function websiteUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (url.username || url.password) return undefined

    return url
  } catch {
    return undefined
  }
}

export function shouldRejectBrowserRequest(req: Request): boolean {
  if (process.env.REQUIRE_BROWSER_SOURCE !== 'true') return false
  if (!browserUserAgent.test((req.get('User-Agent') || '').trim())) return false

  const origin = websiteUrl(req.get('Origin'))
  const validOrigin = origin && origin.pathname === '/' && !origin.search && !origin.hash
  const referer = websiteUrl(req.get('Referer'))

  return !validOrigin && !referer
}
