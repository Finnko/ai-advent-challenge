import type { ReactNode } from 'react'
import type { ChatResult } from '@lib/llm'

export function usageLine(
  usage: ChatResult['usage'],
  label: string,
): ReactNode {
  return (
    <p className="demo-muted mt-1.5 text-xs">
      {label}:{' '}
      {usage
        ? `${usage.completion_tokens} ток.`
        : 'нет данных об использовании'}
    </p>
  )
}
