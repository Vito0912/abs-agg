import type { Kysely } from 'kysely'

export type MigrationDatabase = Kysely<{ state: { id: number; generation: number } }>
