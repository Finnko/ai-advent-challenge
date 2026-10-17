import { asObject, requireText } from '@lib/functions/validation'
import type { StartReviewInput } from '../server/service.server'

export function requireProjectKey(value: unknown): string {
  const key = requireText(value, 'Ключ проекта обязателен')
  if (key.length > 120) {
    throw new Error('Ключ проекта длиннее 120 символов')
  }
  return key
}

function optionalReviewId(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('Некорректный id проверки')
  }
  return value
}

export function requireReviewId(value: unknown): number {
  const id = optionalReviewId(value)
  if (id === null) {
    throw new Error('Некорректный id проверки')
  }
  return id
}

function optionalSourcePath(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error('Некорректный путь к проекту')
  }
  const path = value.trim()
  if (path.length === 0) {
    return null
  }
  if (path.length > 1024) {
    throw new Error('Путь длиннее 1024 символов')
  }
  return path
}

export function parseStartReviewInput(value: unknown): StartReviewInput {
  const data = asObject(value)
  const sourcePath = optionalSourcePath(data.sourcePath)
  const zipBase64 =
    typeof data.zipBase64 === 'string' ? data.zipBase64.trim() : ''
  if (!sourcePath && zipBase64.length === 0) {
    throw new Error('Нужен архив или путь к распакованному проекту')
  }
  return {
    key: requireProjectKey(data.key),
    zipBase64,
    sourcePath,
    resumedFrom: optionalReviewId(data.resumedFrom),
  }
}

export function parseReviewIdInput(value: unknown): { reviewId: number } {
  const data = asObject(value)
  return { reviewId: requireReviewId(data.reviewId) }
}

export function parseProjectKeyInput(value: unknown): { key: string } {
  const data = asObject(value)
  return { key: requireProjectKey(data.key) }
}

export function parseCleanupInput(value: unknown): {
  key: string
  dropHistory: boolean
} {
  const data = asObject(value)
  return {
    key: requireProjectKey(data.key),
    dropHistory: data.dropHistory === true,
  }
}
