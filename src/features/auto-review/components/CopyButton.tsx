import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@lib/utils'
import { Button } from '@/components/ui/Button'

type CopyState = 'idle' | 'copied' | 'error'

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.left = '0'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(area)
  if (!copied) {
    throw new Error('Браузер не разрешил копирование')
  }
}

export default function CopyButton({
  text,
  label,
  className,
}: {
  text: string
  label: string
  className?: string
}) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
      }
    },
    [],
  )

  const run = async () => {
    try {
      await copyText(text)
      setState('copied')
    } catch {
      setState('error')
    }
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
    }
    timer.current = window.setTimeout(() => setState('idle'), 1600)
  }

  let title = label
  let announcement = ''
  if (state === 'copied') {
    title = 'Скопировано'
    announcement = 'Скопировано в буфер обмена'
  } else if (state === 'error') {
    title = 'Не удалось скопировать'
    announcement = 'Не удалось скопировать в буфер обмена'
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-7 w-7',
          state === 'copied' && 'text-[var(--positive)]',
          state === 'error' && 'text-[var(--danger)]',
          className,
        )}
        aria-label={title}
        title={title}
        onClick={() => void run()}
      >
        {state === 'copied' ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}
