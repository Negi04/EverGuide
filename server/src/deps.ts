import type { Logger } from 'pino'
import type { AppDeps } from './app.ts'
import type { Config } from './config/env.ts'
import { createImageStore } from './lib/cloudinary.ts'
import { createPaymentGateway } from './lib/razorpay.ts'
import {
  createGeminiChatModel,
  createGeminiEmbedder,
  createGenAI,
  type ChatModel,
  type Embedder,
} from './lib/gemini.ts'
import { createAdminClient, createAnonClient, createUserClient } from './lib/supabase.ts'
import { createRetriever, type Retriever } from './rag/retriever.ts'
import { createAccountService } from './services/account-service.ts'
import { createAdminService } from './services/admin-service.ts'
import { createAiGuideService } from './services/ai-guide-service.ts'
import { createAiStore } from './services/ai-store.ts'
import { createAuthService } from './services/auth-service.ts'
import { createBillingService } from './services/billing-service.ts'
import { createCareerService } from './services/career-service.ts'
import { createContactService } from './services/contact-service.ts'
import { createFinanceService } from './services/finance-service.ts'
import { createInterviewService } from './services/interview-service.ts'
import { createMentorService } from './services/mentor-service.ts'
import { createNotificationService } from './services/notification-service.ts'
import { createProfileService } from './services/profile-service.ts'
import { createResourcesService } from './services/resources-service.ts'
import { createResumeService } from './services/resume-service.ts'
import { createUsageMeter } from './services/usage-meter.ts'
import { createWellnessService } from './services/wellness-service.ts'

/** Real dependencies backed by Supabase. Tests pass fakes to createApp instead. */
export function createDeps(config: Config, logger: Logger): AppDeps {
  const admin = createAdminClient(config)
  const clientFor = (accessToken: string) => createUserClient(config, accessToken)
  const ai = createAiComponents(config, admin, logger)
  if (!config.razorpay) logger.warn('Razorpay Test Mode keys are not set: demo payments are off')
  const billing = createBillingService(
    admin,
    clientFor,
    config.razorpay ? createPaymentGateway(config.razorpay) : null,
    { freeMonthlyAiLimit: config.ai.monthlyMessageLimit, logger },
  )
  // Every AI feature shares one monthly allowance, sized by the user's plan.
  const monthlyLimitFor = (userId: string) => billing.monthlyAiLimit(userId)
  const aiTools = ai ? { chat: ai.chat, meter: createUsageMeter(admin), monthlyLimitFor } : null

  return {
    config,
    logger,
    auth: createAuthService(admin),
    profiles: createProfileService(clientFor),
    accounts: createAccountService(admin),
    contact: createContactService(admin),
    aiGuide: ai
      ? createAiGuideService(createAiStore(admin, clientFor), ai.retriever, ai.chat, {
          monthlyLimitFor,
          minSimilarity: config.ai.minSimilarity,
        })
      : null,
    career: createCareerService(clientFor, ai?.retriever ?? null),
    interview: createInterviewService(admin, clientFor, aiTools),
    resumes: createResumeService(admin, clientFor, aiTools),
    mentors: createMentorService(admin, clientFor),
    notifications: createNotificationService(clientFor),
    wellness: createWellnessService(clientFor),
    finance: createFinanceService(clientFor),
    admin: createAdminService(
      admin,
      ai ? { embedder: ai.embedder, embeddingModel: config.ai.embeddingModel } : null,
    ),
    resources: createResourcesService(
      createAnonClient(config),
      admin,
      clientFor,
      config.cloudinary ? createImageStore(config.cloudinary) : null,
      logger,
    ),
    billing,
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

/** Gemini-backed search and chat, shared by every AI feature. Null without an API key. */
function createAiComponents(
  config: Config,
  admin: ReturnType<typeof createAdminClient>,
  logger: Logger,
): { retriever: Retriever; chat: ChatModel; embedder: Embedder } | null {
  if (!config.ai.apiKey) {
    logger.warn('GEMINI_API_KEY is not set: AI features are disabled')
    return null
  }
  const genai = createGenAI(config.ai.apiKey)
  const embedder = createGeminiEmbedder(genai, config.ai.embeddingModel)
  return {
    embedder,
    retriever: createRetriever(admin, embedder, {
      matchCount: config.ai.matchCount,
      minSimilarity: config.ai.minSimilarity,
    }),
    chat: createGeminiChatModel(genai, config.ai.chatModel),
  }
}
