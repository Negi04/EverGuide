import { createApp } from './app.ts'
import { loadConfig, type Config } from './config/env.ts'
import { createDeps } from './deps.ts'
import { createLogger } from './lib/logger.ts'

let config: Config
try {
  config = loadConfig()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const logger = createLogger(config)
const app = createApp(createDeps(config, logger))

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'EverGuide API listening')
})

// Don't let slow clients hold connections open forever. Keep-alive stays longer than
// typical load-balancer idle timeouts (60s) to avoid dropped connections.
server.requestTimeout = 30_000
server.headersTimeout = 35_000
server.keepAliveTimeout = 65_000

// Graceful shutdown: hosts send SIGTERM before replacing an instance during a deploy.
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection')
  process.exit(1)
})
