import type { Example } from '../../lib/agent-ui'

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
        <button
          key={example.text}
          type="button"
          onClick={() => onPick(example.text)}
          disabled={disabled}
          className="demo-button demo-button-secondary px-3 py-1 text-left text-xs"
          title={example.note}
        >
          {example.text.length > 52
            ? `${example.text.slice(0, 52)}…`
            : example.text}
        </button>
      ))}
    </div>
  )
}
