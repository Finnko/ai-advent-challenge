import { readFile } from 'node:fs/promises'
import {
  approveReview,
  cancelReview,
  getReviewStatus,
  startReview,
} from '../server/service.server'
import { runTimeoutMs } from '../server/config.server'
import { countVerdicts } from '../domain/counts'
import { formatFindings } from '../domain/findings'
import { projectKeyFromSourceName } from '../domain/project-key'
import type { ReviewRecord } from '../types'

type Args = {
  zip: string | null
  dir: string | null
  key: string | null
  resume: number | null
  json: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    zip: null,
    dir: null,
    key: null,
    resume: null,
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--zip') {
      args.zip = argv[index + 1] ?? null
      index += 1
    } else if (flag === '--dir') {
      args.dir = argv[index + 1] ?? null
      index += 1
    } else if (flag === '--key') {
      args.key = argv[index + 1] ?? null
      index += 1
    } else if (flag === '--resume') {
      const value = Number(argv[index + 1])
      args.resume = Number.isInteger(value) && value > 0 ? value : null
      index += 1
    } else if (flag === '--json') {
      args.json = true
    }
  }
  return args
}

function printReview(review: ReviewRecord): void {
  const counts = countVerdicts(review.results)
  const failed = review.results.filter((result) => result.status === 'fail')
  const notChecked = review.results.filter(
    (result) => result.status === 'not_checked',
  )
  console.log(`Проверка #${review.id} — ${review.status}`)
  if (review.error) {
    console.log(`Примечание: ${review.error}`)
  }
  console.log(
    `Пройдено: ${counts.passed}, не пройдено: ${counts.failed}, не проверено: ${counts.notChecked}`,
  )
  for (const result of failed) {
    console.log('')
    console.log(`${result.code}. ${result.title}`)
    console.log(result.reason)
    if (result.findings.length > 0) {
      console.log(formatFindings(result.findings))
    }
  }
  for (const result of notChecked) {
    console.log('')
    console.log(`${result.code}. ${result.title} — не проверено`)
    console.log(result.reason)
  }
}

async function waitFor(reviewId: number): Promise<ReviewRecord> {
  const deadline = Date.now() + runTimeoutMs()
  for (;;) {
    const review = await getReviewStatus(reviewId)
    if (!review) {
      throw new Error('Проверка не найдена')
    }
    if (review.status !== 'running') {
      return review
    }
    if (Date.now() >= deadline) {
      await cancelReview(reviewId).catch(() => undefined)
      throw new Error(
        `Проверка не завершилась за ${Math.round(runTimeoutMs() / 60_000)} мин и была прервана`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

function installInterruptHandler(reviewId: number): () => void {
  const onSignal = () => {
    console.error('')
    console.error('Прерываю проверку…')
    void cancelReview(reviewId)
      .catch(() => undefined)
      .finally(() => process.exit(130))
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
  return () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const source = args.zip ?? args.dir
  const key =
    args.key?.trim() || (source ? projectKeyFromSourceName(source) : '')
  if (!source || key.length === 0) {
    console.error(
      'Использование: npm run auto-review -- (--zip <path> | --dir <path>) [--key <key>] [--resume <id>] [--json]',
    )
    process.exitCode = 1
    return
  }
  const zipBase64 = args.zip
    ? (await readFile(args.zip)).toString('base64')
    : ''
  const started = await startReview({
    key,
    zipBase64,
    sourcePath: args.dir,
    resumedFrom: args.resume,
  })
  console.log(`Проект ${started.name}: проверка #${started.reviewId}`)
  const removeInterruptHandler = installInterruptHandler(started.reviewId)
  try {
    await approveReview(started.reviewId)
    const review = await waitFor(started.reviewId)
    if (args.json) {
      console.log(JSON.stringify(review.results, null, 2))
      return
    }
    printReview(review)
  } catch (error) {
    await cancelReview(started.reviewId).catch(() => undefined)
    throw error
  } finally {
    removeInterruptHandler()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
