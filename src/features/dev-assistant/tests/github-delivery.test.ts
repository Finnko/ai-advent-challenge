import { describe, expect, it } from 'vitest'
import { REVIEW_MARKER, deliverReview } from '../server/github.server'

type Call = { method: string; url: string; body: unknown }

function makeFetch(
  handler: (
    method: string,
    url: string,
    body: unknown,
  ) => { status?: number; json?: unknown },
): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url, body })
    const result = handler(method, url, body)
    const status = result.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result.json,
      text: async () => JSON.stringify(result.json ?? ''),
    } as Response
  }) as typeof fetch
  return { fetchImpl, calls }
}

const CONFIG = {
  token: 'test-token',
  repository: 'owner/repo',
  pullNumber: 7,
  headSha: 'head-sha',
  apiBaseUrl: 'https://api.test',
}

describe('GitHub review delivery', () => {
  it('updates the sticky summary, recycles inline comments and posts one review', async () => {
    const { fetchImpl, calls } = makeFetch((method, url) => {
      if (url.includes('/issues/7/comments') && method === 'GET') {
        return { json: [{ id: 10, body: `${REVIEW_MARKER}\nстарое ревью` }] }
      }
      if (url.includes('/pulls/7/comments') && method === 'GET') {
        return { json: [{ id: 20, body: `${REVIEW_MARKER}\nстарый inline` }] }
      }
      if (method === 'PATCH') {
        return { json: { html_url: 'https://example.test/comment/10' } }
      }
      if (method === 'DELETE') {
        return { status: 204 }
      }
      return { json: {} }
    })

    const result = await deliverReview({
      config: { ...CONFIG, fetchImpl },
      body: '## 🤖 AI-ревью',
      comments: [
        { path: 'src/a.ts', line: 3, body: '**Bug.** деление на ноль' },
      ],
    })

    expect(result.skipped).toBe(false)
    expect(result.summaryCommentUrl).toBe('https://example.test/comment/10')
    expect(result.inlineDeleted).toBe(1)
    expect(result.inlinePosted).toBe(1)

    const patch = calls.find((call) => call.method === 'PATCH')
    const patchBody = patch?.body as { body: string }
    expect(patch?.url).toBe(
      'https://api.test/repos/owner/repo/issues/comments/10',
    )
    expect(patchBody.body).toContain(REVIEW_MARKER)

    const deleted = calls.filter((call) => call.method === 'DELETE')
    expect(deleted.map((call) => call.url)).toEqual([
      'https://api.test/repos/owner/repo/pulls/comments/20',
    ])

    const review = calls.find(
      (call) => call.method === 'POST' && call.url.includes('/pulls/7/reviews'),
    )
    const reviewBody = review?.body as {
      commit_id: string
      event: string
      comments: { path: string; line: number; side: string; body: string }[]
    }
    expect(reviewBody.commit_id).toBe('head-sha')
    expect(reviewBody.event).toBe('COMMENT')
    expect(reviewBody.comments[0]).toMatchObject({
      path: 'src/a.ts',
      line: 3,
      side: 'RIGHT',
    })
    expect(reviewBody.comments[0].body).toContain(REVIEW_MARKER)
  })

  it('creates the summary comment when there is none yet', async () => {
    const { fetchImpl, calls } = makeFetch((method, url) => {
      if (method === 'GET' && url.includes('/issues/7/comments')) {
        return { json: [{ id: 1, body: 'человеческий комментарий' }] }
      }
      if (method === 'GET') {
        return { json: [] }
      }
      if (method === 'POST' && url.includes('/issues/7/comments')) {
        return { json: { html_url: 'https://example.test/comment/99' } }
      }
      return { json: {} }
    })

    const result = await deliverReview({
      config: { ...CONFIG, fetchImpl },
      body: 'тело',
      comments: [],
    })
    expect(result.summaryCommentUrl).toBe('https://example.test/comment/99')
    expect(result.inlinePosted).toBe(0)
    expect(
      calls.some(
        (call) =>
          call.method === 'POST' && call.url.includes('/pulls/7/reviews'),
      ),
    ).toBe(false)
  })

  it('does nothing in dry-run mode', async () => {
    const { fetchImpl, calls } = makeFetch(() => ({ json: {} }))
    const result = await deliverReview({
      config: { ...CONFIG, fetchImpl, dryRun: true },
      body: 'тело',
      comments: [{ path: 'src/a.ts', line: 1, body: 'x' }],
    })
    expect(result).toEqual({
      summaryCommentUrl: null,
      inlinePosted: 0,
      inlineDeleted: 0,
      skipped: true,
    })
    expect(calls).toHaveLength(0)
  })
})
