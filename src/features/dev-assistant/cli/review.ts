import { runPullRequestReview } from '../server/review-run.server'

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return null
  }
  return process.argv[index + 1] ?? null
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

async function main(): Promise<void> {
  const base = argValue('--base') ?? env('PR_BASE_SHA')
  const head = argValue('--head') ?? env('PR_HEAD_SHA') ?? 'HEAD'
  const root = env('DEV_ASSISTANT_REPO_DIR') ?? process.cwd()
  const rawNumber = env('PR_NUMBER')
  const parsedNumber = rawNumber ? Number(rawNumber) : Number.NaN
  const prNumber =
    Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : null
  const generator = env('PR_REVIEW_GENERATOR') === 'local' ? 'local' : 'cloud'
  const judge = env('PR_REVIEW_JUDGE') !== '0'
  const forcedDryRun = env('PR_REVIEW_DRY_RUN') === '1'
  const dryRun = forcedDryRun || prNumber === null

  if (!base) {
    console.log(
      'Не задана база сравнения: передайте --base <ref> или переменную PR_BASE_SHA.',
    )
    return
  }

  if (dryRun) {
    console.log(
      forcedDryRun
        ? '[review] dry-run: PR_REVIEW_DRY_RUN=1 — публикация отключена.'
        : '[review] dry-run: PR_NUMBER не задан или не число — публикация отключена.',
    )
  }

  const result = await runPullRequestReview({
    root,
    base,
    head,
    prNumber,
    generator,
    dryRun,
    judge,
    githubToken: env('GITHUB_TOKEN'),
    githubRepository: env('GITHUB_REPOSITORY'),
    runTypecheck: env('PR_REVIEW_SKIP_TYPECHECK') !== '1',
  })

  console.log(result.body)
  if (!result.ok) {
    console.log(`\n[review] AI-ревью недоступно: ${result.error}`)
  }
  console.log(
    `[review] файлов: ${result.files}, добавленных строк: ${result.lines}, inline: ${result.inline}, судья: ${judge ? `оставил ${result.kept}, отклонил ${result.dropped}` : 'выключен'}, модель: ${result.model ?? '—'}`,
  )
}

await main()
