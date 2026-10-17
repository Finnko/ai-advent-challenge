import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('1.1.1 Главная страница', () => {
  test('список городов, активный город и переключение', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    await expect(page.locator('.locations__list')).toContainText('Paris')
    await expect(page.locator('.locations__list')).toContainText('Cologne')
    await expect(page.locator('.locations__list')).toContainText('Brussels')
    await expect(page.locator('.locations__list')).toContainText('Amsterdam')
    await expect(page.locator('.locations__list')).toContainText('Hamburg')
    await expect(page.locator('.locations__list')).toContainText('Dusseldorf')

    await expect(page.locator('.tabs__item--active')).toContainText('Paris')
    await expect(page.locator('.places__found')).toContainText(
      /2 places to stay in Paris/i,
    )
    await expect(page.locator('.place-card')).toHaveCount(2)
    await expect(page.locator('.leaflet-container')).toBeVisible()

    await page.locator('.locations__item').nth(1).click()
    await expect(page.locator('.tabs__item--active')).toContainText('Cologne')
    await expect(page.locator('.places__found')).toContainText(
      /1 place to stay in Cologne/i,
    )
    await expect(page.locator('.place-card')).toHaveCount(1)
  })

  test('избранное для неавторизованного ведёт на Login', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    await page
      .locator('.cities__card:nth-child(1) .place-card__bookmark-button')
      .click()
    await expect(page.locator('.page--login')).toBeVisible()
  })

  test('избранное для авторизованного переключается', async ({ page }) => {
    const state = await mockApi(page, { auth: true })
    await page.goto('/')

    const bookmark = page.locator(
      '.cities__card:nth-child(1) .place-card__bookmark-button',
    )
    await expect(bookmark).not.toHaveClass(
      /place-card__bookmark-button--active/,
    )
    await bookmark.click()
    await expect(bookmark).toHaveClass(/place-card__bookmark-button--active/)
    await bookmark.click()
    await expect(bookmark).not.toHaveClass(
      /place-card__bookmark-button--active/,
    )
    expect(state.favoritesPosted).toContain('regular-offer-paris/1')
    expect(state.favoritesPosted).toContain('regular-offer-paris/0')
  })

  test('избранное сохраняется при переключении города', async ({ page }) => {
    await mockApi(page, { auth: true })
    await page.goto('/')

    const bookmark = page.locator(
      '.cities__card:nth-child(1) .place-card__bookmark-button',
    )
    await bookmark.click()
    await expect(bookmark).toHaveClass(/place-card__bookmark-button--active/)

    await page.locator('.locations__item').nth(1).click()
    await page.locator('.locations__item').nth(0).click()
    await expect(bookmark).toHaveClass(/place-card__bookmark-button--active/)
  })
})
