import type { Example } from '../data/agent-ui'
import { Button } from '@/components/ui/Button'

type ExampleChipsProps = {
  examples: Example[]
  disabled?: boolean
  onPick: (text: string) => void
}

export default function ExampleChips({
  examples,
  disabled,
  onPick,
}: ExampleChipsProps) {
  if (examples.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {examples.map((example) => (
        <Button
          key={example.text}
          variant="secondary"
          size="sm"
          onClick={() => onPick(example.text)}
          disabled={disabled}
          className="text-left"
          title={example.note}
        >
          {example.text.length > 52
            ? `${example.text.slice(0, 52)}…`
            : example.text}
        </Button>
      ))}
    </div>
  )
}
