export default function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-strong))] px-4 py-2.5 text-sm">
        {content}
      </div>
    </div>
  )
}
