import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('1.1 Страницы приложения', () => {
  test('публичные страницы для неавторизованного пользователя', async ({
    page,
  }) => {
    await mockApi(page, { auth: false })

    await page.goto('/')
    await expect(page.locator('.page--main')).toBeVisible()
    await expect(page.locator('.page__main--index')).toBeVisible()
    await expect(page.locator('.page--login')).toHaveCount(0)
    await expect(page.locator('.page__main--login')).toHaveCount(0)
    await expect(page.locator('.page__main--favorites')).toHaveCount(0)
    await expect(page.locator('.page__main--offer')).toHaveCount(0)

    await page.goto('/offer/regular-offer-paris')
    await expect(page.locator('.page__main--offer')).toBeVisible()
    await expect(page.locator('.page--main')).toHaveCount(0)
    await expect(page.locator('.page__main--index')).toHaveCount(0)
    await expect(page.locator('.page__main--favorites')).toHaveCount(0)
  })

  test('приватные страницы перенаправляют неавторизованного на Login', async ({
    page,
  }) => {
    await mockApi(page, { auth: false })

    await page.goto('/login')
    await expect(page.locator('.page--login')).toBeVisible()
    await expect(page.locator('.page__main--login')).toBeVisible()
    await expect(page.locator('.page__main--index')).toHaveCount(0)

    await page.goto('/favorites')
    await expect(page.locator('.page--login')).toBeVisible()
    await expect(page.locator('.page__main--login')).toBeVisible()
    await expect(page.locator('.page__main--favorites')).toHaveCount(0)
  })

  test('авторизованного перенаправляет с Login и пускает в Favorites', async ({
    page,
  }) => {
    await mockApi(page, { auth: true })

    await page.goto('/login')
    await expect(page.locator('.page__main--index')).toBeVisible()
    await expect(page.locator('.page--login')).toHaveCount(0)

    await page.goto('/favorites')
    await expect(page.locator('.page__main--favorites')).toBeVisible()
    await expect(page.locator('.page__main--index')).toHaveCount(0)
  })

  test('в шапке есть ссылка на Login для неавторизованного', async ({
    page,
  }) => {
    await mockApi(page, { auth: false })

    await page.goto('/')
    await expect(page.locator('.header__nav-link--profile')).toContainText(
      /sign in/i,
    )
    await page.locator('.header__nav-link--profile').click()
    await expect(page.locator('.page--login')).toBeVisible()

    await page.goto('/offer/regular-offer-paris')
    await expect(page.locator('.header__nav-link--profile')).toContainText(
      /sign in/i,
    )
    await page.locator('.header__nav-link--profile').click()
    await expect(page.locator('.page--login')).toBeVisible()
  })

  test('в шапке email и кнопка Sign out для авторизованного', async ({
    page,
  }) => {
    await mockApi(page, { auth: true })

    await page.goto('/')
    await expect(page.locator('.header__user-name')).toContainText(
      'test-user@htmlacademy.ru',
    )
    await expect(page.locator('.header__signout')).toContainText(/sign out/i)

    await page.goto('/offer/regular-offer-paris')
    await expect(page.locator('.header__user-name')).toContainText(
      'test-user@htmlacademy.ru',
    )

    await page.goto('/favorites')
    await expect(page.locator('.header__user-name')).toContainText(
      'test-user@htmlacademy.ru',
    )
  })

  test('клик по email открывает Favorites', async ({ page }) => {
    await mockApi(page, { auth: true })

    await page.goto('/')
    await page.locator('.header__user-name').click()
    await expect(page.locator('.page__main--favorites')).toBeVisible()

    await page.goto('/offer/regular-offer-paris')
    await page.locator('.header__user-name').click()
    await expect(page.locator('.page__main--favorites')).toBeVisible()
  })

  test('выход из аккаунта завершает сеанс', async ({ page }) => {
    const state = await mockApi(page, { auth: true })

    await page.goto('/')
    await page.locator('.header__signout').click()
    await expect(page.locator('.header__nav-link--profile')).toContainText(
      /sign in/i,
    )
    await expect(page.locator('.header__user-name')).toHaveCount(0)
    expect(state.logoutRequested).toBeGreaterThan(0)
  })

  test('несуществующая страница и предложение дают 404', async ({ page }) => {
    await mockApi(page, { auth: false })

    await page.goto('/this-page-does-not-exist')
    await expect(page.locator('body')).toContainText('404')
    await expect(page.locator('body a[href="/"]').first()).toBeVisible()

    await page.goto('/offer/unknown-offer')
    await expect(page.locator('body')).toContainText('404')
  })
})
