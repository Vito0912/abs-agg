import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { ProviderConfig } from '../types'
import { providerConfigSchema } from '../types/config'
import { BaseProvider } from './BaseProvider'

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<string, BaseProvider>()

  register(provider: BaseProvider): void {
    const { id } = provider.getConfig()
    if (this.providers.has(id)) throw new Error(`Duplicate provider ID: ${id}`)

    this.providers.set(id, provider)
  }

  get(providerId: string): BaseProvider | undefined {
    return this.providers.get(providerId)
  }

  getAll(): BaseProvider[] {
    return [...this.providers.values()]
  }

  getAllConfigs(): ProviderConfig[] {
    return this.getAll().map((provider) => provider.getConfig())
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId)
  }

  async loadProviders(providersDir: string): Promise<void> {
    const allowlist = (process.env.PROVIDER_WHITELIST || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const directories = await readdir(providersDir, { withFileTypes: true })

    for (const directory of directories.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!directory.isDirectory()) continue
      const providerPath = path.join(providersDir, directory.name)

      try {
        const config = await this.readConfig(providerPath)
        if (!config || config.available === false) continue
        if (config.id === 'local' && process.env.ENABLE_LOCAL_PROVIDER !== 'true') continue
        if (allowlist.length > 0 && !allowlist.includes(config.id)) continue
        if (!this.hasEnvironment(config)) continue

        const provider = await this.instantiate(providerPath, config)
        if (provider) this.register(provider)
      } catch (error) {
        throw new Error(`Failed to load provider ${directory.name}`, { cause: error })
      }
    }
  }

  private async readConfig(providerPath: string): Promise<ProviderConfig | null> {
    const configPath = path.join(providerPath, 'config.json')
    if (!(await exists(configPath))) return null

    const data: unknown = JSON.parse(await readFile(configPath, 'utf8'))
    return providerConfigSchema.parse(data)
  }

  private hasEnvironment(config: ProviderConfig): boolean {
    const missing = (config.requiredEnv || []).filter((name) => !process.env[name])
    if (missing.length === 0) return true

    console.warn(`Provider ${config.id} disabled: missing ${missing.join(', ')}`)
    return false
  }

  private async instantiate(providerPath: string, config: ProviderConfig): Promise<BaseProvider | null> {
    const javascriptPath = path.join(providerPath, 'index.js')
    const typescriptPath = path.join(providerPath, 'index.ts')
    const modulePath = (await exists(javascriptPath)) ? javascriptPath : typescriptPath
    if (!(await exists(modulePath))) return null

    const moduleValue: unknown = require(modulePath)
    const exports = z.record(z.string(), z.unknown()).parse(moduleValue)
    const constructor = exports.default || exports.Provider
    if (typeof constructor !== 'function') throw new Error('Provider module has no constructor export')

    const instance: unknown = Reflect.construct(constructor, [config])
    if (!(instance instanceof BaseProvider)) throw new Error('Provider must extend BaseProvider')

    return instance
  }
}

export const providerRegistry = new ProviderRegistry()
