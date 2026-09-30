import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildMcpAgentTools } from '../domain/mcp/agent-tools'
import type { McpToolDescriptor } from '../domain/mcp/types'
import {
  clampSummarizeSentences,
  countWords,
  splitSentences,
  summarizeText,
} from '../domain/research/summarize'
import type {
  SearchResult,
  WebSearchOptions,
  WebSource,
} from '../domain/research/types'
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

  it('не принимает сокращения в погодной сводке за конец предложения', () => {
    expect(
      splitSentences('- влажность: мин 59 / сред. 75.1 / макс 88 %'),
    ).toEqual(['- влажность: мин 59 / сред. 75.1 / макс 88 %'])
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

  it('не обрезает составной отчёт, если лимит не задан', () => {
    const report = [
      '1 EUR = 1.1403 USD (2026-09-25, ECB / Frankfurter)',
      'Москва за последние 24 ч (22 сэмпла):',
      '- температура: мин 10.2 / сред. 13.2 / макс 17.4 °C',
      '- влажность: мин 59 / сред. 75.1 / макс 88 %',
      '- ветер: мин 3.1 / сред. 5.5 / макс 9.4 км/ч',
      'Брони по переговоркам:',
      '- Ладога: 6',
      '- Байкал: 3',
      '- Иртыш: 1',
      '- Онега: 1',
    ].join('\n')

    const summary = summarizeText(report, undefined)

    expect(summary).toContain('- влажность: мин 59 / сред. 75.1 / макс 88 %')
    expect(summary).toContain('Брони по переговоркам:')
    expect(summary).toContain('- Онега: 1')
  })

  it('ограничивает число предложений', () => {
    expect(clampSummarizeSentences(undefined)).toBe(5)
    expect(clampSummarizeSentences(0)).toBe(1)
    expect(clampSummarizeSentences(100)).toBe(15)
    expect(clampSummarizeSentences(3.4)).toBe(3)
  })

  it('сохраняет связные предложения и границы источников, не смешивая блоки', () => {
    const text = [
      'Результаты по запросу «евро»:',
      '1. Евро — https://ru.wikipedia.org/wiki/Евро',
      'Евро — валюта еврозоны из 20 государств. В обращении с 2002 года.',
      '2. Доллар — https://ru.wikipedia.org/wiki/Доллар',
      'Доллар — валюта США. Используется с 1792 года.',
    ].join('\n')
    const summary = summarizeText(text, 2)
    const lines = summary.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('https://ru.wikipedia.org/wiki/Евро')
    expect(lines[0]).toContain('Евро — валюта еврозоны из 20 государств.')
    expect(lines[1]).toContain('Доллар — валюта США.')
  })

  it('набирает объём по targetWords связными предложениями в исходном порядке', () => {
    const sentences = Array.from(
      { length: 8 },
      (_, index) => `Предложение номер ${index + 1} про евро и валюту.`,
    )
    const text = sentences.join(' ')
    const summary = summarizeText(text, { words: 24 })
    expect(countWords(summary)).toBeGreaterThanOrEqual(24)
    const out = splitSentences(summary)
    expect(out.length).toBeGreaterThanOrEqual(2)
    for (const [index, sentence] of out.entries()) {
      expect(sentences).toContain(sentence)
      if (index > 0) {
        expect(sentences.indexOf(sentence)).toBeGreaterThan(
          sentences.indexOf(out[index - 1]),
        )
      }
    }
  })

  it('набирает targetWords за пределами прежнего потолка в 15 предложений', () => {
    const sentences = Array.from(
      { length: 60 },
      (_, index) =>
        `Предложение номер ${index + 1} про евро и валютный рынок сегодня.`,
    )
    const text = sentences.join(' ')
    const summary = summarizeText(text, { words: 400 })
    expect(countWords(summary)).toBeGreaterThanOrEqual(400)
    expect(splitSentences(summary).length).toBeGreaterThan(15)
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
    expect((await toolkit.saveToFile({ name: 'x', content: ' ' })).ok).toBe(
      false,
    )
  })

  it('сохраняет факт-оговорку при сжатии (евро)', async () => {
    const toolkit = createResearchToolkit({
      web: fakeWeb([
        {
          title: 'Евро',
          url: 'https://ru.wikipedia.org/wiki/Евро',
          snippet:
            'Евро — официальная валюта 20 государств еврозоны. ' +
            'Используется также в Черногории и Косове, не входящих в еврозону. ' +
            'Символ € введён в 1996 году.',
        },
      ]),
      reports: createFileReportsStore(
        mkdtempSync(join(tmpdir(), 'reports-euro-')),
      ),
    })
    const search = await toolkit.search({ query: 'евро', limit: 1 })
    expect(search.ok).toBe(true)
    if (!search.ok) {
      return
    }
    const summary = await toolkit.summarize({
      text: search.text,
      targetWords: 15,
    })
    expect(summary.ok).toBe(true)
    if (!summary.ok) {
      return
    }
    expect(summary.text).toContain('20 государств')
    expect(summary.text).toContain('не входящих в еврозону')
    expect(summary.text).toContain('https://ru.wikipedia.org/wiki/')
  })

  it('не падает при нехватке источника: возвращает best-effort и пометку объёма', async () => {
    const toolkit = createResearchToolkit({
      web: fakeWeb(SAMPLE_RESULTS),
      reports: createFileReportsStore(
        mkdtempSync(join(tmpdir(), 'reports-target-')),
      ),
    })
    const result = await toolkit.summarize({
      text: 'Евро — валюта еврозоны. Курс евро вырос третий день подряд.',
      targetWords: 300,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('Евро — валюта еврозоны.')
      expect(result.text).toContain('[Объём:')
      expect(countWords(result.text)).toBeLessThan(300)
    }
  })

  it('передаёт full в источник для расширенного текста', async () => {
    let seen: WebSearchOptions | undefined
    const web: WebSource = {
      async search(_query, _limit, options) {
        seen = options
        return SAMPLE_RESULTS
      },
    }
    const toolkit = createResearchToolkit({
      web,
      reports: createFileReportsStore(
        mkdtempSync(join(tmpdir(), 'reports-full-')),
      ),
    })
    await toolkit.search({ query: 'евро', full: true })
    expect(seen?.full).toBe(true)
  })

  it('не сохраняет служебную пометку объёма в файл', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reports-note-'))
    const toolkit = createResearchToolkit({
      web: fakeWeb(SAMPLE_RESULTS),
      reports: createFileReportsStore(dir),
    })
    const summary = await toolkit.summarize({
      text: 'Евро — валюта еврозоны. Курс евро вырос.',
      targetWords: 200,
    })
    expect(summary.ok).toBe(true)
    if (!summary.ok) {
      return
    }
    const saved = await toolkit.saveToFile({
      name: 'note-test',
      content: summary.text,
    })
    expect(saved.ok).toBe(true)
    const read = await toolkit.readReport({ name: 'note-test' })
    expect(read.ok).toBe(true)
    if (read.ok) {
      expect(read.text).not.toContain('[Объём:')
      expect(read.text).toContain('Евро — валюта еврозоны.')
    }
    rmSync(dir, { recursive: true, force: true })
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
      mutating: false,
    }
    const [tool] = buildMcpAgentTools([descriptor], async () => ({
      ok: true,
      text: '',
    }))
    expect(tool.name).toBe('mcp_search')
    expect(tool.description).toBe('[research] Ищет.')
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
  it('возвращает лид статьи и ссылку в порядке поиска', async () => {
    let requested = ''
    const fetchImpl = (async (url: string) => {
      requested = url
      return {
        ok: true,
        async json() {
          return {
            query: {
              pages: {
                '2': {
                  title: 'Доллар США',
                  extract: 'Доллар — валюта США.',
                  index: 2,
                },
                '1': {
                  title: 'Евро',
                  extract: 'Евро — валюта еврозоны.   Лид.',
                  index: 1,
                },
              },
            },
          }
        },
      } as unknown as Response
    }) as unknown as typeof fetch
    const source = createWikipediaSource(fetchImpl)
    const results = await source.search('евро', 3)
    expect(requested).toContain('generator=search')
    expect(requested).toContain('prop=extracts')
    expect(results).toEqual([
      {
        title: 'Евро',
        url: 'https://ru.wikipedia.org/wiki/%D0%95%D0%B2%D1%80%D0%BE',
        snippet: 'Евро — валюта еврозоны. Лид.',
      },
      {
        title: 'Доллар США',
        url: 'https://ru.wikipedia.org/wiki/%D0%94%D0%BE%D0%BB%D0%BB%D0%B0%D1%80_%D0%A1%D0%A8%D0%90',
        snippet: 'Доллар — валюта США.',
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
