import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isMutatingTool } from '../domain/agent-tools'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import type { McpToolDescriptor } from '../domain/mcp/types'
import {
  clampSummarizeSentences,
  splitSentences,
  summarizeText,
} from '../domain/research/summarize'
import type { SearchResult, WebSource } from '../domain/research/types'
import { mcpServerConfigs } from '../server/mcp-registry.server'
import {
  createFileReportsStore,
  resolveReportsDir,
  sanitizeReportName,
} from '../mcp/research/reports'
import { createResearchToolkit } from '../mcp/research/tools'
import { createWikipediaSource } from '../mcp/research/web'

function fakeWeb(results: SearchResult[]): WebSource {
  return {
    async search() {
      return results
    },
  }
}

const SAMPLE_RESULTS: SearchResult[] = [
  {
    title: 'Евро',
    url: 'https://ru.wikipedia.org/wiki/%D0%95%D0%B2%D1%80%D0%BE',
    snippet: 'Евро — официальная валюта еврозоны.',
  },
  {
    title: 'Доллар США',
    url: 'https://ru.wikipedia.org/wiki/%D0%94%D0%BE%D0%BB%D0%BB%D0%B0%D1%80_%D0%A1%D0%A8%D0%90',
    snippet: 'Доллар США — денежная единица США.',
  },
]

describe('research summarize', () => {
  it('делит текст на предложения', () => {
    expect(splitSentences('Первое предложение. Второе!\nТретье?')).toEqual([
      'Первое предложение.',
      'Второе!',
      'Третье?',
    ])
  })

  it('оставляет не больше лимита и сохраняет порядок', () => {
    const text =
      'Курс евро вырос. Доллар укрепился к иене. ' +
      'Инфляция замедлилась. Рынок ждёт решения ФРС.'
    const summary = summarizeText(text, 2)
    expect(splitSentences(summary)).toHaveLength(2)
    expect(summary.indexOf('Курс евро вырос.')).toBe(0)
  })

  it('возвращает текст целиком, если предложений меньше лимита', () => {
    expect(summarizeText('Одно короткое предложение.', 5)).toBe(
      'Одно короткое предложение.',
    )
  })

  it('ограничивает число предложений', () => {
    expect(clampSummarizeSentences(undefined)).toBe(5)
    expect(clampSummarizeSentences(0)).toBe(1)
    expect(clampSummarizeSentences(100)).toBe(15)
    expect(clampSummarizeSentences(3.4)).toBe(3)
  })
})

describe('research reports', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'reports-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('санитизирует имена отчётов', () => {
    expect(sanitizeReportName('euro/usd')).toBe('euro-usd.md')
    expect(sanitizeReportName('../../etc/passwd')).toBe('etc-passwd.md')
    expect(sanitizeReportName('  Мой отчёт  ')).toBe('Мой-отчёт.md')
    expect(sanitizeReportName('.hidden')).toBe('hidden.md')
    expect(sanitizeReportName('')).toBe('report.md')
    expect(sanitizeReportName('report.MD')).toBe('report.MD')
  })

  it('сохраняет, перечисляет и читает отчёты', async () => {
    const reports = createFileReportsStore(dir)
    const saved = await reports.save('euro', 'Курс EUR/USD: 1.08')
    expect(saved.path.endsWith('euro.md')).toBe(true)

    const list = await reports.list()
    expect(list.map((entry) => entry.name)).toContain('euro.md')
    expect(list[0].size).toBeGreaterThan(0)

    expect(await reports.read('euro')).toBe('Курс EUR/USD: 1.08')
    expect(await reports.read('missing')).toBeNull()
  })

  it('читает пустой список из несуществующей папки', async () => {
    const reports = createFileReportsStore(join(dir, 'nested', 'none'))
    expect(await reports.list()).toEqual([])
  })

  it('использует REPORTS_DIR, если он задан', () => {
    const previous = process.env.REPORTS_DIR
    process.env.REPORTS_DIR = '/tmp/custom-reports'
    try {
      expect(resolveReportsDir()).toBe('/tmp/custom-reports')
    } finally {
      if (previous === undefined) {
        delete process.env.REPORTS_DIR
      } else {
        process.env.REPORTS_DIR = previous
      }
    }
  })
})

