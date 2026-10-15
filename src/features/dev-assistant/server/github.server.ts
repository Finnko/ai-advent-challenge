import { appendFile } from 'node:fs/promises'

// Every comment this pipeline writes carries the marker, so a re-run can find
// and update/delete its own output instead of piling up.
export const REVIEW_MARKER = '<!-- ai-pr-review -->'

const DEFAULT_API_BASE = 'https://api.github.com'

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

export type DeliveryResult = {
  summaryCommentUrl: string | null
  inlinePosted: number
  inlineDeleted: number
  skipped: boolean
}

type IssueComment = { id: number; body?: string }
type PullComment = { id: number; body?: string }
type CommentResponse = { html_url?: string }

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
  const request = createClient(config)
  const repo = config.repository
  const number = config.pullNumber
  const marked = `${REVIEW_MARKER}\n${body}`

  const issueComments = await request<IssueComment[]>(
    'GET',
    `/repos/${repo}/issues/${number}/comments?per_page=100`,
  )
  const mine = issueComments.filter((comment) =>
    comment.body?.includes(REVIEW_MARKER),
  )
  let summaryCommentUrl: string | null = null
  if (mine.length > 0) {
    const first = mine[0]
    const updated = await request<CommentResponse>(
      'PATCH',
      `/repos/${repo}/issues/comments/${first.id}`,
      { body: marked },
    )
    summaryCommentUrl = updated.html_url ?? null
    for (const extra of mine.slice(1)) {
      await request<void>(
        'DELETE',
        `/repos/${repo}/issues/comments/${extra.id}`,
      )
    }
  } else {
    const created = await request<CommentResponse>(
      'POST',
      `/repos/${repo}/issues/${number}/comments`,
      { body: marked },
    )
    summaryCommentUrl = created.html_url ?? null
  }

  const reviewComments = await request<PullComment[]>(
    'GET',
    `/repos/${repo}/pulls/${number}/comments?per_page=100`,
  )
  let inlineDeleted = 0
  for (const comment of reviewComments) {
    if (comment.body?.includes(REVIEW_MARKER)) {
      await request<void>(
        'DELETE',
        `/repos/${repo}/pulls/comments/${comment.id}`,
      )
      inlineDeleted += 1
    }
  }

  let inlinePosted = 0
  if (comments.length > 0) {
    await request<unknown>('POST', `/repos/${repo}/pulls/${number}/reviews`, {
      commit_id: config.headSha,
      event: 'COMMENT',
      comments: comments.map((comment) => ({
        path: comment.path,
        line: comment.line,
        side: 'RIGHT',
        body: `${REVIEW_MARKER}\n${comment.body}`,
      })),
    })
    inlinePosted = comments.length
  }

  return {
    summaryCommentUrl,
    inlinePosted,
    inlineDeleted,
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
