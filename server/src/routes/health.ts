import { Router } from 'express'

/**
 * Liveness (/health): the process is up — used by the host to restart a dead server.
 * Readiness (/health/ready): dependencies are reachable — used before sending traffic.
 */
export function healthRouter(checkDatabase: () => Promise<boolean>): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) })
  })

  router.get('/ready', async (_req, res) => {
    const database = await checkDatabase()
    res.status(database ? 200 : 503).json({
      status: database ? 'ready' : 'unavailable',
      checks: { database: database ? 'ok' : 'failing' },
    })
  })

  return router
}
