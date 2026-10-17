import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

const HOTEL = 'https://13.design.pages.academy/static/hotel'

test.describe('1.1.2 Страница предложения', () => {
  test('расширенная информация об обычном предложении', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/offer/regular-offer-paris')

    const images = ['10', '8', '16', '4', '5', '20']
    for (const [index, id] of images.entries()) {
      await expect(
        page.locator(
          `.offer__image-wrapper:nth-child(${index + 1}) .offer__image`,
        ),
      ).toHaveAttribute('src', `${HOTEL}/${id}.jpg`)
    }
    await expect(page.locator('.offer__name')).toContainText('Offer #1')
    await expect(page.locator('.offer__description')).toContainText(
      'Regular Paris offer description.',
    )
    await expect(page.locator('.offer__mark')).toHaveCount(0)
    await expect(page.locator('.offer__feature--entire')).toContainText('House')
    await expect(page.locator('.offer__rating-value')).toContainText('2.1')
    expect(
      await page
        .locator('.offer__stars span')
        .first()
        .evaluate((node) => (node as HTMLElement).style.width),
    ).toBe('40%')
    await expect(page.locator('.offer__feature--bedrooms')).toContainText(
      '1 Bedroom',
    )
    await expect(page.locator('.offer__feature--adults')).toContainText(
      'Max 1 adult',
    )
    await expect(page.locator('.offer__price-value')).toContainText('929')
    await expect(page.locator('.offer__inside-item').first()).toContainText(
      'Air conditioning',
    )
    await expect(page.locator('.offer__avatar')).toHaveAttribute(
      'src',
      'https://13.design.pages.academy/static/host/avatar-angelina.jpg',
    )
    await expect(page.locator('.offer__user-name')).toContainText('Angelina')
    await expect(page.locator('.offer__user-status')).toHaveCount(0)
    await expect(page.locator('.offer__avatar-wrapper')).not.toHaveClass(
      /offer__avatar-wrapper--pro/,
    )
  })

  test('расширенная информация о премиальном предложении', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/offer/premium-offer-paris')

    await expect(
      page.locator('.offer__image-wrapper:nth-child(1) .offer__image'),
    ).toHaveAttribute('src', `${HOTEL}/13.jpg`)
    await expect(
      page.locator('.offer__image-wrapper:nth-child(7) .offer__image'),
    ).toHaveCount(0)
    await expect(page.locator('.offer__name')).toContainText('Offer #2')
    await expect(page.locator('.offer__description')).toContainText(
      'Premium Paris offer description.',
    )
    await expect(page.locator('.offer__mark')).toBeVisible()
    await expect(page.locator('.offer__feature--entire')).toContainText('Room')
    await expect(page.locator('.offer__rating-value')).toContainText('4.9')
    expect(
      await page
        .locator('.offer__stars span')
        .first()
        .evaluate((node) => (node as HTMLElement).style.width),
    ).toBe('100%')
    await expect(page.locator('.offer__feature--bedrooms')).toContainText(
      '2 Bedrooms',
    )
    await expect(page.locator('.offer__feature--adults')).toContainText(
      'Max 2 adults',
    )
    await expect(page.locator('.offer__price-value')).toContainText('236')
    await expect(page.locator('.offer__inside-item').nth(1)).toContainText(
      'Fridge',
    )
    await expect(page.locator('.offer__user-status')).toBeVisible()
    await expect(page.locator('.offer__avatar-wrapper')).toHaveClass(
      /offer__avatar-wrapper--pro/,
    )
  })

  test('кнопка избранного: неавторизованный уходит на Login', async ({
    page,
  }) => {
    await mockApi(page, { auth: false })
    await page.goto('/offer/regular-offer-paris')

    await expect(page.locator('.offer__bookmark-button')).not.toHaveClass(
      /offer__bookmark-button--active/,
    )
    await page.locator('.offer__bookmark-button').click()
    await expect(page.locator('.page--login')).toBeVisible()
  })

  test('кнопка избранного: авторизованный переключает', async ({ page }) => {
    const state = await mockApi(page, { auth: true })
    await page.goto('/offer/regular-offer-paris')

    const button = page.locator('.offer__bookmark-button')
    await button.click()
    await expect(button).toHaveClass(/offer__bookmark-button--active/)
    await button.click()
    await expect(button).not.toHaveClass(/offer__bookmark-button--active/)
    expect(state.favoritesPosted.length).toBeGreaterThanOrEqual(2)
  })

  test('предложения неподалёку: карта и карточки', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/offer/regular-offer-paris')

    await expect(page.locator('.near-places__card')).toHaveCount(3)
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(page.locator('.map img[src$="pin.svg"]')).toHaveCount(3)
    await expect(page.locator('.map img[src$="pin-active.svg"]')).toHaveCount(1)

    await page.locator('.near-places__card:nth-child(1)').hover()
    await expect(page.locator('.map img[src$="pin.svg"]')).toHaveCount(3)
    await expect(page.locator('.map img[src$="pin-active.svg"]')).toHaveCount(1)

    await page.mouse.move(2, 2)
    await expect(page.locator('.map img[src$="pin.svg"]')).toHaveCount(3)
    await expect(page.locator('.map img[src$="pin-active.svg"]')).toHaveCount(1)
  })
})
