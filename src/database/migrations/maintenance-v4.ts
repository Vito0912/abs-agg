import type { Version4Database } from './schema-v4'

export class Version4Maintenance {
  constructor(private readonly database: Version4Database) {}

  async deleteUnusedVersions(): Promise<void> {
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
