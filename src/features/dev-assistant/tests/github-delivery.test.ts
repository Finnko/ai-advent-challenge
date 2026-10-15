import { describe, expect, it } from 'vitest'
import {
  REVIEW_MARKER,
  deliverInline,
  deliverSummary,
} from '../server/github.server'

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
    } as unknown as Response
  }) as typeof fetch
  return { fetchImpl, calls }
}

const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0'

const CONFIG = {
  token: 'test-token',
  repository: 'owner/repo',
  pullNumber: 7,
  headSha: SHA,
  apiBaseUrl: 'https://api.test',
}

const COMMENT = { path: 'src/a.ts', line: 3, body: '**Bug.** деление на ноль' }

describe('inline delivery', () => {
  it('recycles previous bot comments and posts one review batch', async () => {
    const { fetchImpl, calls } = makeFetch((method, url) => {
      if (method === 'GET' && url.includes('/pulls/7/comments')) {
        return { json: [{ id: 20, body: `${REVIEW_MARKER}\nстарый inline` }] }
      }
      if (method === 'DELETE') {
        return { status: 204 }
      }
      return { json: {} }
    })

    const result = await deliverInline({ ...CONFIG, fetchImpl }, [COMMENT])

    expect(result).toMatchObject({ posted: 1, deleted: 1, failed: [], skipped: false })
    expect(
      calls.filter((call) => call.method === 'DELETE').map((call) => call.url),
    ).toEqual(['https://api.test/repos/owner/repo/pulls/comments/20'])

    const review = calls.find((call) => call.url.includes('/pulls/7/reviews'))
    const reviewBody = review?.body as {
      commit_id: string
      event: string
      comments: { path: string; line: number; side: string; body: string }[]
    }
    expect(reviewBody.commit_id).toBe(SHA)
    expect(reviewBody.event).toBe('COMMENT')
    expect(reviewBody.comments[0]).toMatchObject({
      path: 'src/a.ts',
      line: 3,
      side: 'RIGHT',
    })
    expect(reviewBody.comments[0].body).toContain(REVIEW_MARKER)
  })

  it('retries per comment when GitHub rejects the batch review', async () => {
    const { fetchImpl, calls } = makeFetch((method, url, body) => {
      if (method === 'GET') {
        return { json: [] }
      }
      if (url.includes('/pulls/7/reviews')) {
        return { status: 422, json: { message: 'Validation Failed' } }
      }
      const comment = (body as { line?: number } | undefined) ?? {}
      if (comment.line === 9) {
        return { status: 422, json: { message: 'line is not part of the diff' } }
      }
      return { status: 201, json: {} }
    })

    const comments = [
      COMMENT,
      { path: 'src/b.ts', line: 9, body: '**Bug.** сломанный якорь' },
      { path: 'src/c.ts', line: 4, body: '**Style.** мелочь' },
    ]
    const result = await deliverInline({ ...CONFIG, fetchImpl }, comments)

    expect(result.posted).toBe(2)
    expect(result.failed).toEqual([comments[1]])
    expect(
      calls.filter(
        (call) =>
          call.method === 'POST' && call.url.includes('/pulls/7/comments'),
      ).length,
    ).toBe(3)
  })

  it('refuses to attach comments to something that is not a commit sha', async () => {
    const { fetchImpl, calls } = makeFetch((method) => {
      if (method === 'GET') {
        return { json: [] }
      }
      return { json: {} }
    })

    const result = await deliverInline(
      { ...CONFIG, headSha: 'HEAD', fetchImpl },
      [COMMENT],
    )

    expect(result).toMatchObject({ posted: 0, failed: [COMMENT] })
    expect(
      calls.some((call) => call.url.includes('/pulls/7/reviews')),
    ).toBe(false)
    expect(
      calls.some(
        (call) => call.method === 'POST' && call.url.includes('/pulls/7/comments'),
      ),
    ).toBe(false)
  })

  it('tolerates a comment that disappeared between the listing and the deletion', async () => {
    const { fetchImpl } = makeFetch((method, url) => {
      if (method === 'GET' && url.includes('/pulls/7/comments')) {
        return {
          json: [
            { id: 20, body: `${REVIEW_MARKER}\nстарый` },
            { id: 21, body: 'человеческий комментарий' },
          ],
        }
      }
      if (method === 'DELETE') {
        return { status: 404, json: { message: 'Not Found' } }
      }
      return { json: {} }
    })

    const result = await deliverInline({ ...CONFIG, fetchImpl }, [])
    expect(result.deleted).toBe(0)
    expect(result.posted).toBe(0)
  })

  it('does nothing in dry-run mode', async () => {
    const { fetchImpl, calls } = makeFetch(() => ({ json: {} }))
    const result = await deliverInline(
      { ...CONFIG, fetchImpl, dryRun: true },
      [COMMENT],
    )
    expect(result).toMatchObject({ posted: 0, failed: [], skipped: true })
    expect(calls).toHaveLength(0)
  })
})

