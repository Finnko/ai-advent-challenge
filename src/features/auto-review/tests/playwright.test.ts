import { describe, expect, it } from 'vitest'
import { mandatorySpecs } from '../data/spec-map'
import {
  parseRunReport,
  scorePlaywright,
  unstartedPlaywrightResults,
} from '../domain/playwright'

const CHROMIUM = 'chromium'
const FIREFOX = 'firefox'

const SPECS = mandatorySpecs().map((spec) => spec.id)

function test(
  project: string,
  spec: string,
  status: string,
  errors: string[] = [],
) {
  return {
    project,
    file: `/x/specs/${spec}.spec.ts`,
    title: `${spec} works`,
    status,
    errors,
  }
}

describe('parseRunReport', () => {
  it('возвращает null без тестов', () => {
    expect(parseRunReport({})).toBeNull()
    expect(parseRunReport(null)).toBeNull()
  })

  it('читает браузеры и тесты', () => {
    const report = parseRunReport({
      browsers: ['chromium', 'firefox'],
      tests: [test(CHROMIUM, 'pages', 'passed')],
    })
    expect(report?.browsers).toEqual(['chromium', 'firefox'])
    expect(report?.tests).toHaveLength(1)
  })

  it('по умолчанию использует chromium', () => {
    const report = parseRunReport({
      tests: [test(CHROMIUM, 'pages', 'passed')],
    })
    expect(report?.browsers).toEqual(['chromium'])
  })
})

describe('scorePlaywright', () => {
  it('всё зелёное — Б1/Б2/Б3 пройдены', () => {
    const report = parseRunReport({
      browsers: [CHROMIUM, FIREFOX],
      tests: SPECS.flatMap((spec) => [
        test(CHROMIUM, spec, 'passed'),
        test(FIREFOX, spec, 'passed'),
      ]),
    })!
    const results = scorePlaywright(report)
    expect(results.map((item) => item.status)).toEqual(['pass', 'pass', 'pass'])
  })

  it('падение в chromium ломает Б1 и Б3, но не Б2', () => {
    const report = parseRunReport({
      browsers: [CHROMIUM, FIREFOX],
      tests: [
        ...SPECS.map((spec) => test(CHROMIUM, spec, 'passed')),
        test(CHROMIUM, 'login-page', 'failed'),
        ...SPECS.map((spec) => test(FIREFOX, spec, 'passed')),
      ],
    })!
    const results = scorePlaywright(report)
    expect(results.find((item) => item.code === 'Б1')?.status).toBe('fail')
    expect(results.find((item) => item.code === 'Б2')?.status).toBe('pass')
    expect(results.find((item) => item.code === 'Б3')?.status).toBe('fail')
  })

  it('ошибка консоли ломает только Б2', () => {
    const report = parseRunReport({
      browsers: [CHROMIUM, FIREFOX],
      tests: SPECS.flatMap((spec) => [
        test(
          CHROMIUM,
          spec,
          'passed',
          spec === 'pages' ? ['console: boom'] : [],
        ),
        test(FIREFOX, spec, 'passed'),
      ]),
    })!
    const results = scorePlaywright(report)
    expect(results.find((item) => item.code === 'Б2')?.status).toBe('fail')
    expect(results.find((item) => item.code === 'Б1')?.status).toBe('pass')
  })

  it('отсутствие обязательного сценария ломает Б1', () => {
    const report = parseRunReport({
      browsers: [CHROMIUM],
      tests: [test(CHROMIUM, 'pages', 'passed')],
    })!
    expect(
      scorePlaywright(report).find((item) => item.code === 'Б1')?.status,
    ).toBe('fail')
  })

  it('unstartedPlaywrightResults помечает всё как not_checked', () => {
    const results = unstartedPlaywrightResults('проект не запускается')
    expect(results).toHaveLength(3)
    for (const item of results) {
      expect(item.status).toBe('not_checked')
      expect(item.reason).toBe('проект не запускается')
    }
  })
})
