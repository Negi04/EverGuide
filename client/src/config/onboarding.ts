import type { GuidanceDomain, LifeStage, PrimaryGoal, SkillLevel } from '@everguide/shared'

export const lifeStageOptions: Record<LifeStage, { label: string; hint: string }> = {
  school_student: { label: 'At school', hint: 'Exploring subjects and what comes next' },
  college_student: {
    label: 'In college or university',
    hint: 'Studying and thinking about a first role',
  },
  recent_graduate: { label: 'Recently graduated', hint: 'Looking for a first or better job' },
  early_career: {
    label: 'Early in my career',
    hint: 'Working, with up to a few years of experience',
  },
  mid_career: { label: 'Mid-career', hint: 'Experienced and planning the next step' },
  career_changer: { label: 'Changing careers', hint: 'Moving into a different field' },
  other: { label: 'Something else', hint: 'None of these quite fit' },
}

export const goalLabels: Record<PrimaryGoal, string> = {
  choose_a_path: 'Choose a study or career path',
  find_first_job: 'Find my first job',
  switch_careers: 'Switch careers',
  grow_in_current_role: 'Grow in my current role',
  prepare_for_interviews: 'Prepare for interviews',
  build_skills: 'Build new skills',
  manage_stress: 'Manage stress',
  build_healthy_habits: 'Build healthy habits',
  manage_money: 'Manage my money better',
}

export const skillLevelOptions: Record<SkillLevel, { label: string; hint: string }> = {
  beginner: { label: 'Just starting', hint: 'New to the field I’m aiming for' },
  intermediate: { label: 'Some experience', hint: 'I know the basics and want to go further' },
  advanced: { label: 'Experienced', hint: 'I want to sharpen and specialise' },
}

export const domainLabels: Record<GuidanceDomain, string> = {
  career: 'Career & education',
  interview: 'Interview preparation',
  mental_wellness: 'Mental wellness',
  physical_wellness: 'Physical wellness',
  finance: 'Financial literacy',
  personal_development: 'Personal development',
}
