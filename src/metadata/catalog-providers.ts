import { dbManager } from '../database/manager'
import { providerRegistry } from '../providers/ProviderRegistry'

export async function availableCatalogProviders(): Promise<string[]> {
  const enabled = new Set(providerRegistry.getAllConfigs().map((config) => config.id))
  const stored = await dbManager.catalogProviders()

  return stored.filter((provider) => provider !== 'local' && enabled.has(provider))
}
