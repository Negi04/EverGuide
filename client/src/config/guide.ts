import type { GuidanceDomain } from '@everguide/shared'

/** Example questions shown when starting a conversation, per guidance area. */
export const starterQuestions: Record<GuidanceDomain, string[]> = {
  career: [
    'How do I choose between two career paths?',
    'How can I move into data analysis from customer support?',
    'What should I put on my resume if I have little experience?',
  ],
  interview: [
    'How do I answer “tell me about a time you had a conflict”?',
    'How should I prepare for a coding interview?',
    'What is the STAR method?',
  ],
  mental_wellness: [
    'I feel overwhelmed by exam pressure. What can help?',
    'What are simple ways to manage everyday stress?',
    'When should I talk to a counsellor?',
  ],
  physical_wellness: [
    'How much sleep do I really need?',
    'How can I fit exercise into a busy schedule?',
    'What habits help me sleep better?',
  ],
  finance: [
    'How do I make a budget on my first salary?',
    'How big should my emergency fund be?',
    'Can you explain compound interest simply?',
  ],
  personal_development: [
    'How do I stick to a new habit?',
    'What should I do when I miss a day of my routine?',
    'How can I stay consistent while studying?',
  ],
}
