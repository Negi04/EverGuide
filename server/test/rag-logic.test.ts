import { describe, expect, it } from 'vitest'
import { resolveCitations } from '../src/rag/citations.ts'
import { buildQuestionPrompt, titleFromQuestion } from '../src/rag/prompt.ts'
import { detectCrisis } from '../src/rag/safety.ts'
import { source } from './fakes/ai.ts'

describe('resolveCitations', () => {
  it('keeps markers that point at retrieved sources and lists them in order of use', () => {
    expect(resolveCitations('Save first [2]. Then invest [1].', 3)).toEqual({
      text: 'Save first [2]. Then invest [1].',
      used: [2, 1],
    })
  })

  it('removes markers for sources that were never retrieved', () => {
    expect(resolveCitations('A fact [1]. An invented one [7].', 3)).toEqual({
      text: 'A fact [1]. An invented one.',
      used: [1],
    })
  })

  it('splits grouped markers and drops the invalid members', () => {
    expect(resolveCitations('Both apply [1, 2, 9].', 2)).toEqual({
      text: 'Both apply [1][2].',
      used: [1, 2],
    })
  })

  it('cites nothing when no sources were retrieved', () => {
    expect(resolveCitations('General advice [1].', 0)).toEqual({
      text: 'General advice.',
      used: [],
    })
  })

  it('counts each source once', () => {
    expect(resolveCitations('One [1]. Again [1].', 1).used).toEqual([1])
  })
})

describe('detectCrisis', () => {
  it.each([
    'I want to kill myself',
    'sometimes I think about suicide',
    "I don't want to live anymore",
    'I have been self-harming',
    'everyone would be better off dead without me',
    'main khudkushi ke baare mein soch raha hoon',
    'I just want to end it all',
  ])('flags: %s', (text) => {
    expect(detectCrisis(text)).toBe(true)
  })

  it.each([
    'How do I kill a process in Linux?',
    'My deadline is killing me',
    'How do I prepare for a job interview?',
  ])('does not flag: %s', (text) => {
    expect(detectCrisis(text)).toBe(false)
  })

  it('errs on the side of caution: some harmless phrases are flagged on purpose', () => {
    // Showing support information by mistake is far less harmful than missing someone at risk.
    expect(detectCrisis('What is a suicide squeeze in baseball?')).toBe(true)
  })
})

describe('prompt building', () => {
  it('numbers sources so the model can cite them', () => {
    const prompt = buildQuestionPrompt('How do I budget?', [source(1), source(2)])
    expect(prompt).toContain('[1] Guide 1 — Section 1\nContent of source 1.')
    expect(prompt).toContain('[2] Guide 2')
    expect(prompt.endsWith('QUESTION:\nHow do I budget?')).toBe(true)
  })

  it('tells the model when nothing relevant was found', () => {
    expect(buildQuestionPrompt('Who won the match?', [])).toContain(
      'No relevant sources were found',
    )
  })

  it('creates short titles from long questions at a word boundary', () => {
    const title = titleFromQuestion(
      'How should I prepare for my first data analyst interview when I have no professional experience yet?',
    )
    expect(title.length).toBeLessThanOrEqual(61)
    expect(title.endsWith('…')).toBe(true)
    expect(titleFromQuestion('  Short   question ')).toBe('Short question')
  })
})
