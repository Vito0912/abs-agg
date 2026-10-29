const allowedHosts = new Set([
  'api.ardaudiothek.de',
  'api.audible.com',
  'api.audible.co.uk',
  'api.audible.de',
  'api.audible.fr',
  'api.audible.ca',
  'api.audible.com.au',
  'api.audible.it',
  'api.audible.es',
  'api.audible.in',
  'api.audible.co.jp',
  'api.audible.com.br',
  'meta.audiosilo.app',
  'audioteka.com',
  'www.bigfinish.com',
  'search-api.bookbeat.com',
  'api.deezer.com',
  'dreimetadaten.de',
  'api.elevenlabs.io',
  'www.goodreads.com',
  'raw.githubusercontent.com',
  'api.hardcover.app',
  'librivox.org',
  'libro.fm',
  'api.nextory.com',
  'thunder.api.overdrive.com',
  'podiumentertainment.com',
  'www.skoobe.de',
  'api.soundbooththeater.com',
  'app.thestorygraph.com',
  'www.storytel.com',
  'app.thalia.de'
])

export class OutboundPolicyError extends Error {
  readonly code = 'ERR_UPSTREAM_DESTINATION'

  constructor() {
    super('Upstream destination is not permitted')
    this.name = 'OutboundPolicyError'
  }
}

export function validateUpstreamUrl(value: string): URL {
  if (value.length > 8192 || /[\s\\]/.test(value)) throw new OutboundPolicyError()

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new OutboundPolicyError()
  }

  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !allowedHosts.has(url.hostname)
  ) {
    throw new OutboundPolicyError()
  }

  return url
}

export function resolveProviderUrl(value: string, origin: string): string {
  if (/[\s\\]/.test(value)) throw new OutboundPolicyError()

  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    throw new OutboundPolicyError()
  }

  validateUpstreamUrl(url.href)
  if (url.origin !== origin) throw new OutboundPolicyError()

  return url.href
}
