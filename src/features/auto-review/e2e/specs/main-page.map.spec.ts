import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

const BLUE = '.map img[src$="pin.svg"]'
const ORANGE = '.map img[src$="pin-active.svg"]'

test.describe('1.1.1.2 Главная страница. Карта', () => {
  test('предложения отображаются маркерами по городам', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(page.locator(BLUE)).toHaveCount(2)

    await page.locator('.locations__item').nth(1).click()
    await expect(page.locator(BLUE)).toHaveCount(1)

    await page.locator('.locations__item').nth(2).click()
    await expect(page.locator('.leaflet-container')).toHaveCount(0)
    await expect(page.locator(BLUE)).toHaveCount(0)
  })

  test('наведение на карточку делает маркер оранжевым', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    await expect(page.locator(ORANGE)).toHaveCount(0)

    const firstCard = page.locator('.cities__card:nth-child(1)')
    await firstCard.hover()
    await expect(page.locator(ORANGE)).toHaveCount(1)
    const first = await page.locator(ORANGE).first().boundingBox()

    await page.mouse.move(2, 2)
    await expect(page.locator(ORANGE)).toHaveCount(0)
    await expect(page.locator(BLUE)).toHaveCount(2)

    const secondCard = page.locator('.cities__card:nth-child(2)')
    await secondCard.hover()
    await expect(page.locator(ORANGE)).toHaveCount(1)
    const second = await page.locator(ORANGE).first().boundingBox()

    expect(
      first && second && (first.x !== second.x || first.y !== second.y),
    ).toBe(true)
  })
})
