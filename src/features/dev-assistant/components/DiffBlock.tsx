import { useEffect, useState, type CSSProperties } from 'react'
import type { HighlighterCore, ThemedToken } from 'shiki/core'

type DiffToken = { content: string; style: CSSProperties | undefined }

type DiffLine = DiffToken[]

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [
      { createHighlighterCore },
      { createJavaScriptRegexEngine },
      diffLanguage,
      lightTheme,
      darkTheme,
    ] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('@shikijs/langs/diff'),
      import('@shikijs/themes/github-light'),
      import('@shikijs/themes/github-dark'),
    ])
    return createHighlighterCore({
      themes: [lightTheme.default, darkTheme.default],
      langs: [diffLanguage.default],
      engine: createJavaScriptRegexEngine(),
    })
  })()
  return highlighterPromise
}

async function highlightDiff(diff: string): Promise<DiffLine[]> {
  const highlighter = await getHighlighter()
  const { tokens } = highlighter.codeToTokens(diff, {
    lang: 'diff',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  })
  return tokens.map((line: ThemedToken[]) =>
    line.map((token) => ({
      content: token.content,
      style: token.htmlStyle as CSSProperties | undefined,
    })),
  )
}

function lineClass(text: string): string {
  if (text.startsWith('+++') || text.startsWith('---')) {
    return 'diff-line diff-line-meta'
  }
  if (text.startsWith('@@')) {
    return 'diff-line diff-line-hunk'
  }
  if (text.startsWith('+')) {
    return 'diff-line diff-line-added'
  }
  if (text.startsWith('-')) {
    return 'diff-line diff-line-removed'
  }
  return 'diff-line'
}

export default function DiffBlock({ diff }: { diff: string }) {
  const [lines, setLines] = useState<DiffLine[] | null>(null)

  useEffect(() => {
    let active = true
    highlightDiff(diff)
      .then((result) => {
        if (active) {
          setLines(result)
        }
      })
      .catch(() => {
        if (active) {
          setLines(null)
        }
      })
    return () => {
      active = false
    }
  }, [diff])

  if (!lines) {
    return (
      <pre className="demo-code-block mt-1 max-h-80 overflow-auto whitespace-pre-wrap text-xs">
        {diff}
      </pre>
    )
  }

  return (
    <div className="diff-block mt-1 max-h-80 overflow-auto py-1 font-mono text-xs">
      {lines.map((tokens, index) => (
        <div
          key={`${index}-${tokens.length}`}
          className={lineClass(tokens.map((token) => token.content).join(''))}
        >
          {tokens.map((token, tokenIndex) => (
            <span key={tokenIndex} className="diff-code" style={token.style}>
              {token.content}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
