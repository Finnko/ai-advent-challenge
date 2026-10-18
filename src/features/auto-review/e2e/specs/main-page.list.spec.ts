import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('1.1.1.1 Главная страница. Список предложений', () => {
  test('сортировка списка предложений', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    await expect(page.locator('.places__sorting-type')).toContainText('Popular')
    await expect(page.locator('.places__options')).toBeHidden()
    await expect(
      page.locator('.cities__card:nth-child(1) .place-card__name'),
    ).toContainText('Offer #1')
    await expect(
      page.locator('.cities__card:nth-child(2) .place-card__name'),
    ).toContainText('Offer #2')

    await page.locator('.places__sorting-type').click()
    await expect(page.locator('.places__options')).toBeVisible()
    await page.locator('.places__option:nth-child(2)').click()
    await expect(page.locator('.places__sorting-type')).toContainText(
      'Price: low to high',
    )
    await expect(page.locator('.places__options')).toBeHidden()
    await expect(
      page.locator('.cities__card:nth-child(1) .place-card__name'),
    ).toContainText('Offer #2')

    await page.locator('.places__sorting-type').click()
    await page.locator('.places__option:nth-child(3)').click()
    await expect(page.locator('.places__sorting-type')).toContainText(
      'Price: high to low',
    )
    await expect(
      page.locator('.cities__card:nth-child(1) .place-card__name'),
    ).toContainText('Offer #1')

    await page.locator('.places__sorting-type').click()
    await page.locator('.places__option:nth-child(4)').click()
    await expect(page.locator('.places__sorting-type')).toContainText(
      'Top rated first',
    )
    await expect(
      page.locator('.cities__card:nth-child(1) .place-card__name'),
    ).toContainText('Offer #2')
  })

  test('карточка предложения содержит все данные', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    const first = page.locator('.cities__card:nth-child(1)')
    await expect(first.locator('.place-card__image')).toHaveAttribute(
      'src',
      'https://13.design.pages.academy/static/hotel/10.jpg',
    )
    await expect(first.locator('.place-card__mark')).toHaveCount(0)
    await expect(first.locator('.place-card__price-value')).toContainText('929')
    await expect(first.locator('.place-card__name')).toContainText('Offer #1')
    await expect(first.locator('.place-card__type')).toContainText('House')
    expect(
      await first
        .locator('.place-card__stars span')
        .first()
        .evaluate((node) => (node as HTMLElement).style.width),
    ).toBe('40%')

    const second = page.locator('.cities__card:nth-child(2)')
    await expect(second.locator('.place-card__image')).toHaveAttribute(
      'src',
      'https://13.design.pages.academy/static/hotel/13.jpg',
    )
    await expect(second.locator('.place-card__mark')).toBeVisible()
    await expect(second.locator('.place-card__price-value')).toContainText(
      '137',
    )
    await expect(second.locator('.place-card__name')).toContainText('Offer #2')
    await expect(second.locator('.place-card__type')).toContainText('Room')
    expect(
      await second
        .locator('.place-card__stars span')
        .first()
        .evaluate((node) => (node as HTMLElement).style.width),
    ).toBe('100%')
  })

  test('клик по заголовку открывает страницу предложения', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/')

    await page.locator('.cities__card:nth-child(1) .place-card__name a').click()
    await expect(page).toHaveURL(/\/offer\/regular-offer-paris/)
    await expect(page.locator('.page__main--offer')).toBeVisible()
    await expect(page.locator('.offer__name')).toContainText('Offer #1')

    await page.goto('/')
    await page.locator('.cities__card:nth-child(2) .place-card__name a').click()
    await expect(page).toHaveURL(/\/offer\/premium-offer-paris/)
    await expect(page.locator('.offer__name')).toContainText('Offer #2')
  })

  test('если предложений нет, показывается заглушка и нет карты', async ({
    page,
  }) => {
    await mockApi(page, { auth: false, emptyOffers: true })
    await page.goto('/')

    await expect(page.locator('.cities__no-places')).toBeVisible()
    await expect(page.locator('.place-card')).toHaveCount(0)
    await expect(page.locator('.cities__status')).toContainText(
      /no places to stay available/i,
    )
    await expect(page.locator('.leaflet-container')).toHaveCount(0)

    await page.locator('.locations__item').nth(1).click()
    await expect(page.locator('.cities__no-places')).toBeVisible()
    await expect(page.locator('.place-card')).toHaveCount(0)
  })
})
