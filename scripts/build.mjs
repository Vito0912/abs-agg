import { rm, mkdir, readdir, copyFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

await rm('dist', { recursive: true, force: true })

const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc')], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)

const entries = await readdir('src/providers', { withFileTypes: true })

for (const entry of entries) {
  if (!entry.isDirectory()) continue

  const sourceDirectory = path.join('src/providers', entry.name)
  const files = await readdir(sourceDirectory)
  if (!files.includes('config.json')) continue

  const destination = path.join('dist/providers', entry.name)
  await mkdir(destination, { recursive: true })
  await copyFile(path.join('src/providers', entry.name, 'config.json'), path.join(destination, 'config.json'))
}
