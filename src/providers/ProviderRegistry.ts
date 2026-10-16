import fs from 'fs'
import path from 'path'
import { BaseProvider } from './BaseProvider'
import { ProviderConfig } from '../types'

export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map()

  public register(provider: BaseProvider): void {
    const config = provider.getConfig()
    this.providers.set(config.id, provider)
  }

  public get(providerId: string): BaseProvider | undefined {
    return this.providers.get(providerId)
  }

  public getAll(): BaseProvider[] {
    return Array.from(this.providers.values())
  }

  public getAllConfigs(): ProviderConfig[] {
    return this.getAll().map((p) => p.getConfig())
  }

  public has(providerId: string): boolean {
    return this.providers.has(providerId)
  }

  public async loadProviders(providersDir: string): Promise<void> {
    const allowedProviders = new Set(
      (process.env.PROVIDER_WHITELIST || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    )
    const providerDirs = fs.readdirSync(providersDir).filter((dir) => {
      const fullPath = path.join(providersDir, dir)
      return fs.statSync(fullPath).isDirectory()
    })

    for (const dir of providerDirs) {
      const providerPath = path.join(providersDir, dir)
      const configPath = path.join(providerPath, 'config.json')

      const indexJsPath = path.join(providerPath, 'index.js')
      const indexTsPath = path.join(providerPath, 'index.ts')
      const indexPath = fs.existsSync(indexJsPath) ? indexJsPath : indexTsPath

      if (!fs.existsSync(configPath)) {
        console.warn(`No config.json found for provider: ${dir}`)
        continue
      }

      if (!fs.existsSync(indexPath)) {
        console.warn(`No index.js or index.ts found for provider: ${dir}`)
        continue
      }

      try {
        const configContent = fs.readFileSync(configPath, 'utf-8')
        const config = JSON.parse(configContent) as ProviderConfig

        if (allowedProviders.size > 0 && !allowedProviders.has(config.id)) {
          continue
        }

        if (config.requiredEnv && config.requiredEnv.length > 0) {
          const missingEnvVars = config.requiredEnv.filter((envVar) => !process.env[envVar])
          if (missingEnvVars.length > 0) {
            console.warn(
              `Provider ${config.name} (${config.id}) disabled: missing env vars: ${missingEnvVars.join(', ')}`
            )
            config.available = false
          }
        }

        if (config.available === false) {
          console.log(`Skipping disabled provider: ${config.name} (${config.id})`)
          continue
        }

        const providerModule = require(indexPath)
        const ProviderClass = providerModule.default || providerModule.Provider

        if (!ProviderClass) {
          console.warn(`No default export found in provider: ${dir}`)
          continue
        }

        const provider = new ProviderClass(config) as BaseProvider
        this.register(provider)
        console.log(`Loaded provider: ${config.name} (${config.id})`)
      } catch (error) {
        console.error(`Failed to load provider ${dir}:`, error)
      }
    }
  }
}

export const providerRegistry = new ProviderRegistry()
