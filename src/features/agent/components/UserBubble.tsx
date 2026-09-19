export default function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex w-full justify-end">
      <div className="max-w-[85%] break-words rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-strong))] px-4 py-2.5 text-sm">
        {text}
      </div>
    </div>
  )
}
