export const SEARCH_DEFAULT_LIMIT = 5
export const SEARCH_MIN_LIMIT = 1
export const SEARCH_MAX_LIMIT = 10
export const SEARCH_SNIPPET_MAX_CHARS = 4000

export const SUMMARIZE_DEFAULT_SENTENCES = 5
export const SUMMARIZE_MIN_SENTENCES = 1
export const SUMMARIZE_MAX_SENTENCES = 15
export const SUMMARIZE_MAX_WORDS = 5000
export const VOLUME_NOTE_PREFIX = '[Объём:'

export const REPORT_EXTENSION = '.md'
export const REPORT_MAX_NAME_LENGTH = 80
export const REPORT_DEFAULT_NAME = 'report'
export const REPORT_READ_MAX_CHARS = 20_000

export type SearchResult = {
  title: string
  url: string
  snippet: string
}

export type WebSearchOptions = {
  full?: boolean
}

export type WebSource = {
  search(
    query: string,
    limit: number,
    options?: WebSearchOptions,
  ): Promise<SearchResult[]>
}

export type ReportEntry = {
  name: string
  size: number
  modifiedAt: string
}

export type ReportsStore = {
  save(name: string, content: string): Promise<{ path: string }>
  list(): Promise<ReportEntry[]>
  read(name: string): Promise<string | null>
}
