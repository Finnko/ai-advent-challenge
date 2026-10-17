import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'

type TestRow = {
  project: string
  file: string
  title: string
  status: string
  errors: string[]
}

const REPORT_FILE = 'auto-review-report.json'

export default class ReviewReporter implements Reporter {
  private readonly rows: TestRow[] = []
  private readonly browsers = new Set<string>()

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? 'unknown'
    this.browsers.add(project)
    const errors: string[] = []
    for (const attachment of result.attachments) {
      if (attachment.name !== 'console-errors' || !attachment.path) {
        continue
      }
      try {
        const parsed = JSON.parse(
          readFileSync(attachment.path, 'utf8'),
        ) as unknown
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string') {
              errors.push(item)
            }
          }
        }
      } catch {
        continue
      }
    }
    this.rows.push({
      project,
      file: test.location.file,
      title: test.title,
      status: result.status,
      errors,
    })
  }

  onEnd(result: FullResult): void {
    const dir = process.env.AUTO_REVIEW_ARTIFACTS_DIR
    if (!dir) {
      return
    }
    mkdirSync(dir, { recursive: true })
    const payload = {
      browsers: [...this.browsers],
      status: result.status,
      tests: this.rows,
    }
    writeFileSync(
      path.join(dir, REPORT_FILE),
      JSON.stringify(payload, null, 2),
      'utf8',
    )
  }
}
