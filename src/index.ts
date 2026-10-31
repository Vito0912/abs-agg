import { shutdownTelemetry } from './telemetry/sdk'
import express from 'express'
import { observeHttpRequest } from './telemetry/http'
import { errorAttributes, logger } from './telemetry/logger'
import path from 'node:path'
import type { Server } from 'node:http'
import { providerRegistry } from './providers/ProviderRegistry'
import { router } from './routes'
import { createAuthMiddleware } from './middleware/auth'
import { handleRequestError } from './middleware/errors'
import { metadataCache } from './cache/service'
import { dbManager } from './database/manager'
import { closeCatalogCache } from './cache/catalog'
import { startCatalogMetrics } from './telemetry/catalog'

const app = express()
app.disable('x-powered-by')
const port = Number(process.env.PORT || 3000)
let server: Server | undefined
let shuttingDown = false
let stopCatalogMetrics: (() => void) | undefined

app.use(observeHttpRequest)
app.use(createAuthMiddleware())
app.use(express.json({ limit: '32kb' }))
app.use('/', router)

app.get('/providers', (_req, res) => {
  const providers = providerRegistry.getAllConfigs()

  res.json({ providers })
})

app.use(handleRequestError)

async function startServer(): Promise<void> {
  await dbManager.generation()
  await dbManager.prune()
  await providerRegistry.loadProviders(path.join(__dirname, 'providers'))
  stopCatalogMetrics = startCatalogMetrics(providerRegistry.getAllConfigs().map((provider) => provider.id))

  server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(port, process.env.HOST || '0.0.0.0', (error?: Error) => {
      if (error) reject(error)
      else resolve(listener)
    })
  })

  logger.info('Metadata Provider Server started', { port })
  const providerIds = providerRegistry.getAllConfigs().map((provider) => provider.id)
  logger.info('Providers loaded', { count: providerIds.length, providers: providerIds })
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  const deadline = setTimeout(() => {
    logger.error('Metadata shutdown timed out')
    process.exit(1)
  }, 45000)
  deadline.unref()

  try {
    if (server?.listening) {
      const currentServer = server
      await new Promise<void>((resolve, reject) => {
        currentServer.close((error) => (error ? reject(error) : resolve()))
      })
    }
  } catch (error) {
    logger.error('Metadata shutdown failed', { ...errorAttributes(error) })
    process.exitCode = 1
  }

  await closeResources()
  clearTimeout(deadline)
}

async function closeResources(): Promise<void> {
  stopCatalogMetrics?.()

  const resources = [
    { name: 'Catalog cache', close: closeCatalogCache },
    { name: 'Metadata cache', close: () => metadataCache.close() },
    { name: 'Telemetry', close: shutdownTelemetry }
  ]

  for (const resource of resources) {
    try {
      await resource.close()
    } catch (error) {
      logger.error('Resource shutdown failed', { resource: resource.name, ...errorAttributes(error) })
      process.exitCode = 1
    }
  }
}

void startServer().catch(async (error: unknown) => {
  logger.error('Failed to start server', { ...errorAttributes(error) })
  process.exitCode = 1
  await shutdown()
})

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
