import type { AgentRunResult } from './agent'
import type { MemoryEntry } from './memory/types'
import type { ScenarioStep } from '../data/scenarios'

export type StepVerdict = {
  sourcesOk: boolean
  groundingOk: boolean
  factsOk: boolean
}

export function normalizeFact(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/(\d)\s+(?=\d)/g, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchExpected(
  answer: string,
  expected: string[],
): { matched: string[]; missing: string[] } {
  const haystack = normalizeFact(answer)
  const matched: string[] = []
  const missing: string[] = []
  for (const fact of expected) {
    if (haystack.includes(normalizeFact(fact))) {
      matched.push(fact)
    } else {
      missing.push(fact)
    }
  }
  return { matched, missing }
}

function sourceTitles(run: AgentRunResult): string[] {
  return (run.sources ?? []).map((source) => source.title)
}

function sourcesOkFor(step: ScenarioStep, titles: string[]): boolean {
  if (step.expectNoData) {
    return true
  }
  if (step.expectSources) {
    return step.expectSources.some((title) => titles.includes(title))
  }
  return titles.length > 0
}

function groundingOkFor(
  step: ScenarioStep,
  grounding: AgentRunResult['grounding'],
): boolean {
  if (step.expectNoData) {
    return grounding === 'no-data'
  }
  return grounding === 'grounded'
}

export function scoreStep(
  step: ScenarioStep,
  run: AgentRunResult,
): StepVerdict {
  const titles = sourceTitles(run)
  const factsOk = step.expectFacts
    ? matchExpected(run.answer, step.expectFacts).missing.length === 0
    : true
  return {
    sourcesOk: sourcesOkFor(step, titles),
    groundingOk: groundingOkFor(step, run.grounding),
    factsOk,
  }
}

export function stepPassed(verdict: StepVerdict): boolean {
  return verdict.sourcesOk && verdict.groundingOk && verdict.factsOk
}

export const DIALOGUE_GOAL_KEY = 'dialogue:goal'

export function goalRetained(
  working: MemoryEntry[],
  goalKeyword: string,
): boolean {
  const goal =
    working.find((entry) => entry.key.toLowerCase() === DIALOGUE_GOAL_KEY)
      ?.value ?? ''
  return normalizeFact(goal).includes(normalizeFact(goalKeyword))
}

export type ScenarioOutcome = {
  passed: number
  total: number
  goalRetained: boolean
}

export function summarizeOutcome(
  verdicts: StepVerdict[],
  working: MemoryEntry[],
  goalKeyword: string,
): ScenarioOutcome {
  return {
    passed: verdicts.filter(stepPassed).length,
    total: verdicts.length,
    goalRetained: goalRetained(working, goalKeyword),
  }
}
