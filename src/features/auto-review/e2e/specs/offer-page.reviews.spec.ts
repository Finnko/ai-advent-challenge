import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('1.1.2.1 Страница предложения. Отзывы', () => {
  test('список отзывов: не больше 10, новые сверху', async ({ page }) => {
    await mockApi(page, { auth: false })
    await page.goto('/offer/regular-offer-paris')

    await expect(page.locator('.reviews__amount')).toContainText('12')
    await expect(page.locator('.reviews__item')).toHaveCount(10)
    await expect(
      page.locator('.reviews__item:nth-child(1) .reviews__text'),
    ).toContainText('Comment #7')
    await expect(
      page.locator('.reviews__item:nth-child(10) .reviews__text'),
    ).toContainText('Comment #3')
  })

  test('карточка отзыва содержит автора, оценку, дату и текст', async ({
    page,
  }) => {
    await mockApi(page, { auth: false })
    await page.goto('/offer/regular-offer-paris')

    const second = page.locator('.reviews__item:nth-child(2)')
    await expect(second.locator('.reviews__avatar')).toHaveAttribute(
      'src',
      'https://13.design.pages.academy/static/avatar/3.jpg',
    )
    await expect(second.locator('.reviews__user-name')).toContainText('Isaac')
    expect(
      await second
        .locator('.reviews__stars span')
        .first()
        .evaluate((node) => (node as HTMLElement).style.width),
    ).toBe('80%')
    await expect(second.locator('.reviews__time')).toContainText('October 2023')
    await expect(second.locator('.reviews__text')).toContainText('Comment #9')
  })
})
