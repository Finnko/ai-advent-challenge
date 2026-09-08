export default function TypingDots({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2" aria-label="Ожидание ответа">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-2 w-2 rounded-full bg-[var(--lagoon)]"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      {text && <span className="demo-muted text-xs">{text}</span>}
    </div>
  )
}
