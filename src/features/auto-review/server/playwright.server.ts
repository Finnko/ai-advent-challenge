import { readFile } from 'node:fs/promises'
import nodePath from 'node:path'
import { testTimeoutMs } from './config.server'
import { ReviewCancelledError } from './cancel.server'
import { runCommand } from './exec.server'
import { parseRunReport, type RunReport } from '../domain/playwright'

const CONFIG_PATH = 'src/features/auto-review/e2e/playwright.config.ts'
const REPORT_FILE = 'auto-review-report.json'

export type PlaywrightRun = {
  report: RunReport | null
  log: string
  error: string | null
}

export async function runPlaywright(input: {
  baseUrl: string
  browsers: string[]
  artifactsDir: string
  onLine: (line: string) => void
  signal?: AbortSignal
}): Promise<PlaywrightRun> {
  const result = await runCommand(
    'npx',
    ['playwright', 'test', '--config', CONFIG_PATH],
    {
      cwd: process.cwd(),
      timeoutMs: testTimeoutMs(),
      onLine: input.onLine,
      signal: input.signal,
      env: {
        AUTO_REVIEW_BASE_URL: input.baseUrl,
        AUTO_REVIEW_ARTIFACTS_DIR: input.artifactsDir,
        AUTO_REVIEW_BROWSERS: input.browsers.join(','),
      },
    },
  )

  const log = `${result.stdout}\n${result.stderr}`.trim()
  if (result.aborted) {
    throw new ReviewCancelledError()
  }
  if (result.timedOut) {
    return {
      report: null,
      log,
      error: 'прогон Playwright превысил лимит времени',
    }
  }

  let report: RunReport | null = null
  try {
    const raw = await readFile(
      nodePath.join(input.artifactsDir, REPORT_FILE),
      'utf8',
    )
    report = parseRunReport(JSON.parse(raw))
  } catch {
    report = null
  }

  if (!report) {
    return {
      report: null,
      log,
      error:
        result.code === null
          ? 'не удалось запустить Playwright'
          : 'Playwright не оставил отчёт о прогоне',
    }
  }
  return { report, log, error: null }
}
