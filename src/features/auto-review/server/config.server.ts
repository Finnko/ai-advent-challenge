function num(name: string, fallback: number): number {
  const raw = process.env[name]?.trim()
  if (!raw) {
    return fallback
  }
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function maxUploadBytes(): number {
  return num('AUTO_REVIEW_MAX_UPLOAD_BYTES', 40 * 1024 * 1024)
}

export function installTimeoutMs(): number {
  return num('AUTO_REVIEW_INSTALL_TIMEOUT_MS', 5 * 60 * 1000)
}

export function serveTimeoutMs(): number {
  return num('AUTO_REVIEW_SERVE_TIMEOUT_MS', 60 * 1000)
}

export function testTimeoutMs(): number {
  return num('AUTO_REVIEW_TEST_TIMEOUT_MS', 10 * 60 * 1000)
}

export function runTimeoutMs(): number {
  return num('AUTO_REVIEW_RUN_TIMEOUT_MS', 30 * 60 * 1000)
}

export function codeBudgetChars(): number {
  return num('AUTO_REVIEW_CODE_BUDGET', 120_000)
}

export function judgeMaxTokens(): number {
  return num('AUTO_REVIEW_JUDGE_MAX_TOKENS', 2600)
}

export function browsers(): string[] {
  const raw = process.env.AUTO_REVIEW_BROWSERS?.trim()
  const list = raw
    ? raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : ['chromium', 'firefox']
  return list.length > 0 ? list : ['chromium']
}
