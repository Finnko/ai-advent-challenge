import ReactMarkdown, { type Components } from 'react-markdown'

const components: Components = {
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-semibold text-[var(--accent-strong)] underline decoration-[color-mix(in_oklab,var(--accent)_45%,transparent)] underline-offset-2"
      >
        {children}
      </a>
    )
  },
  code({ children }) {
    return (
      <code className="rounded bg-[var(--surface-tint)] px-1 py-0.5 font-mono text-[0.9em] text-[var(--ink)]">
        {children}
      </code>
    )
  },
}

export default function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-4 prose-headings:text-[var(--ink)] prose-p:text-[var(--ink-soft)] prose-li:text-[var(--ink-soft)] prose-strong:text-[var(--ink)] prose-ol:text-[var(--ink-soft)] prose-ul:text-[var(--ink-soft)] first:prose-headings:mt-0">
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  )
}
