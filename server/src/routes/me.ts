import { deleteAccountSchema, onboardingSchema, profileUpdateSchema } from '@everguide/shared'
import { Router } from 'express'
import { parse } from '../lib/validation.ts'
import { requireAuth, userContext } from '../middleware/auth.ts'
import type { AccountService } from '../services/account-service.ts'
import type { AuthService } from '../services/auth-service.ts'
import type { ProfileService } from '../services/profile-service.ts'

/** The signed-in user's own account. The user ID always comes from the verified token. */
export function meRouter(
  auth: AuthService,
  profiles: ProfileService,
  accounts: AccountService,
): Router {
  const router = Router()
  router.use(requireAuth(auth))

  router.get('/', async (req, res) => {
    res.json(await profiles.getMe(userContext(req)))
  })

  router.patch('/profile', async (req, res) => {
    const input = parse(profileUpdateSchema, req.body)
    res.json(await profiles.updateProfile(userContext(req), input))
  })

  router.put('/onboarding', async (req, res) => {
    const input = parse(onboardingSchema, req.body)
    res.json(await profiles.saveOnboarding(userContext(req), input))
  })

  router.delete('/', async (req, res) => {
    parse(deleteAccountSchema, req.body)
    await accounts.deleteAccount(userContext(req).userId, String(req.id))
    res.status(204).end()
  })

  return router
}
