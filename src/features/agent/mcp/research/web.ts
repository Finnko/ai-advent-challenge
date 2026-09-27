import type { SearchResult, WebSource } from '../../domain/research/types.ts'

const API_URL = 'https://ru.wikipedia.org/w/api.php'
const REQUEST_TIMEOUT_MS = 8000

type SearchResponse = {
  query?: {
    search?: Array<{ title?: string; snippet?: string }>
  }
}

const ENTITIES: Array<[RegExp, string]> = [
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&amp;/g, '&'],
]

function stripHtml(html: string): string {
  let text = html.replace(/<[^>]*>/g, '')
  for (const [pattern, value] of ENTITIES) {
    text = text.replace(pattern, value)
  }
  return text.replace(/\s+/g, ' ').trim()
}

function articleUrl(title: string): string {
  return `https://ru.wikipedia.org/wiki/${encodeURIComponent(
    title.replace(/\s+/g, '_'),
  )}`
}

export function createWikipediaSource(
  fetchImpl: typeof fetch = fetch,
): WebSource {
  return {
    async search(query, limit) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: String(limit),
        format: 'json',
        utf8: '1',
        origin: '*',
      })
      const response = await fetchImpl(`${API_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`Wikipedia ${response.status}`)
      }
      const data = (await response.json()) as SearchResponse
      const results = data.query?.search ?? []
      return results
        .filter((item): item is { title: string; snippet?: string } =>
          typeof item.title === 'string' && item.title.length > 0,
        )
        .map(
          (item): SearchResult => ({
            title: item.title,
            url: articleUrl(item.title),
            snippet: stripHtml(item.snippet ?? ''),
          }),
        )
    },
  }
}
