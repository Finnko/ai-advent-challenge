import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMcpHost } from '@lib/mcp/client.server'
import { isProtectedPath } from '../domain/protected-paths'
import { createSandbox } from '../mcp/files/sandbox'
import { createFilesSource } from '../mcp/files/source'
import { createFilesToolkit } from '../mcp/files/tools'
import { devAssistantMcpRegistry } from '../server/mcp-registry.server'
import { openDevAssistantTools } from '../server/mcp-tools.server'

describe('файловая песочница', () => {
  const sandbox = createSandbox('/repo')

  it('нормализует безопасные пути', () => {
    expect(sandbox.resolvePath('docs/adr/0014.md')).toMatchObject({
      ok: true,
      relative: 'docs/adr/0014.md',
    })
    expect(sandbox.resolvePath('./src/../src/index.ts')).toMatchObject({
      ok: true,
      relative: 'src/index.ts',
    })
  })

  it('запрещает выход за корень и абсолютные пути', () => {
    expect(sandbox.resolvePath('../secret')).toMatchObject({ ok: false })
    expect(sandbox.resolvePath('/etc/passwd')).toMatchObject({ ok: false })
    expect(sandbox.resolvePath('src/../../etc')).toMatchObject({ ok: false })
    expect(sandbox.resolvePath('')).toMatchObject({ ok: false })
  })

  it('держит денлист по каталогам и файлам', () => {
    for (const path of [
      '.git/config',
      '.github/workflows/pr-review.yml',
      'node_modules/pkg/index.js',
      'dist/server/mcp/mcp-files.mjs',
      'src/dist/generated.ts',
      '.env',
      '.env.local',
      'data/app.sqlite',
    ]) {
      expect(isProtectedPath(path)).toBe(true)
      expect(sandbox.resolvePath(path)).toMatchObject({ ok: false })
    }
    expect(isProtectedPath('src/features/dev-assistant/README.md')).toBe(false)
    expect(isProtectedPath('src/environment.ts')).toBe(false)
  })
})

describe('файловый toolkit', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'file-mcp-'))
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src/a.ts'), 'line one\nline two\nline three\n')
    await writeFile(join(root, 'src/b.ts'), 'const answer = 42\n')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  function toolkit() {
    const sandbox = createSandbox(root)
    const source = createFilesSource({ sandbox })
    return createFilesToolkit({ sandbox, source })
  }

  it('обходит каталоги и фильтрует по glob', async () => {
    const result = await toolkit().listFiles({ glob: '*.ts' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('src/a.ts')
      expect(result.text).toContain('src/b.ts')
    }
  })

  it('читает файл с нумерацией и капом', async () => {
    const result = await toolkit().readFile({ path: 'src/a.ts', maxLines: 2 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('1: line one')
      expect(result.text).toContain('2: line two')
      expect(result.text).not.toContain('3: line three')
      expect(result.text).toContain('startLine=3')
    }
  })

  it('создаёт файл и правит уникальный фрагмент', async () => {
    const tools = toolkit()
    const created = await tools.writeFile({
      path: 'docs/new.md',
      content: '# Новый\n',
    })
    expect(created.ok).toBe(true)

    await expect(
      tools.editFile({
        path: 'src/b.ts',
        oldString: '42',
        newString: '43',
      }),
    ).resolves.toMatchObject({ ok: true })

    const edited = await toolkit().readFile({ path: 'src/b.ts' })
    expect(edited.text).toContain('43')
  })

  it('отказывает при неуникальном совпадении и без записи', async () => {
    await writeFile(join(root, 'src/dup.ts'), 'x\nx\n')
    const result = await toolkit().editFile({
      path: 'src/dup.ts',
      oldString: 'x',
      newString: 'y',
    })
    expect(result.ok).toBe(false)
    const content = await toolkit().readFile({ path: 'src/dup.ts' })
    expect(content.text).toContain('1: x')
  })

  it('не выходит за корень при записи', async () => {
    const result = await toolkit().writeFile({
      path: '../escape.txt',
      content: 'nope',
    })
    expect(result.ok).toBe(false)
  })

  it('ищет текст через подключаемый rg', async () => {
    const sandbox = createSandbox(root)
    const rgJson = [
      '{"type":"begin","data":{}}',
      '{"type":"match","data":{"path":{"text":"src/a.ts"},"line_number":2,"lines":{"text":"line two\\n"}}}',
      '{"type":"summary","data":{}}',
    ].join('\n')
    const source = createFilesSource({
      sandbox,
      rg: async () => rgJson,
    })
    const result = await createFilesToolkit({ sandbox, source }).searchText({
      query: 'line two',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('src/a.ts:2: line two')
    }
  })
})

describe('файловый MCP-сервер', () => {
  const host = createMcpHost(devAssistantMcpRegistry)

  it('объявляет файловые инструменты, мутирующие без readOnlyHint', async () => {
    const listed = await host.listTools()
    expect(listed.ok).toBe(true)
    if (!listed.ok) {
      return
    }
    const files = listed.tools.filter(
      (tool) => tool.server === 'dev-assistant-mcp-files',
    )
    expect(files.map((tool) => tool.name).sort()).toEqual([
      'edit_file',
      'list_files',
      'read_file',
      'search_text',
      'write_file',
    ])
    const mutating = files
      .filter((tool) => tool.mutating)
      .map((tool) => tool.name)
      .sort()
    expect(mutating).toEqual(['edit_file', 'write_file'])
  }, 20_000)

  it('ищет текст в реальном репозитории через rg', async () => {
    const result = await host.callToolOnServer('files', 'search_text', {
      query: 'dev-assistant-mcp-files',
      path: 'src/features/dev-assistant',
      maxResults: 5,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain('dev-assistant-mcp-files')
    }
  }, 20_000)
})

describe('сессия инструментов ассистента', () => {
  it('держит один процесс на сервер и отдаёт инструменты обоих серверов', async () => {
    const toolbox = await openDevAssistantTools()
    try {
      const names = toolbox.tools.map((tool) => tool.name)
      expect(names).toContain('mcp_read_file')
      expect(names).toContain('mcp_git_status')

      const read = toolbox.tools.find((tool) => tool.name === 'mcp_read_file')
      expect(read?.mutating).toBe(false)
      const first = await read?.run({ path: 'package.json', maxLines: 1 }, {})
      const second = await read?.run({ path: 'tsconfig.json', maxLines: 1 }, {})
      expect(first?.ok).toBe(true)
      expect(second?.ok).toBe(true)
    } finally {
      await toolbox.close()
    }
  }, 30_000)
})
