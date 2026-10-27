export const moods = [
  { value: 1, label: 'Very low', emoji: '😞' },
  { value: 2, label: 'Low', emoji: '🙁' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 5, label: 'Great', emoji: '😄' },
] as const

export const moodLabel = (value: number | null) =>
  moods.find((m) => m.value === value)?.label ?? null

export type BreathPhase = { label: 'Breathe in' | 'Hold' | 'Breathe out'; seconds: number }

export type BreathingPattern = {
  id: string
  name: string
  description: string
  phases: BreathPhase[]
}

export const breathingPatterns: BreathingPattern[] = [
  {
    id: 'box',
    name: 'Box breathing',
    description: 'Four equal steps of four seconds. Easy to remember when you need a pause.',
    phases: [
      { label: 'Breathe in', seconds: 4 },
      { label: 'Hold', seconds: 4 },
      { label: 'Breathe out', seconds: 4 },
      { label: 'Hold', seconds: 4 },
    ],
  },
  {
    id: 'long-exhale',
    name: 'Longer out-breath',
    description: 'Breathe out for longer than you breathe in. Many people find this settling.',
    phases: [
      { label: 'Breathe in', seconds: 4 },
      { label: 'Breathe out', seconds: 6 },
    ],
  },
]

export const sessionLengths = [1, 3, 5] as const

export const habitTargets = [7, 6, 5, 4, 3, 2, 1].map((n) => ({
  value: n,
  label: n === 7 ? 'Every day' : `${n} day${n === 1 ? '' : 's'} a week`,
}))

/** Label shown on AI-drafted guidance until a qualified person has reviewed it. */
export const DRAFT_LABEL = 'EverGuide starter guide (AI-drafted, pending expert review)'

export const supportGuides = [
  {
    title: 'When stress builds up',
    points: [
      'Notice early signs: a tight jaw or shoulders, shallow breathing, trouble focusing.',
      'Take a short break: a few minutes of slow breathing or a walk can help you reset.',
      'Write it down: naming what’s worrying you often makes it feel more manageable.',
      'Break big tasks into the next small step you can actually do today.',
    ],
  },
  {
    title: 'Sleep basics',
    points: [
      'Keep roughly the same wake-up time, including on weekends.',
      'Give yourself a wind-down period without bright screens before bed.',
      'Limit caffeine later in the day.',
      'If sleep problems last for weeks, talk to a doctor.',
    ],
  },
  {
    title: 'Moving more',
    points: [
      'Short walks count. Start with what feels doable and build slowly.',
      'Pair movement with something you already do, like a call or a commute.',
      'If you have a health condition, check with a doctor before starting something new.',
    ],
  },
  {
    title: 'When to talk to a professional',
    points: [
      'Low mood, worry or stress that lasts for weeks or gets in the way of daily life.',
      'Changes in sleep, appetite or energy that don’t settle.',
      'Thoughts of harming yourself: please reach out for help straight away (see above).',
      'A doctor, counsellor or psychologist can help. Asking for help is a sign of strength.',
    ],
  },
]
