import Database from 'better-sqlite3'
import { z } from 'zod'
import { Kysely, SqliteAdapter, SqliteDialect, sql } from 'kysely'
import { Migrator } from 'kysely/migration'
import type { Migration } from 'kysely/migration'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { migrations, latestSchemaVersion } from './migrations'
import type { DatabaseTables, MetadataDatabase } from './tables'

export interface MigrationResult {
  applied: string[]
  rebuilt: boolean
}

export async function migrateDatabase(sqlite: Database.Database, databasePath: string): Promise<MigrationResult> {
  const version = sqlite.pragma('user_version', { simple: true })
  if (typeof version !== 'number' || version > latestSchemaVersion) {
    throw new Error('Database was created by an unsupported newer application version')
  }
  const database = new Kysely<DatabaseTables>({ dialect: new MigrationSqliteDialect({ database: sqlite }) })
  const migrator = new Migrator({
    db: database,
    provider: { getMigrations: async () => validatedMigrations() },
    migrationTableName: 'database_migrations',
    migrationLockTableName: 'database_migration_lock'
  })
  const available = await migrator.getMigrations()
  const pending = available.filter((migration) => !migration.executedAt)
  let backupPath: string | undefined

  if (pending.length > 0 && version > 0) {
    backupPath = `${databasePath}.pre-migration-${randomUUID()}.sqlite`
    await sqlite.backup(backupPath)
  }
  if (version === 0) await ensureEmptyDatabase(database)

  const recovery = backupPath ? ` A backup was retained at ${backupPath}.` : ''
  sqlite.pragma('foreign_keys = OFF')
  try {
    const result = await migrator.migrateToLatest()
    if (result.error) {
      const cause = result.error instanceof Error ? result.error : new Error(String(result.error))
      throw new Error(`Metadata migration failed: ${cause.message}${recovery}`, { cause })
    }
    if (
      sqlite.pragma('integrity_check', { simple: true }) !== 'ok' ||
      z.array(z.unknown()).parse(sqlite.pragma('foreign_key_check')).length !== 0
    ) {
      throw new Error(`Migrated database validation failed.${recovery}`)
    }
    if (pending.length > 0) {
      sqlite.exec('VACUUM')
      sqlite.pragma('optimize')
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
    }
    if (backupPath) await unlink(backupPath)

    return {
      applied:
        result.results
          ?.filter((migration) => migration.status === 'Success')
          .map((migration) => migration.migrationName) ?? [],
      rebuilt: pending.length > 0 && (version === 1 || version === 2)
    }
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
}

async function ensureEmptyDatabase(database: MetadataDatabase): Promise<void> {
  const tables = await database.introspection.getTables()
  const applicationTables = tables.filter(
    (table) =>
      !table.name.startsWith('sqlite_') &&
      table.name !== 'database_migrations' &&
      table.name !== 'database_migration_lock'
  )
  if (applicationTables.length > 0)
    throw new Error('The unversioned database is not empty. Automatic schema creation was refused.')
}

export function openSqlite(databasePath: string, fileMustExist = false): Database.Database {
  if (fileMustExist && !existsSync(databasePath)) throw new Error('Metadata database does not exist')
  const sqlite = new Database(databasePath, { fileMustExist, timeout: 5000 })
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('analysis_limit = 400')
  return sqlite
}

function validatedMigrations(): Record<string, Migration> {
  const validated: Record<string, Migration> = {}
  for (const [name, migration] of Object.entries(migrations)) {
    validated[name] = {
      async up(database) {
        await migration.up(database)
        const foreignKeys = await sql`PRAGMA foreign_key_check`.execute(database)
        if (foreignKeys.rows.length > 0) throw new Error(`Foreign key validation failed in ${name}`)
        const integrity = await sql`PRAGMA integrity_check`.execute(database)
        z.array(z.object({ integrity_check: z.literal('ok') }))
          .length(1)
          .parse(integrity.rows)
      }
    }
  }
  return validated
}

class TransactionalSqliteAdapter extends SqliteAdapter {
  override get supportsTransactionalDdl(): boolean {
    return true
  }
}

class MigrationSqliteDialect extends SqliteDialect {
  override createAdapter(): SqliteAdapter {
    return new TransactionalSqliteAdapter()
  }
}
