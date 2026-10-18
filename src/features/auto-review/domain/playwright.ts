import type { CriterionStatus } from '../types'
import { mandatorySpecs, specIdFromFile } from '../data/spec-map'
import { asRecord, asStringArray } from './json'

export type RunTest = {
  project: string
  file: string
  title: string
  status: string
  errors: string[]
}

export type RunReport = {
  browsers: string[]
  tests: RunTest[]
}

export type BasicResult = {
  code: string
  status: CriterionStatus
  reason: string
  evidence: string[]
}

const PRIMARY_BROWSER = 'chromium'
const MAX_EVIDENCE = 12

function parseTest(value: unknown): RunTest | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }
  const project = typeof record.project === 'string' ? record.project : ''
  const file = typeof record.file === 'string' ? record.file : ''
  const title = typeof record.title === 'string' ? record.title : ''
  const status = typeof record.status === 'string' ? record.status : 'unknown'
  if (file.length === 0) {
    return null
  }
  return { project, file, title, status, errors: asStringArray(record.errors) }
}

export function parseRunReport(value: unknown): RunReport | null {
  const record = asRecord(value)
  if (!record || !Array.isArray(record.tests)) {
    return null
  }
  const tests: RunTest[] = []
  for (const item of record.tests) {
    const test = parseTest(item)
    if (test) {
      tests.push(test)
    }
  }
  const browsers = asStringArray(record.browsers)
  return { browsers: browsers.length > 0 ? browsers : [PRIMARY_BROWSER], tests }
}

function cap(values: string[]): string[] {
  return values.slice(0, MAX_EVIDENCE)
}

function testsForSpec(
  report: RunReport,
  specId: string,
  browser: string,
): RunTest[] {
  return report.tests.filter(
    (test) => test.project === browser && specIdFromFile(test.file) === specId,
  )
}

function failingTests(tests: RunTest[]): RunTest[] {
  return tests.filter((test) => test.status !== 'passed')
}

export function scorePlaywright(report: RunReport): BasicResult[] {
  const mandatory = mandatorySpecs()
  const primary = report.browsers.includes(PRIMARY_BROWSER)
    ? PRIMARY_BROWSER
    : (report.browsers[0] ?? PRIMARY_BROWSER)

  const missing: string[] = []
  const failures: string[] = []
  for (const spec of mandatory) {
    const tests = testsForSpec(report, spec.id, primary)
    if (tests.length === 0) {
      missing.push(spec.id)
      continue
    }
    for (const test of failingTests(tests)) {
      failures.push(`${spec.id} — ${test.title}`)
    }
  }
  const basicProblems = [
    ...missing.map((id) => `${id} — нет результатов`),
    ...failures,
  ]
  const basic: BasicResult = {
    code: 'Б1',
    status: basicProblems.length > 0 ? 'fail' : 'pass',
    reason:
      basicProblems.length > 0
        ? `Не пройдены обязательные сценарии ТЗ: ${basicProblems.join('; ')}`
        : `Все обязательные сценарии ТЗ пройдены в браузере ${primary}.`,
    evidence: cap(basicProblems),
  }

  const errors: string[] = []
  for (const spec of mandatory) {
    for (const test of testsForSpec(report, spec.id, primary)) {
      for (const error of test.errors) {
        errors.push(`${spec.id} — ${error}`)
      }
    }
  }
  const errorResult: BasicResult = {
    code: 'Б2',
    status: errors.length > 0 ? 'fail' : 'pass',
    reason:
      errors.length > 0
        ? 'При выполнении обязательных сценариев возникли необработанные ошибки.'
        : 'Необработанных ошибок при выполнении обязательных сценариев нет.',
    evidence: cap(errors),
  }

  const browserFailures: string[] = []
  for (const browser of report.browsers) {
    for (const spec of mandatory) {
      const tests = testsForSpec(report, spec.id, browser)
      if (tests.length === 0) {
        browserFailures.push(`${browser}: ${spec.id} — нет результатов`)
        continue
      }
      for (const test of failingTests(tests)) {
        browserFailures.push(`${browser}: ${spec.id} — ${test.title}`)
      }
    }
  }
  const crossBrowser: BasicResult = {
    code: 'Б3',
    status: browserFailures.length > 0 ? 'fail' : 'pass',
    reason:
      browserFailures.length > 0
        ? `Обязательные сценарии не прошли во всех браузерах (${report.browsers.join(', ')}).`
        : `Обязательные сценарии пройдены во всех браузерах: ${report.browsers.join(', ')}.`,
    evidence: cap(browserFailures),
  }

  return [basic, errorResult, crossBrowser]
}

export function unstartedPlaywrightResults(reason: string): BasicResult[] {
  return ['Б1', 'Б2', 'Б3'].map((code) => ({
    code,
    status: 'not_checked' as CriterionStatus,
    reason,
    evidence: [],
  }))
}
