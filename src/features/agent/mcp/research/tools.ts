import {
  clampSummarizeSentences,
  countWords,
  stripVolumeNote,
  summarizeText,
  volumeNote,
} from '../../domain/research/summarize.ts'
import {
  REPORT_READ_MAX_CHARS,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_LIMIT,
  SEARCH_SNIPPET_MAX_CHARS,
  type ReportsStore,
  type SearchResult,
  type WebSource,
} from '../../domain/research/types.ts'
import {
  errorMessage,
  fail,
  ok,
  type ToolResult,
} from '../shared/response.ts'

type Args = Record<string, unknown>

export type ResearchToolResult = ToolResult

export type ResearchToolkitDeps = {
  web: WebSource
  reports: ReportsStore
}

export type ResearchToolkit = {
  search: (args: Args) => Promise<ResearchToolResult>
  summarize: (args: Args) => Promise<ResearchToolResult>
  saveToFile: (args: Args) => Promise<ResearchToolResult>
  listReports: () => Promise<ResearchToolResult>
  readReport: (args: Args) => Promise<ResearchToolResult>
}

const SNIPPET_MAX_CHARS = SEARCH_SNIPPET_MAX_CHARS

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function clampSearchLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return SEARCH_DEFAULT_LIMIT
  }
  const rounded = Math.round(value)
  if (rounded < SEARCH_MIN_LIMIT) {
    return SEARCH_MIN_LIMIT
  }
  if (rounded > SEARCH_MAX_LIMIT) {
    return SEARCH_MAX_LIMIT
  }
  return rounded
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  return `${text.slice(0, max)}…(обрезано)`
}

function formatResults(query: string, results: SearchResult[]): string {
  const lines = results.map((item, index) => {
    const snippet = truncate(item.snippet, SNIPPET_MAX_CHARS)
    const tail = snippet ? `\n   ${snippet}` : ''
    return `${index + 1}. ${item.title} — ${item.url}${tail}`
  })
  return [`Результаты по запросу «${query}»:`, ...lines].join('\n')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`
  }
  return `${Math.round((bytes / 1024) * 10) / 10} КБ`
}

export function createResearchToolkit(
  deps: ResearchToolkitDeps,
): ResearchToolkit {
  return {
    async search(args) {
      const query = asString(args.query)
      if (!query) {
        return fail('query не должен быть пустым.')
      }
      const limit = clampSearchLimit(args.limit)
      const full = args.full === true
      let results: SearchResult[]
      try {
        results = await deps.web.search(query, limit, { full })
      } catch (error) {
        return fail(`Поиск не удался: ${errorMessage(error)}`)
      }
      if (results.length === 0) {
        return ok(`Ничего не найдено по запросу «${query}».`)
      }
      return ok(formatResults(query, results))
    },

    async summarize(args) {
      const text = asString(args.text)
      if (!text) {
        return fail('text не должен быть пустым.')
      }
      const targetWords =
        typeof args.targetWords === 'number' && Number.isFinite(args.targetWords)
          ? Math.max(1, Math.round(args.targetWords))
          : undefined
      const summary = summarizeText(
        text,
        targetWords !== undefined
          ? { words: targetWords }
          : clampSummarizeSentences(args.maxSentences),
      )
      if (!summary) {
        return fail('В тексте нет предложений для пересказа.')
      }
      if (targetWords === undefined) {
        return ok(summary)
      }
      const actualWords = countWords(summary)
      if (actualWords >= targetWords) {
        return ok(summary)
      }
      return ok(
        `${summary}\n\n${volumeNote(actualWords, targetWords, countWords(text))}`,
      )
    },

    async saveToFile(args) {
      const content = typeof args.content === 'string' ? args.content : ''
      if (!content.trim()) {
        return fail('content не должен быть пустым.')
      }
      const name = typeof args.name === 'string' ? args.name : ''
      try {
        const saved = await deps.reports.save(name, stripVolumeNote(content))
        return ok(`Сохранено: ${saved.path}`)
      } catch (error) {
        return fail(`Не удалось сохранить отчёт: ${errorMessage(error)}`)
      }
    },

    async listReports() {
      let entries
      try {
        entries = await deps.reports.list()
      } catch (error) {
        return fail(`Не удалось прочитать отчёты: ${errorMessage(error)}`)
      }
      if (entries.length === 0) {
        return ok('Сохранённых отчётов нет.')
      }
      const lines = entries.map(
        (entry) =>
          `- ${entry.name} (${formatSize(entry.size)}, ${entry.modifiedAt})`,
      )
      return ok(['Отчёты:', ...lines].join('\n'))
    },

    async readReport(args) {
      const name = asString(args.name)
      if (!name) {
        return fail('name не должен быть пустым.')
      }
      let content: string | null
      try {
        content = await deps.reports.read(name)
      } catch (error) {
        return fail(`Не удалось прочитать отчёт: ${errorMessage(error)}`)
      }
      if (content === null) {
        return fail(`Отчёт «${name}» не найден.`)
      }
      return ok(truncate(content, REPORT_READ_MAX_CHARS))
    },
  }
}
