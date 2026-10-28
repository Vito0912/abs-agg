import { sql } from 'kysely'
import type { DatabaseCommand } from './protocol'
import type { MetadataDatabase } from './tables'

type PruneCommand = Extract<DatabaseCommand, { operation: 'prune' }>
type ClearCommand = Extract<DatabaseCommand, { operation: 'clear' }>

export class DatabaseMaintenance {
  constructor(private readonly database: MetadataDatabase) {}

  async clear(command: ClearCommand): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      const maintenance = new DatabaseMaintenance(transaction)
      await transaction
        .updateTable('state')
        .set((expression) => ({
          generation: expression('generation', '+', 1)
        }))
        .where('id', '=', 1)
        .execute()

      await maintenance.deleteProviderData(command)
      await maintenance.deleteUnusedSnapshots()
    })
  }

  async prune(command: PruneCommand): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      const maintenance = new DatabaseMaintenance(transaction)
      await maintenance.deleteExpiredRefreshGuards(command)
      await maintenance.deleteUnusedSnapshots()
    })

    await sql`PRAGMA wal_checkpoint(PASSIVE)`.execute(this.database)
  }

  private async deleteProviderData(command: ClearCommand): Promise<void> {
    let entries = this.database.deleteFrom('cache_entries')
    let catalogs = this.database.deleteFrom('catalog_cache')
    let entities = this.database.deleteFrom('entities')

    if (command.provider) {
      entries = entries.where('provider', '=', command.provider)
      catalogs = catalogs.where('provider', '=', command.provider)
      entities = entities.where('provider', '=', command.provider)
    }

    await entries.execute()
    await catalogs.execute()
    if (command.catalog) await entities.execute()
  }

  private async deleteExpiredRefreshGuards(command: PruneCommand): Promise<void> {
    await this.database.deleteFrom('catalog_refreshes').where('next_allowed_at', '<=', command.now).execute()
  }

  private async deleteUnusedSnapshots(): Promise<void> {
    const referenced = this.database.selectFrom('cache_references').select('revision')
    await this.database.deleteFrom('snapshots').where('revision', 'not in', referenced).execute()
  }
}
