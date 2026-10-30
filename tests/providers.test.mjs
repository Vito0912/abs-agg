import { config } from 'dotenv'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

config({ quiet: true })
const directory = mkdtempSync(path.join(tmpdir(), 'abs-agg-provider-tests-'))
process.env.METADATA_DATABASE_PATH = path.join(directory, 'metadata.sqlite')
process.env.ENABLE_CROSS_PROVIDER_ENRICHMENT = 'false'

const require = createRequire(import.meta.url)
const { runWithContext } = require('../dist/utils/requestContext.js')
const { absMatches } = require('../dist/metadata/projection.js')
const { metadataBundleSchema } = require('../dist/types/metadata.js')
const { providerConfigSchema } = require('../dist/types/config.js')
const { errorAttributes } = require('../dist/telemetry/logger.js')
const { closeCatalogCache } = require('../dist/cache/catalog.js')
const { metadataCache } = require('../dist/cache/service.js')

const providerCases = {
  ardaudiothek: { title: 'Sherlock Holmes', params: { searchType: 'search' } },
  audible: { title: 'The Hobbit', params: { region: 'us' } },
  audiosilo: { title: 'The Hobbit' },
  audioteka: { title: 'Harry', params: { lang: 'de' } },
  bigfinish: { title: 'Doctor Who' },
  bookbeat: { title: 'Harry Potter', params: { market: 'de' } },
  deezer: { title: 'Folge 001', author: 'Die drei ???' },
  dreifragezeichen: { title: 'Super-Papagei' },
  elevenreader: { title: 'Pride and Prejudice' },
  graphicaudio: { title: 'Mistborn' },
  hardcover: { title: 'Umbra: Sentient Stars', author: 'Amber Toro', params: { limit: 10 } },
  librivox: { title: 'Pride and Prejudice' },
  librofm: { title: 'The Hobbit' },
  nextory: { title: 'Harry Potter', params: { market: 'DE' } },
  overdrive: { title: 'The Hobbit', params: { library: 'lapl' } },
  podium: { title: 'He Who Fights with Monsters' },
  skoobe: { title: 'Harry Potter', params: { type: 'all' } },
  soundbooththeater: { title: 'Dungeon Crawler Carl' },
  storygraph: { title: 'The Hobbit' },
  storytel: { title: 'Harry Potter', params: { language: 'de' } }
}

after(async () => {
  await closeCatalogCache()
  await metadataCache.close()
  await rm(directory, { recursive: true, force: true })
})

function providerConfig(id) {
  const url = new URL(`../src/providers/${id}/config.json`, import.meta.url)

  return providerConfigSchema.parse(JSON.parse(readFileSync(url, 'utf8')))
}

async function searchProvider(id, config, searchCase) {
  const Provider = require(`../dist/providers/${id}/index.js`).default
  const provider = new Provider(config)
  const defaults = Object.fromEntries(
    config.parameters
      .filter((parameter) => parameter.default !== undefined)
      .map((parameter) => [parameter.name, parameter.default])
  )
  const { title, author, params } = searchCase
  const bundle = await runWithContext('refresh', () => {
    return provider.searchMetadata({ title, author }, { ...defaults, limit: 1, ...params })
  })
  metadataBundleSchema.parse(bundle)

  return { bundle, matches: absMatches(bundle) }
}

for (const [id, searchCase] of Object.entries(providerCases)) {
  const config = providerConfig(id)
  if (config.available === false) continue

  const missing = (config.requiredEnv || []).filter((name) => !process.env[name])
  const skip = missing.length ? `Missing environment variables: ${missing.join(', ')}` : undefined

  test(`${id}: live search returns usable ABS metadata`, { skip, timeout: 90000 }, async (context) => {
    try {
      const { bundle, matches } = await searchProvider(id, config, searchCase)

      assert.ok(matches.length > 0, `${id} returned no matches for ${JSON.stringify(searchCase.title)}`)
      assert.equal(bundle.complete, true, `${id} returned incomplete metadata`)
      for (const match of matches) {
        assert.ok(match.title.trim(), `${id} returned an empty title`)
        assert.ok(match.bookId, `${id} returned no source identifier`)
        assert.ok(!/^https?:\/\//.test(match.bookId), `${id} uses a URL as its source identifier`)
      }
      context.diagnostic(`${matches.length} match(es); first title: ${matches[0].title}`)
    } catch (error) {
      if (error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues)) {
        const issues = error.issues.map((issue) => ({ path: issue.path, code: issue.code, expected: issue.expected }))
        context.diagnostic(`Upstream schema issues: ${JSON.stringify(issues)}`)
      }
      if (error instanceof assert.AssertionError) throw error

      assert.fail(`${id} live request failed: ${JSON.stringify(errorAttributes(error))}`)
    }
  })
}
