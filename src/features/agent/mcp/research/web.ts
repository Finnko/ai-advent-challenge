import type {
  SearchResult,
  WebSearchOptions,
  WebSource,
} from '../../domain/research/types.ts'

const API_URL = 'https://ru.wikipedia.org/w/api.php'
const REQUEST_TIMEOUT_MS = 8000
const FULL_EXTRACT_MAX_CHARS = 4000

type SearchPage = {
  title?: string
  extract?: string
  index?: number
}

type SearchResponse = {
  query?: {
    pages?: Record<string, SearchPage>
  }
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
    async search(query, limit, options?: WebSearchOptions) {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: String(limit),
        prop: 'extracts',
        explaintext: '1',
        exlimit: 'max',
        format: 'json',
        utf8: '1',
        origin: '*',
      })
      if (options?.full) {
        params.set('exchars', String(FULL_EXTRACT_MAX_CHARS))
      } else {
        params.set('exintro', '1')
      }
      const response = await fetchImpl(`${API_URL}?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`Wikipedia ${response.status}`)
      }
      const data = (await response.json()) as SearchResponse
      const pages = Object.values(data.query?.pages ?? {})
      return pages
        .filter(
          (page): page is SearchPage & { title: string } =>
            typeof page.title === 'string' && page.title.length > 0,
        )
        .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
        .map((page): SearchResult => ({
          title: page.title,
          url: articleUrl(page.title),
          snippet: (page.extract ?? '').replace(/\s+/g, ' ').trim(),
        }))
    },
  }
}
