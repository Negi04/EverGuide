/**
 * First-line crisis screen. Keyword matching is deliberately simple and errs towards
 * flagging: a false positive shows support information, a false negative could miss
 * someone at risk. A production system should add a trained classifier and a
 * policy reviewed by mental-health professionals.
 */
const CRISIS_PATTERNS = [
  /\b(kill|hurt|harm)(ing)?\s+my\s*self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend\s+(my|it)\s+(life|all)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\b(don'?t|do not)\s+want\s+to\s+(live|be alive|exist)\b/i,
  /\bself[-\s]?harm/i,
  /\bcut(ting)?\s+my\s*self\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
  // Common Hinglish phrasings
  /\bkhud\s*kushi\b/i,
  /\bmar(na)?\s+ja(a)?na\s+chaht[ai]\b/i,
  /\bjeena\s+nahi\s+chaht[ai]\b/i,
]

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text))
}

// Helpline details must be verified by a person before launch (see PROGRESS.md).
export const CRISIS_RESPONSE = [
  'It sounds like you might be going through something really painful right now. You don’t have to face it alone, and you deserve support.',
  '',
  '**If you are in immediate danger or might act on these thoughts, please contact emergency services now: call 112 (India).**',
  '',
  '- **Tele-MANAS (India):** call **14416** for free, confidential mental-health support, available 24/7.',
  '- If you are outside India, please call your local emergency number.',
  '- If you can, tell someone you trust — a friend, family member, teacher or doctor — how you are feeling.',
  '',
  'I’m an AI guide, not a counsellor or crisis service, so I can’t give you the help a trained person can. If you’d like, you can still talk to me about other things that are on your mind.',
].join('\n')
