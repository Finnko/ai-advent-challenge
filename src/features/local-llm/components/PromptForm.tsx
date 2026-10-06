import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

type PromptFormProps = {
  onSubmit: (prompt: string) => void
  disabled: boolean
}

export default function PromptForm({ onSubmit, disabled }: PromptFormProps) {
  const [prompt, setPrompt] = useState('')

  const submit = () => {
    const text = prompt.trim()
    if (disabled || text.length === 0) {
      return
    }
    setPrompt('')
    onSubmit(text)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-3"
    >
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Свой вопрос локальной модели…"
        rows={2}
        disabled={disabled}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || prompt.trim().length === 0}>
          {disabled ? 'Думает…' : 'Отправить'}
        </Button>
      </div>
    </form>
  )
}
