import type { ToolArgs } from '@lib/agent-loop/types'
import {
  runInvariantActionChecks,
  type InvariantRule,
} from '@lib/invariants/checks'
import type { InvariantInput, InvariantRecord } from '@lib/invariants/types'
import { formatInvariantsBlock } from '@lib/invariants/read'
import { isProtectedPath } from './protected-paths'
import { toolKey } from './file-persona'

const SECRET =
  /sk-[A-Za-z0-9]{16,}|DEEPSEEK_API_KEY\s*=|TELEGRAM_BOT_TOKEN\s*=|LLM_SERVICE_KEYS\s*=|BEGIN [A-Z ]*PRIVATE KEY/

const MUTATING = new Set(['write_file', 'edit_file'])

export type FileInvariantContext = {
  planPaths: string[]
}

export const FILE_INVARIANTS: InvariantInput[] = [
  {
    slug: 'plan-paths-only',
    category: 'decision',
    title: 'Только файлы из утверждённого плана',
    text: 'Изменяющие инструменты пишут только те файлы, которые перечислены в утверждённом плане.',
    check: 'plan-paths-only',
  },
  {
    slug: 'no-secrets-in-files',
    category: 'stack',
    title: 'Секреты не попадают в файлы',
    text: 'Ключи, токены и приватные ключи не записываются в файлы проекта.',
    check: 'no-secrets-in-files',
  },
  {
    slug: 'protected-paths',
    category: 'architecture',
    title: 'Защищённые пути',
    text: 'Файлы .git/, .github/, node_modules/, dist/, .env* и *.sqlite не изменяются.',
    check: 'protected-paths',
  },
]

function pathOf(args: ToolArgs): string {
  return String(args.path ?? '')
}

export function containsSecret(text: string): boolean {
  return SECRET.test(text)
}

function isPlanned(path: string, planPaths: string[]): boolean {
  return planPaths.some(
    (planned) =>
      path === planned ||
      path.endsWith(`/${planned}`) ||
      planned.endsWith(`/${path}`),
  )
}

const FILE_RULES: InvariantRule<FileInvariantContext>[] = [
  {
    check: 'plan-paths-only',
    testAction: ({ tool, args }, ctx) => {
      if (!MUTATING.has(toolKey(tool)) || ctx.planPaths.length === 0) {
        return false
      }
      return !isPlanned(pathOf(args), ctx.planPaths)
    },
  },
  {
    check: 'no-secrets-in-files',
    testAction: ({ tool, args }) => {
      if (!MUTATING.has(toolKey(tool))) {
        return false
      }
      return containsSecret(`${args.content ?? ''}\n${args.newString ?? ''}`)
    },
  },
  {
    check: 'protected-paths',
    testAction: ({ tool, args }) =>
      MUTATING.has(toolKey(tool)) && isProtectedPath(pathOf(args)),
  },
]

export function runFileActionChecks(
  invariants: InvariantRecord[],
  call: { tool: string; args: ToolArgs },
  ctx: FileInvariantContext,
) {
  return runInvariantActionChecks(invariants, FILE_RULES, call, ctx)
}

export function buildFileInvariantBlock(
  invariants: InvariantRecord[],
): string | null {
  if (invariants.length === 0) {
    return null
  }
  return formatInvariantsBlock(invariants)
}
