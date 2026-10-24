import type { Logger } from 'pino'
import type { AppDeps } from './app.ts'
import type { Config } from './config/env.ts'
import { createGeminiChatModel, createGeminiEmbedder, createGenAI } from './lib/gemini.ts'
import { createAdminClient, createUserClient } from './lib/supabase.ts'
import { createRetriever } from './rag/retriever.ts'
import { createAccountService } from './services/account-service.ts'
import { createAiGuideService, type AiGuideService } from './services/ai-guide-service.ts'
import { createAiStore } from './services/ai-store.ts'
import { createAuthService } from './services/auth-service.ts'
import { createContactService } from './services/contact-service.ts'
import { createProfileService } from './services/profile-service.ts'

/** Real dependencies backed by Supabase. Tests pass fakes to createApp instead. */
export function createDeps(config: Config, logger: Logger): AppDeps {
  const admin = createAdminClient(config)
  const clientFor = (accessToken: string) => createUserClient(config, accessToken)

  return {
    config,
    logger,
    auth: createAuthService(admin),
    profiles: createProfileService(clientFor),
    accounts: createAccountService(admin),
    contact: createContactService(admin),
    aiGuide: createAiGuide(config, admin, clientFor, logger),
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

function createAiGuide(
  config: Config,
  admin: ReturnType<typeof createAdminClient>,
  clientFor: (accessToken: string) => ReturnType<typeof createUserClient>,
  logger: Logger,
): AiGuideService | null {
  if (!config.ai.apiKey) {
    logger.warn('GEMINI_API_KEY is not set: the AI Guide is disabled')
    return null
  }
  const ai = createGenAI(config.ai.apiKey)
  const retriever = createRetriever(admin, createGeminiEmbedder(ai, config.ai.embeddingModel), {
    matchCount: config.ai.matchCount,
    minSimilarity: config.ai.minSimilarity,
  })
  return createAiGuideService(
    createAiStore(admin, clientFor),
    retriever,
    createGeminiChatModel(ai, config.ai.chatModel),
    {
      monthlyMessageLimit: config.ai.monthlyMessageLimit,
      minSimilarity: config.ai.minSimilarity,
    },
  )
}
