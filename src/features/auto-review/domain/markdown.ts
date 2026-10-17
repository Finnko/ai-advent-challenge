import { CRITERION_GROUP_LABELS } from '../data/criteria'
import type { CriterionGroup } from '../data/criteria'
import type { CriterionResult, ProjectSummary, ReviewRecord } from '../types'
import { CRITERION_STATUS_LABELS, REVIEW_STATUS_LABELS } from '../types'
import { countVerdicts } from './counts'
import { formatFindings } from './findings'
import { formatTimestamp } from './format'

function criterionBlock(
  result: CriterionResult,
  heading: 'bold' | 'section',
): string {
  const lines: string[] = []
  if (heading === 'section') {
    lines.push(`### ${result.code} — ${CRITERION_STATUS_LABELS[result.status]}`)
  } else {
    lines.push(`**${result.code} — ${CRITERION_STATUS_LABELS[result.status]}**`)
  }
  lines.push('', result.title)
  const reason = result.reason.trim()
  if (reason.length > 0) {
    lines.push('', `Причина: ${reason}`)
  }
  if (result.findings.length > 0) {
    lines.push('', formatFindings(result.findings))
  }
  return lines.join('\n')
}

export function criterionMarkdown(result: CriterionResult): string {
  return criterionBlock(result, 'bold')
}

export function findingsMarkdown(results: CriterionResult[]): string {
  const failed = results.filter((result) => result.status === 'fail')
  if (failed.length === 0) {
    return 'Замечаний нет.'
  }
  return failed
    .map((result) => {
      const lines = [`### ${result.code} — ${result.title}`]
      if (result.findings.length > 0) {
        lines.push('', formatFindings(result.findings))
      } else if (result.reason.trim().length > 0) {
        lines.push('', `Причина: ${result.reason.trim()}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')
}

export function reviewMarkdown(input: {
  project: ProjectSummary
  review: ReviewRecord
}): string {
  const { project, review } = input
  const counts = countVerdicts(review.results)
  const lines = [
    `# Авторевью: ${project.name}`,
    '',
    `- Ключ проекта: ${project.key}`,
    `- Проверка: #${review.id}`,
    `- Дата: ${formatTimestamp(review.createdAt)}`,
    `- Статус: ${REVIEW_STATUS_LABELS[review.status]}`,
    `- Итог: пройдено ${counts.passed}, не пройдено ${counts.failed}, не проверено ${counts.notChecked}`,
  ]
  if (review.resumedFrom) {
    lines.push(`- Повторная проверка: по #${review.resumedFrom}`)
  }
  if (review.status === 'cancelled') {
    lines.push('', 'Проверка прервана: отчёт неполный.')
  }
  if (review.error) {
    lines.push('', `Ошибка: ${review.error}`)
  }
  const groups: CriterionGroup[] = ['basic', 'advanced']
  for (const group of groups) {
    const items = review.results.filter((result) => result.group === group)
    if (items.length === 0) {
      continue
    }
    lines.push('', `## ${CRITERION_GROUP_LABELS[group]}`)
    for (const item of items) {
      lines.push('', criterionBlock(item, 'section'))
    }
  }
  return lines.join('\n')
}
