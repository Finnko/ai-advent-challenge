import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

const LONG_TEXT = 'Lorem ipsum dolor sit amet, consectetur porta ante.'
const FIVE_STARS = '[id="5-stars"]'

test.describe('1.1.2.2 Страница предложения. Форма отзыва', () => {
  test('форма видна только авторизованным', async ({ page }) => {
    await mockApi(page, { auth: true })
    await page.goto('/offer/regular-offer-paris')
    await expect(page.locator('.reviews__form')).toBeVisible()

    await mockApi(page, { auth: false })
    await page.goto('/offer/regular-offer-paris')
    await expect(page.locator('.reviews__form')).toHaveCount(0)
  })

  test('кнопка отправки активна только при оценке и допустимой длине', async ({
    page,
  }) => {
    await mockApi(page, { auth: true })
    await page.goto('/offer/regular-offer-paris')

    const submit = page.locator('.reviews__submit')
    await expect(submit).toBeDisabled()

    await page.locator('[title="perfect"]').click()
    await expect(page.locator(FIVE_STARS)).toBeChecked()
    await expect(submit).toBeDisabled()

    await page.locator('.reviews__textarea').fill('too short')
    await expect(submit).toBeDisabled()

    await page.locator('.reviews__textarea').fill(LONG_TEXT)
    await expect(submit).toBeEnabled()

    await page.locator('.reviews__textarea').fill('a'.repeat(320))
    await expect(submit).toBeDisabled()
  })

  test('данные отзыва уходят в правильном формате', async ({ page }) => {
    const state = await mockApi(page, { auth: true })
    await page.goto('/offer/regular-offer-paris')

    await page.locator('[title="perfect"]').click()
    await page.locator('.reviews__textarea').fill(LONG_TEXT)
    await page.locator('.reviews__submit').click()

    await expect.poll(() => state.reviewsPosted.length).toBeGreaterThan(0)
    expect(state.reviewsPosted[0]).toEqual({ comment: LONG_TEXT, rating: 5 })
  })

  test('во время отправки форма блокируется', async ({ page }) => {
    await mockApi(page, { auth: true, reviewDelayMs: 700 })
    await page.goto('/offer/regular-offer-paris')

    await page.locator('[title="perfect"]').click()
    await page.locator('.reviews__textarea').fill(LONG_TEXT)
    await page.locator('.reviews__submit').click()

    await expect(page.locator('.reviews__submit')).toBeDisabled()
    await expect(page.locator('.reviews__textarea')).toBeDisabled()
    await expect(page.locator('.reviews__textarea')).toBeEnabled({
      timeout: 5000,
    })
  })

  test('успешная отправка очищает форму и добавляет отзыв', async ({
    page,
  }) => {
    await mockApi(page, { auth: true })
    await page.goto('/offer/regular-offer-paris')

    await page.locator('[title="perfect"]').click()
    await page.locator('.reviews__textarea').fill(LONG_TEXT)
    await page.locator('.reviews__submit').click()

    await expect(page.locator('.reviews__amount')).toContainText('13')
    await expect(
      page.locator('.reviews__item:nth-child(1) .reviews__text'),
    ).toContainText('New Comment')
    await expect(page.locator('.reviews__textarea')).toHaveValue('')
    await expect(page.locator('.reviews__submit')).toBeDisabled()
  })

  test('ошибка отправки не очищает форму', async ({ page }) => {
    await mockApi(page, { auth: true, reviewFails: true })
    await page.goto('/offer/regular-offer-paris')

    await page.locator('[title="perfect"]').click()
    await page.locator('.reviews__textarea').fill(LONG_TEXT)
    await page.locator('.reviews__submit').click()

    await expect(page.locator('.reviews__textarea')).toHaveValue(LONG_TEXT)
    await expect(page.locator(FIVE_STARS)).toBeChecked()
    await expect(page.locator('.reviews__submit')).toBeEnabled()
  })

  test('можно оставить несколько отзывов', async ({ page }) => {
    await mockApi(page, { auth: true })
    await page.goto('/offer/regular-offer-paris')

    for (const expected of ['13', '14']) {
      await page.locator('[title="perfect"]').click()
      await page.locator('.reviews__textarea').fill(LONG_TEXT)
      await page.locator('.reviews__submit').click()
      await expect(page.locator('.reviews__amount')).toContainText(expected)
    }
    await expect(page.locator('.reviews__item')).toHaveCount(10)
  })
})
