import type { AgentRunResult } from './agent'
import type { MemoryEntry } from './memory/types'
import type { ScenarioStep } from '../data/scenarios'

export type StepVerdict = {
  sourcesOk: boolean
  groundingOk: boolean
  factsOk: boolean
  orderOk: boolean
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

const EARLIER_MARKERS = ['раньше', 'старше', 'древнее', 'древн']

type CitySubject = 'earlier' | 'later' | null

function citySubject(
  sentence: string,
  markerIndex: number,
  earlier: string,
  later: string,
): CitySubject {
  const candidates: Array<{
    city: 'earlier' | 'later'
    distance: number
    before: boolean
  }> = []
  for (const [city, name] of [
    ['earlier', earlier],
    ['later', later],
  ] as const) {
    let index = sentence.indexOf(name)
    while (index !== -1) {
      const before = index < markerIndex
      candidates.push({
        city,
        before,
        distance: before ? markerIndex - index : index - markerIndex,
      })
      index = sentence.indexOf(name, index + 1)
    }
  }
  if (candidates.length === 0) {
    return null
  }
  const nearestBefore = candidates
    .filter((candidate) => candidate.before)
    .sort((left, right) => left.distance - right.distance)[0]
  const nearestAfter = candidates
    .filter((candidate) => !candidate.before)
    .sort((left, right) => left.distance - right.distance)[0]
  return (nearestBefore ?? nearestAfter).city
}

export function statesEarlier(
  answer: string,
  earlier: string,
  later: string,
): boolean {
  const earlierName = normalizeFact(earlier)
  const laterName = normalizeFact(later)
  let sawCorrect = false
  for (const rawSentence of answer.split(/[.!?\n]+/)) {
    const sentence = normalizeFact(rawSentence)
    if (sentence.length === 0) {
      continue
    }
    for (const marker of EARLIER_MARKERS) {
      let markerIndex = sentence.indexOf(marker)
      while (markerIndex !== -1) {
        const subject = citySubject(
          sentence,
          markerIndex,
          earlierName,
          laterName,
        )
        if (subject === 'later') {
          return false
        }
        if (subject === 'earlier') {
          sawCorrect = true
        }
        markerIndex = sentence.indexOf(marker, markerIndex + 1)
      }
    }
  }
  return sawCorrect
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
  if (step.expectGrounding === false) {
    return true
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
  const orderOk = step.expectEarlier
    ? statesEarlier(
        run.answer,
        step.expectEarlier.earlier,
        step.expectEarlier.later,
      )
    : true
  return {
    sourcesOk: sourcesOkFor(step, titles),
    groundingOk: groundingOkFor(step, run.grounding),
    factsOk,
    orderOk,
  }
}

export function stepPassed(verdict: StepVerdict): boolean {
  return (
    verdict.sourcesOk &&
    verdict.groundingOk &&
    verdict.factsOk &&
    verdict.orderOk
  )
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
