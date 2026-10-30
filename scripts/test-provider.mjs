import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const [id, ...options] = process.argv.slice(2)
const providersDirectory = new URL('../src/providers/', import.meta.url)
const availabilitySchema = z.object({ available: z.boolean().optional() })
const providerIds = readdirSync(providersDirectory, { withFileTypes: true })
  .filter((entry) => {
    if (!entry.isDirectory() || ['local'].includes(entry.name)) return false
    if (!existsSync(new URL(`${entry.name}/index.ts`, providersDirectory))) return false

    const configUrl = new URL(`${entry.name}/config.json`, providersDirectory)
    const config = availabilitySchema.parse(JSON.parse(readFileSync(configUrl, 'utf8')))

    return config.available !== false
  })
  .map((entry) => entry.name)
if ((id && id !== 'all' && !providerIds.includes(id)) || options.length) {
  console.error(`Usage: npm run test:provider -- <${providerIds.join('|')}|all>`)
  process.exit(1)
}

const argumentsList = ['--test', '--test-concurrency=1']
if (id && id !== 'all') argumentsList.push(`--test-name-pattern=^${id}:`)
argumentsList.push(fileURLToPath(new URL('../tests/providers.test.mjs', import.meta.url)))

const result = spawnSync(process.execPath, argumentsList, { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status || (result.signal ? 1 : 0)
