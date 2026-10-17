import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))

const BROWSER_DEVICES: Record<string, (typeof devices)[string]> = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
}

function requestedBrowsers(): string[] {
  const raw = process.env.AUTO_REVIEW_BROWSERS?.trim()
  const list = raw
    ? raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : ['chromium', 'firefox']
  return list.length > 0 ? list : ['chromium']
}

export default defineConfig({
  testDir: path.join(here, 'specs'),
  outputDir: process.env.AUTO_REVIEW_ARTIFACTS_DIR
    ? path.join(process.env.AUTO_REVIEW_ARTIFACTS_DIR, 'test-results')
    : path.join(here, 'test-results'),
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], [path.join(here, 'reporters/review-reporter.ts')]],
  use: {
    baseURL: process.env.AUTO_REVIEW_BASE_URL,
    viewport: { width: 1280, height: 1000 },
    locale: 'en-US',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: requestedBrowsers().map((name) => ({
    name,
    use: BROWSER_DEVICES[name] ?? {},
  })),
})
