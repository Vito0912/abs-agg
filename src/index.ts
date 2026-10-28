import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import type { Server } from 'node:http'
import { providerRegistry } from './providers/ProviderRegistry'
import { router } from './routes'
import { createAuthMiddleware } from './middleware/auth'
import { metadataCache } from './cache/service'
import { dbManager } from './database/manager'
import { closeCatalogCache } from './cache/catalog'

const app = express()
const port = Number(process.env.PORT || 3000)
let server: Server | undefined
let shuttingDown = false

app.use(createAuthMiddleware())
app.use(express.json({ limit: '32kb' }))
app.use('/', router)

app.get('/providers', (_req, res) => {
  const providers = providerRegistry.getAllConfigs()

  res.json({ providers })
})

async function startServer(): Promise<void> {
  await dbManager.generation()
  await dbManager.prune()
  await providerRegistry.loadProviders(path.join(__dirname, 'providers'))

  server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(port, process.env.HOST || '0.0.0.0', (error?: Error) => {
      if (error) reject(error)
      else resolve(listener)
    })
  })

  console.log(`Metadata Provider Server running on port ${port}`)
  const providerIds = providerRegistry.getAllConfigs().map((provider) => provider.id)
  console.log(`Loaded ${providerIds.length} providers: ${providerIds.join(', ') || 'none'}`)
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true

  const deadline = setTimeout(() => {
    console.error('Metadata shutdown timed out')
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
    console.error('Metadata shutdown failed:', error)
    process.exitCode = 1
  } finally {
    await closeCatalogCache()
    await metadataCache.close()
    clearTimeout(deadline)
  }
}

void startServer().catch(async (error: unknown) => {
  console.error('Failed to start server:', error)
  process.exitCode = 1
  await shutdown()
})

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
