import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('1.1.4 Favorites', () => {
  test('избранные предложения сгруппированы по городам', async ({ page }) => {
    await mockApi(page, { auth: true })
    await page.goto('/favorites')

    await expect(page.locator('.place-card')).toHaveCount(3)
    await expect(page.locator('.favorites__locations-items')).toHaveCount(2)
  })

  test('удаление из избранного обновляет список', async ({ page }) => {
    await mockApi(page, { auth: true })
    await page.goto('/favorites')

    const firstBookmark = page.locator(
      '.favorites__locations-items:nth-child(1) .place-card:nth-child(1) .place-card__bookmark-button',
    )
    await firstBookmark.click()
    await expect(page.locator('.place-card')).toHaveCount(2)
    await firstBookmark.click()
    await expect(page.locator('.place-card')).toHaveCount(1)
    await firstBookmark.click()
    await expect(page.locator('.place-card')).toHaveCount(0)
  })

  test('в шапке показывается количество избранного', async ({ page }) => {
    await mockApi(page, { auth: true })
    await page.goto('/favorites')

    await expect(page.locator('.header__favorite-count')).toContainText('3')
    await page
      .locator(
        '.favorites__locations-items:nth-child(1) .place-card:nth-child(1) .place-card__bookmark-button',
      )
      .click()
    await expect(page.locator('.header__favorite-count')).toContainText('2')
  })

  test('пустое избранное показывает заглушку', async ({ page }) => {
    await mockApi(page, { auth: true, emptyFavorites: true })
    await page.goto('/favorites')

    await expect(page.locator('.favorites__status')).toContainText(
      /nothing yet saved/i,
    )
    await expect(page.locator('.favorites__list')).toHaveCount(0)
  })
})
