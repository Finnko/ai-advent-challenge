import { test as base, expect } from '@playwright/test'

const NETWORK_RE =
  /Failed to load resource|net::ERR|ERR_|NetworkError|Failed to fetch|ERR_FAILED|ERR_ABORTED|aborted|Load failed/i

export const test = base.extend<{ trackErrors: void }>({
  trackErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.message}`)
      })
      page.on('console', (message) => {
        if (message.type() !== 'error') {
          return
        }
        const text = message.text()
        if (NETWORK_RE.test(text)) {
          return
        }
        errors.push(`console: ${text}`)
      })
      await use()
      await testInfo.attach('console-errors', {
        body: JSON.stringify(errors),
        contentType: 'application/json',
      })
    },
    { auto: true },
  ],
})

export { expect }