describe('summary delivery', () => {
  it('updates the sticky comment in place and deletes duplicates', async () => {
    const { fetchImpl, calls } = makeFetch((method, url) => {
      if (method === 'GET' && url.includes('/issues/7/comments')) {
        return {
          json: [
            { id: 10, body: `${REVIEW_MARKER}\nстарое ревью` },
            { id: 11, body: 'человеческий комментарий' },
            { id: 12, body: `${REVIEW_MARKER}\nдубль` },
          ],
        }
      }
      if (method === 'PATCH') {
        return { json: { html_url: 'https://example.test/comment/10' } }
      }
      return { status: 204 }
    })

    const url = await deliverSummary({ ...CONFIG, fetchImpl }, '## 🤖 AI-ревью')

    expect(url).toBe('https://example.test/comment/10')
    const patch = calls.find((call) => call.method === 'PATCH')
    expect(patch?.url).toBe('https://api.test/repos/owner/repo/issues/comments/10')
    const patchBody = patch?.body as { body: string } | undefined
    expect(String(patchBody?.body)).toContain(REVIEW_MARKER)
    expect(
      calls.filter((call) => call.method === 'DELETE').map((call) => call.url),
    ).toEqual(['https://api.test/repos/owner/repo/issues/comments/12'])
  })

  it('creates the summary comment when there is none yet', async () => {
    const { fetchImpl, calls } = makeFetch((method, url) => {
      if (method === 'GET' && url.includes('/issues/7/comments')) {
        return { json: [{ id: 1, body: 'человеческий комментарий' }] }
      }
      if (method === 'POST' && url.includes('/issues/7/comments')) {
        return { json: { html_url: 'https://example.test/comment/99' } }
      }
      return { json: {} }
    })

    const url = await deliverSummary({ ...CONFIG, fetchImpl }, 'тело')
    expect(url).toBe('https://example.test/comment/99')
    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })

  it('walks pages while looking for its own comments', async () => {
    const pageOne = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      body: 'человеческий комментарий',
    }))
    const { fetchImpl, calls } = makeFetch((method, url) => {
      if (method === 'GET' && url.endsWith('page=1')) {
        return { json: pageOne }
      }
      if (method === 'GET' && url.endsWith('page=2')) {
        return { json: [{ id: 500, body: `${REVIEW_MARKER}\nстарое` }] }
      }
      if (method === 'PATCH') {
        return { json: { html_url: 'https://example.test/comment/500' } }
      }
      return { json: {} }
    })

    const url = await deliverSummary({ ...CONFIG, fetchImpl }, 'тело')

    expect(url).toBe('https://example.test/comment/500')
    expect(calls.some((call) => call.url.endsWith('page=2'))).toBe(true)
  })

  it('does nothing in dry-run mode', async () => {
    const { fetchImpl, calls } = makeFetch(() => ({ json: {} }))
    const url = await deliverSummary(
      { ...CONFIG, fetchImpl, dryRun: true },
      'тело',
    )
    expect(url).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
