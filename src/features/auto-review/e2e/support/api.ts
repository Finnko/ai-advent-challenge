import type { Page, Route } from '@playwright/test'
import {
  COLOGNE_OFFER,
  FAVORITES,
  NEARBY,
  NEW_REVIEW,
  OFFERS,
  PREMIUM_OFFER,
  REGULAR_OFFER,
  REVIEWS,
  USER,
  type OfferFull,
} from './fixtures'

export type ApiOptions = {
  auth?: boolean
  emptyOffers?: boolean
  emptyFavorites?: boolean
  emptyReviews?: boolean
  loginFails?: boolean
  reviewFails?: boolean
  reviewDelayMs?: number
}

export type ApiState = {
  favoritesRequested: number
  favoritesPosted: string[]
  loginRequested: number
  loginPosted: number
  loginBody: unknown
  logoutRequested: number
  reviewsPosted: { comment?: string; rating?: number }[]
  authenticated: boolean
}

const OFFER_BY_ID: Record<string, OfferFull> = {
  'regular-offer-paris': REGULAR_OFFER,
  'premium-offer-paris': PREMIUM_OFFER,
  'regular-offer-cologne': COLOGNE_OFFER,
}

const TOKEN_KEY = 'six-cities-token'
const IMAGE_RE = /\.(png|jpe?g|svg|gif|webp|woff2?|ttf|eot)($|\?)/i

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

function apiPath(url: URL): string {
  const marker = '/six-cities'
  const index = url.pathname.indexOf(marker)
  return index >= 0 ? url.pathname.slice(index + marker.length) : url.pathname
}

async function handleApi(
  route: Route,
  url: URL,
  options: ApiOptions,
  state: ApiState,
): Promise<void> {
  const path = apiPath(url)
  const method = route.request().method()

  if (path === '/offers' && method === 'GET') {
    await json(route, 200, options.emptyOffers ? [] : OFFERS)
    return
  }
  if (path === '/favorite' && method === 'GET') {
    state.favoritesRequested += 1
    await json(route, 200, options.emptyFavorites ? [] : FAVORITES)
    return
  }
  const favorite = path.match(/^\/favorite\/([^/]+)\/([01])$/)
  if (favorite && method === 'POST') {
    state.favoritesPosted.push(`${favorite[1]}/${favorite[2]}`)
    const offer = OFFER_BY_ID[favorite[1]]
    const base = offer ?? REGULAR_OFFER
    await json(route, favorite[2] === '1' ? 201 : 200, {
      ...base,
      isFavorite: favorite[2] === '1',
    })
    return
  }
  const comments = path.match(/^\/comments\/([^/]+)$/)
  if (comments && method === 'GET') {
    await json(route, 200, options.emptyReviews ? [] : REVIEWS)
    return
  }
  if (comments && method === 'POST') {
    state.reviewsPosted.push(
      (route.request().postDataJSON() ?? {}) as {
        comment?: string
        rating?: number
      },
    )
    if (options.reviewDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.reviewDelayMs))
    }
    await json(route, options.reviewFails ? 500 : 201, NEW_REVIEW)
    return
  }
  const nearby = path.match(/^\/offers\/([^/]+)\/nearby$/)
  if (nearby && method === 'GET') {
    if (!OFFER_BY_ID[nearby[1]]) {
      await route.fulfill({ status: 404 })
      return
    }
    await json(route, 200, NEARBY)
    return
  }
  const offer = path.match(/^\/offers\/([^/]+)$/)
  if (offer && method === 'GET') {
    const found = OFFER_BY_ID[offer[1]]
    if (!found) {
      await route.fulfill({ status: 404 })
      return
    }
    await json(route, 200, found)
    return
  }
  if (path === '/login' && method === 'GET') {
    state.loginRequested += 1
    await route.fulfill({
      status: state.authenticated ? 200 : 401,
      ...(state.authenticated
        ? { contentType: 'application/json', body: JSON.stringify(USER) }
        : {}),
    })
    return
  }
  if (path === '/login' && method === 'POST') {
    state.loginRequested += 1
    state.loginPosted += 1
    state.loginBody = route.request().postDataJSON()
    if (options.loginFails) {
      await route.fulfill({ status: 500 })
      return
    }
    state.authenticated = true
    await json(route, 201, USER)
    return
  }
  if (path === '/logout' && method === 'DELETE') {
    state.logoutRequested += 1
    state.authenticated = false
    await route.fulfill({ status: 204 })
    return
  }
  await route.fulfill({ status: 404 })
}

export async function installAuth(page: Page, auth: boolean): Promise<void> {
  await page.addInitScript(
    ([key, enabled]) => {
      if (enabled) {
        window.localStorage.setItem(key, 'token')
      } else {
        window.localStorage.removeItem(key)
      }
    },
    [TOKEN_KEY, auth] as const,
  )
}

export async function mockApi(
  page: Page,
  options: ApiOptions = {},
): Promise<ApiState> {
  const state: ApiState = {
    favoritesRequested: 0,
    favoritesPosted: [],
    loginRequested: 0,
    loginPosted: 0,
    loginBody: null,
    logoutRequested: 0,
    reviewsPosted: [],
    authenticated: options.auth === true,
  }
  await installAuth(page, options.auth === true)
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname.endsWith('design.htmlacademy.pro')) {
      await handleApi(route, url, options, state)
      return
    }
    const server = process.env.AUTO_REVIEW_BASE_URL
    const serverHost = server ? new URL(server).hostname : 'localhost'
    const local =
      url.hostname === serverHost ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
    if (local) {
      if (IMAGE_RE.test(url.pathname)) {
        await route.abort()
        return
      }
      await route.continue()
      return
    }
    await route.abort()
  })
  return state
}
