import type { InterviewCategory, InterviewDifficulty, InterviewRole } from '@everguide/shared'

export const interviewRoleLabels: Record<InterviewRole, string> = {
  general: 'Any role',
  software_engineer: 'Software engineer',
  data_analyst: 'Data analyst',
  product_manager: 'Product manager',
  designer: 'Designer',
  marketing: 'Marketing',
}

export const interviewCategoryLabels: Record<InterviewCategory, string> = {
  behavioural: 'Behavioural',
  technical: 'Technical',
  situational: 'Situational',
}

export const interviewDifficultyLabels: Record<InterviewDifficulty, string> = {
  foundation: 'Foundation',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}
