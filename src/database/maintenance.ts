import { sql } from 'kysely'
import type { DatabaseCommand } from './protocol'
import type { MetadataDatabase } from './tables'

type PruneCommand = Extract<DatabaseCommand, { operation: 'prune' }>
type ClearCommand = Extract<DatabaseCommand, { operation: 'clear' }>

export class DatabaseMaintenance {
  private nextOptimizationAtMs = Date.now() + 86400000

  constructor(private readonly database: MetadataDatabase) {}

  async clear(command: ClearCommand): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      const maintenance = new DatabaseMaintenance(transaction)
      await transaction
        .updateTable('state')
        .set((expression) => ({ generation: expression('generation', '+', 1) }))
        .where('id', '=', 1)
        .execute()
      await maintenance.deleteProviderData(command)
      await maintenance.deleteUnusedVersions()
    })
  }

  async prune(command: PruneCommand): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      const maintenance = new DatabaseMaintenance(transaction)
      await transaction.deleteFrom('catalog_refreshes').where('next_allowed_at', '<=', command.now).execute()
      await maintenance.deleteUnusedVersions()
    })
    await sql`PRAGMA wal_checkpoint(PASSIVE)`.execute(this.database)
    if (command.now >= this.nextOptimizationAtMs) {
      await sql`PRAGMA optimize`.execute(this.database)
      this.nextOptimizationAtMs = command.now + 86400000
    }
  }

  private async deleteProviderData(command: ClearCommand): Promise<void> {
    let entries = this.database.deleteFrom('search_cache')
    let collections = this.database.deleteFrom('collection_cache')
    let identities = this.database.selectFrom('source_entities').select('entity_key')
    if (command.provider) {
      entries = entries.where('provider', '=', command.provider)
      collections = collections.where('provider', '=', command.provider)
      identities = identities.where('provider', '=', command.provider)
    }

    await entries.execute()
    await collections.execute()
    if (command.catalog) {
      await this.database.deleteFrom('catalog_entities').where('entity_key', 'in', identities).execute()
    }
  }

  private async deleteUnusedVersions(): Promise<void> {
    const cacheReferences = this.database.selectFrom('search_cache_members').select('version_key')
    const catalogReferences = this.database.selectFrom('catalog_entities').select('version_key')
    await this.database
      .deleteFrom('entity_versions')
      .where('version_key', 'not in', cacheReferences)
      .where('version_key', 'not in', catalogReferences)
      .execute()
    await this.database
      .deleteFrom('people')
      .where(
        'person_key',
        'not in',
        this.database.selectFrom('entity_versions').select('person_key').where('person_key', 'is not', null)
      )
      .where('person_key', 'not in', this.database.selectFrom('version_contributors').select('person_key'))
      .execute()
    await this.deleteUnusedIdentities()
    await this.deleteUnusedValues()
  }

  private async deleteUnusedIdentities(): Promise<void> {
    await this.database
      .deleteFrom('source_entities')
      .where((expression) =>
        expression.and([
          expression.not(
            expression.exists(
              expression
                .selectFrom('entity_versions')
                .select('version_key')
                .whereRef('entity_versions.entity_key', '=', 'source_entities.entity_key')
            )
          ),
          expression.not(
            expression.exists(
              expression
                .selectFrom('people')
                .select('person_key')
                .whereRef('people.entity_key', '=', 'source_entities.entity_key')
            )
          ),
          expression.not(
            expression.exists(
              expression
                .selectFrom('version_relations')
                .select('version_key')
                .whereRef('version_relations.target_key', '=', 'source_entities.entity_key')
            )
          ),
          expression.not(
            expression.exists(
              expression
                .selectFrom('version_provenance')
                .select('version_key')
                .whereRef('version_provenance.donor_key', '=', 'source_entities.entity_key')
            )
          ),
          expression.not(
            expression.exists(
              expression
                .selectFrom('collection_members')
                .select('collection_key')
                .whereRef('collection_members.entity_key', '=', 'source_entities.entity_key')
            )
          )
        ])
      )
      .execute()
  }

  private async deleteUnusedValues(): Promise<void> {
    await this.database
      .deleteFrom('identifier_values')
      .where('identifier_key', 'not in', this.database.selectFrom('version_identifiers').select('identifier_key'))
      .where(
        'identifier_key',
        'not in',
        this.database
          .selectFrom('source_entities')
          .select('source_identifier')
          .where('source_identifier', 'is not', null)
      )
      .where(
        'identifier_key',
        'not in',
        this.database
          .selectFrom('version_contributors')
          .select('source_identifier')
          .where('source_identifier', 'is not', null)
      )
      .execute()
    await this.database
      .deleteFrom('scopes')
      .where(
        'scope_key',
        'not in',
        this.database.selectFrom('source_entities').select('scope_key').where('scope_key', 'is not', null)
      )
      .execute()
  }
}
