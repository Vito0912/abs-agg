import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { migrateDatabase, openSqlite } from './migration-runner'

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { output: { type: 'string' }, help: { type: 'boolean' } }
  })
  if (values.help || positionals.length !== 1) {
    console.log('Usage: npm run db:migrate -- <database> [--output <new database>]')
    console.log('Startup also migrates automatically. Successful migration backups are deleted; failures retain them.')
    if (!values.help) process.exitCode = 1
    return
  }

  const input = path.resolve(positionals[0])
  const destination = values.output ? path.resolve(values.output) : input
  if (destination !== input && existsSync(destination)) throw new Error('Migration output already exists')
  if (destination !== input) {
    const source = openSqlite(input, true)
    try {
      await source.backup(destination)
    } finally {
      source.close()
    }
  }
  const sqlite = openSqlite(destination, true)
  try {
    const result = await migrateDatabase(sqlite, destination)
    console.log(result.applied.length ? `Applied migrations: ${result.applied.join(', ')}` : 'Database is up to date')
    if (result.rebuilt) console.log('Rebuilt the pre-1.1.0 metadata catalog and caches')
  } finally {
    sqlite.close()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
