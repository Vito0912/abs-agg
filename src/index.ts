import 'dotenv/config'
import express from 'express'
import path from 'path'
import { providerRegistry } from './providers/ProviderRegistry'
import { router } from './routes'
import { createAuthMiddleware } from './middleware/auth'

const app = express()
const PORT = process.env.PORT || 3000

app.use(createAuthMiddleware())
app.use(express.json())

app.use('/', router)

app.get('/providers', (_req, res) => {
  const configs = providerRegistry.getAllConfigs()
  res.json({ providers: configs })
})

async function startServer(): Promise<void> {
  const providersPath = path.join(__dirname, 'providers')

  await providerRegistry.loadProviders(providersPath)

  app.listen(PORT, () => {
    console.log(`Metadata Provider Server running on port ${PORT}`)
    console.log(`Loaded ${providerRegistry.getAll().length} provider(s)`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...')
  process.exit(0)
})
