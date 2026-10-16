import type { InvariantRecord } from '@lib/invariants/types'
import { containsSecret } from './file-invariants'
import { isProtectedPath } from './protected-paths'

export type InvariantCheckFile = {
  path: string
  content: string | null
}

export type InvariantViolation = {
  code: string
  title: string
  path: string
  detail: string
}

export type InvariantCheckResult = {
  checked: string[]
  skipped: string[]
  violations: InvariantViolation[]
}

export function checkInvariants(input: {
  invariants: InvariantRecord[]
  files: InvariantCheckFile[]
}): InvariantCheckResult {
  const checked = new Set<string>()
  const skipped: string[] = []
  const violations: InvariantViolation[] = []

  for (const record of input.invariants) {
    const code = `INV-${record.id}`
    if (record.check === 'protected-paths') {
      checked.add(code)
      for (const file of input.files) {
        if (isProtectedPath(file.path)) {
          violations.push({
            code,
            title: record.title,
            path: file.path,
            detail: 'путь в защищённой зоне',
          })
        }
      }
      continue
    }
    if (record.check === 'no-secrets-in-files') {
      checked.add(code)
      for (const file of input.files) {
        if (file.content !== null && containsSecret(file.content)) {
          violations.push({
            code,
            title: record.title,
            path: file.path,
            detail: 'в содержимом есть похожее на секрет',
          })
        }
      }
      continue
    }
    skipped.push(`${code} ${record.title}`)
  }

  return { checked: [...checked], skipped, violations }
}

export function formatInvariantReport(
  result: InvariantCheckResult,
  fileCount: number,
): string {
  const rules = result.checked.length > 0 ? result.checked.join(', ') : 'нет'
  const skippedLine =
    result.skipped.length > 0
      ? `Не проверяются статически (нужен план): ${result.skipped.join('; ')}.`
      : null
  if (result.violations.length === 0) {
    return [
      `Нарушений нет: проверено изменённых файлов — ${fileCount}, правила — ${rules}.`,
      ...(skippedLine ? [skippedLine] : []),
    ].join('\n')
  }
  return [
    `Найдены нарушения (${result.violations.length}):`,
    ...result.violations.map(
      (violation) =>
        `- ${violation.code} ${violation.title}: ${violation.path} (${violation.detail})`,
    ),
    ...(skippedLine ? [skippedLine] : []),
  ].join('\n')
}
