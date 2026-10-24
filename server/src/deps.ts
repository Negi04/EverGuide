import type { Logger } from 'pino'
import type { AppDeps } from './app.ts'
import type { Config } from './config/env.ts'
import { createAdminClient, createUserClient } from './lib/supabase.ts'
import { createAccountService } from './services/account-service.ts'
import { createAuthService } from './services/auth-service.ts'
import { createContactService } from './services/contact-service.ts'
import { createProfileService } from './services/profile-service.ts'

/** Real dependencies backed by Supabase. Tests pass fakes to createApp instead. */
export function createDeps(config: Config, logger: Logger): AppDeps {
  const admin = createAdminClient(config)

  return {
    config,
    logger,
    auth: createAuthService(admin),
    profiles: createProfileService((accessToken) => createUserClient(config, accessToken)),
    accounts: createAccountService(admin),
    contact: createContactService(admin),
    checkDatabase: async () => {
      const { error } = await admin
        .from('profiles')
        .select('id')
        .limit(1)
        .abortSignal(AbortSignal.timeout(3000))
      return !error
    },
  }
}