describe('research toolkit', () => {
  it('ищет и форматирует результаты', async () => {
    const toolkit = createResearchToolkit({
      web: fakeWeb(SAMPLE_RESULTS),
      reports: createFileReportsStore(
        mkdtempSync(join(tmpdir(), 'reports-toolkit-')),
      ),
    })
    const result = await toolkit.search({ query: 'евро доллар', limit: 2 })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('Результаты по запросу «евро доллар»')
    expect(result.text).toContain('1. Евро')
    expect(result.text).toContain('https://ru.wikipedia.org/wiki/')
  })

  it('честно сообщает об отсутствии результатов', async () => {
    const toolkit = createResearchToolkit({
      web: fakeWeb([]),
      reports: createFileReportsStore(
        mkdtempSync(join(tmpdir(), 'reports-toolkit-')),
      ),
    })
    const result = await toolkit.search({ query: 'нет такого' })
    expect(result.ok).toBe(true)
    expect(result.text).toContain('Ничего не найдено')
  })

  it('сжимает, сохраняет, перечисляет и читает', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reports-toolkit-'))
    const toolkit = createResearchToolkit({
      web: fakeWeb(SAMPLE_RESULTS),
      reports: createFileReportsStore(dir),
    })

    const summary = await toolkit.summarize({
      text: 'Курс евро вырос. Доллар укрепился. Инфляция замедлилась.',
      maxSentences: 2,
    })
    expect(summary.ok).toBe(true)

    const saved = await toolkit.saveToFile({
      name: 'euro-report',
      content: summary.ok ? summary.text : '',
    })
    expect(saved.ok).toBe(true)
    expect(saved.text).toContain('Сохранено:')

    const list = await toolkit.listReports()
    expect(list.ok).toBe(true)
    expect(list.text).toContain('euro-report.md')

    const read = await toolkit.readReport({ name: 'euro-report' })
    expect(read.ok).toBe(true)
    expect(read.text.length).toBeGreaterThan(0)

    rmSync(dir, { recursive: true, force: true })
  })

  it('отказывает на пустом вводе', async () => {
    const toolkit = createResearchToolkit({
      web: fakeWeb(SAMPLE_RESULTS),
      reports: createFileReportsStore(
        mkdtempSync(join(tmpdir(), 'reports-toolkit-')),
      ),
    })
    expect((await toolkit.search({ query: '   ' })).ok).toBe(false)
    expect((await toolkit.summarize({ text: '' })).ok).toBe(false)
    expect((await toolkit.saveToFile({ name: 'x', content: ' ' })).ok).toBe(false)
  })
})

describe('research descriptor and gating', () => {
  it('добавляет провенанс сервера в описание', () => {
    const descriptor: McpToolDescriptor = {
      name: 'search',
      title: 'Поиск',
      description: 'Ищет.',
      inputSchema: { type: 'object', properties: {}, required: [] },
      server: 'agent-mcp-research',
    }
    const [tool] = buildMcpAgentTools([descriptor], async () => ({
      ok: true,
      text: '',
    }))
    expect(tool.name).toBe('mcp_search')
    expect(tool.description).toBe('[research] Ищет.')
  })

  it('гейтит только save_to_file', () => {
    expect(isMutatingTool('mcp_save_to_file')).toBe(true)
    expect(isMutatingTool('mcp_search')).toBe(false)
    expect(isMutatingTool('mcp_summarize')).toBe(false)
    expect(isMutatingTool('mcp_list_reports')).toBe(false)
  })

  it('регистрирует сервер research без скрытых тулов', () => {
    const research = mcpServerConfigs().find(
      (server) => server.kind === 'research',
    )
    expect(research?.name).toBe('agent-mcp-research')
    expect(research?.hiddenTools).toEqual([])
  })
})

describe('research wikipedia source', () => {
  it('парсит ответ и чистит HTML', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        async json() {
          return {
            query: {
              search: [
                { title: 'Евро', snippet: '<span class="x">Евро</span> — валюта' },
              ],
            },
          }
        },
      }) as unknown as Response) as unknown as typeof fetch
    const source = createWikipediaSource(fetchImpl)
    const results = await source.search('евро', 3)
    expect(results).toEqual([
      {
        title: 'Евро',
        url: 'https://ru.wikipedia.org/wiki/%D0%95%D0%B2%D1%80%D0%BE',
        snippet: 'Евро — валюта',
      },
    ])
  })
})

describe.runIf(process.env.RUN_NETWORK_TESTS === '1')('Wikipedia', () => {
  it('находит статьи по запросу', async () => {
    const source = createWikipediaSource()
    const results = await source.search('евро', 3)
    expect(results.length).toBeGreaterThan(0)
  }, 20_000)
})
