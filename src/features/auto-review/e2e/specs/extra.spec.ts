import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('3 Дополнительно', () => {
  test('кнопка перехода к случайному городу на Login', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/login')

    await expect(page.locator('.locations__item-link').first()).toBeVisible()
    const cities = new Set<string>()
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const city = (
        await page.locator('.locations__item-link').first().innerText()
      ).trim()
      cities.add(city)
      await page.locator('.locations__item-link').first().click()
      await expect(page.locator('.page__main--index')).toBeVisible()
      await expect(page.locator('.tabs__item--active')).toContainText(city)
      await page.goto('/login')
    }
    expect(cities.size).toBeGreaterThan(1)
  })
})
