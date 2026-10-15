import { appendFile } from 'node:fs/promises'

// Every comment this pipeline writes carries the marker, so a re-run can find
// and update/delete its own output instead of piling up.
export const REVIEW_MARKER = '<!-- ai-pr-review -->'

const DEFAULT_API_BASE = 'https://api.github.com'
const PAGE_SIZE = 100
const MAX_PAGES = 10

export type GitHubConfig = {
  token: string
  repository: string
  pullNumber: number
  headSha: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  dryRun?: boolean
}

export type ReviewComment = {
  path: string
  line: number
  body: string
}

export type InlineDeliveryResult = {
  posted: number
  deleted: number
  failed: ReviewComment[]
  skipped: boolean
}

export type DeliveryResult = {
  summaryCommentUrl: string | null
  inlinePosted: number
  inlineDeleted: number
  skipped: boolean
}

type IssueComment = { id: number; body?: string }
type PullComment = { id: number; body?: string }
type CommentResponse = { html_url?: string }

type Request = <T>(method: string, path: string, body?: unknown) => Promise<T>

function createClient(config: GitHubConfig) {
  const doFetch = config.fetchImpl ?? fetch
  const base = config.apiBaseUrl ?? DEFAULT_API_BASE
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ai-advent-pr-review',
    'Content-Type': 'application/json',
  }
  return async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(
        `GitHub ${method} ${path} → HTTP ${res.status}: ${await res.text()}`,
      )
    }
    if (res.status === 204) {
      return undefined as T
    }
    return (await res.json()) as T
  }
}

async function listAll<T>(request: Request, path: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const chunk = await request<T[]>(
      'GET',
      `${path}?per_page=${PAGE_SIZE}&page=${page}`,
    )
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) {
      break
    }
  }
  return out
}

async function deleteQuietly(
  request: Request,
  path: string,
): Promise<boolean> {
  try {
    await request<void>('DELETE', path)
    return true
  } catch {
    return false
  }
}

function markedComment(comment: ReviewComment) {
  return {
    path: comment.path,
    line: comment.line,
    side: 'RIGHT',
    body: `${REVIEW_MARKER}\n${comment.body}`,
  }
}

async function tryBatchReview(
  request: Request,
  repo: string,
  number: number,
  headSha: string,
  comments: ReviewComment[],
): Promise<boolean> {
  try {
    await request<unknown>('POST', `/repos/${repo}/pulls/${number}/reviews`, {
      commit_id: headSha,
      event: 'COMMENT',
      comments: comments.map(markedComment),
    })
    return true
  } catch {
    return false
  }
}

async function trySingleComment(
  request: Request,
  repo: string,
  number: number,
  headSha: string,
  comment: ReviewComment,
): Promise<boolean> {
  try {
    await request<unknown>(
      'POST',
      `/repos/${repo}/pulls/${number}/comments`,
      { commit_id: headSha, ...markedComment(comment) },
    )
    return true
  } catch {
    return false
  }
}

export async function deliverInline(
  config: GitHubConfig,
  comments: ReviewComment[],
): Promise<InlineDeliveryResult> {
  if (config.dryRun) {
    return { posted: 0, deleted: 0, failed: [], skipped: true }
  }
  const request = createClient(config)
  const repo = config.repository
  const number = config.pullNumber

  const existing = await listAll<PullComment>(
    request,
    `/repos/${repo}/pulls/${number}/comments`,
  )
  let deleted = 0
  for (const comment of existing) {
    const isMine = comment.body?.includes(REVIEW_MARKER) ?? false
    if (
      isMine &&
      (await deleteQuietly(request, `/repos/${repo}/pulls/comments/${comment.id}`))
    ) {
      deleted += 1
    }
  }

  if (comments.length === 0) {
    return { posted: 0, deleted, failed: [], skipped: false }
  }

  if (!/^[0-9a-f]{7,40}$/i.test(config.headSha)) {
    return { posted: 0, deleted, failed: comments, skipped: false }
  }

  if (await tryBatchReview(request, repo, number, config.headSha, comments)) {
    return { posted: comments.length, deleted, failed: [], skipped: false }
  }

  const failed: ReviewComment[] = []
  let posted = 0
  for (const comment of comments) {
    if (await trySingleComment(request, repo, number, config.headSha, comment)) {
      posted += 1
    } else {
      failed.push(comment)
    }
  }
  return { posted, deleted, failed, skipped: false }
}

export async function deliverSummary(
  config: GitHubConfig,
  body: string,
): Promise<string | null> {
  if (config.dryRun) {
    return null
  }
  const request = createClient(config)
  const repo = config.repository
  const number = config.pullNumber
  const marked = `${REVIEW_MARKER}\n${body}`

  const existing = await listAll<IssueComment>(
    request,
    `/repos/${repo}/issues/${number}/comments`,
  )
  const mine = existing.filter((comment) =>
    comment.body?.includes(REVIEW_MARKER),
  )
  if (mine.length === 0) {
    const created = await request<CommentResponse>(
      'POST',
      `/repos/${repo}/issues/${number}/comments`,
      { body: marked },
    )
    return created.html_url ?? null
  }

  const updated = await request<CommentResponse>(
    'PATCH',
    `/repos/${repo}/issues/comments/${mine[0].id}`,
    { body: marked },
  )
  for (const extra of mine.slice(1)) {
    await deleteQuietly(request, `/repos/${repo}/issues/comments/${extra.id}`)
  }
  return updated.html_url ?? null
}

// Day-32 delivery, idempotent on re-runs: the summary is one sticky issue
// comment (created once, edited in place), the inline comments are deleted and
// re-posted as a single review on the current head commit.
export async function deliverReview(input: {
  config: GitHubConfig
  body: string
  comments: ReviewComment[]
}): Promise<DeliveryResult> {
  const { config, body, comments } = input
  if (config.dryRun) {
    return {
      summaryCommentUrl: null,
      inlinePosted: 0,
      inlineDeleted: 0,
      skipped: true,
    }
  }
  const inline = await deliverInline(config, comments)
  const summaryCommentUrl = await deliverSummary(config, body)
  return {
    summaryCommentUrl,
    inlinePosted: inline.posted,
    inlineDeleted: inline.deleted,
    skipped: false,
  }
}

// The review also lands in the run's job summary, so it survives even when the
// comment cannot be posted (fork PR without secrets, API hiccup).
export async function writeStepSummary(text: string): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY?.trim()
  if (!path) {
    return
  }
  await appendFile(path, `${text}\n`)
}
