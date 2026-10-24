import { pino, type Logger } from 'pino'
import type { Config } from '../config/env.ts'

/**
 * Structured JSON logs in production (easy to search in a log service), readable
 * single-line logs in development. Credentials are redacted before anything is written.
 */
export function createLogger(config: Pick<Config, 'logLevel' | 'nodeEnv'>): Logger {
  return pino({
    level: config.logLevel,
    base: { service: 'everguide-api' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.apikey', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
    transport:
      config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' } }
        : undefined,
  })
}
