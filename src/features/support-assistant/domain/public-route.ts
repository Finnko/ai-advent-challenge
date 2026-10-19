const PUBLIC_PATHS = new Set([
  '/support',
  '/support/',
  '/favicon.ico',
  '/robots.txt',
  '/api/support/sellers',
  '/api/support/ask',
  '/api/support/health',
])

export function isSupportPublicPath(pathname: string): boolean {
  if (pathname.includes('..') || pathname.toLowerCase().includes('%2e')) {
    return false
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return true
  }
  return pathname.startsWith('/assets/') && pathname.length > '/assets/'.length
}
