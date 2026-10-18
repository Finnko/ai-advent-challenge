import { expect, test } from '../support/test'
import { mockApi } from '../support/api'

test.describe('1.1.3 Страница Login', () => {
  test('валидация и успешный вход', async ({ page }) => {
    const state = await mockApi(page, { auth: false })
    await page.goto('/login')

    await page.locator('[name="email"]').fill('Lorem')
    await page.locator('[name="password"]').fill('i')
    await page.locator('[name="password"]').press('Enter')
    await expect(page).toHaveURL(/\/login/)
    expect(state.loginPosted).toBe(0)

    await page.locator('[name="email"]').fill('Lorem@test.com')
    await page.locator('[name="password"]').fill('i1')
    await page.locator('[name="password"]').press('Enter')
    await expect(page.locator('.page--main')).toBeVisible()
    expect(state.loginBody).toEqual({
      email: 'Lorem@test.com',
      password: 'i1',
    })
  })

  test('при ошибке формы поля не очищаются', async ({ page }) => {
    await mockApi(page, { auth: false, loginFails: true })
    await page.goto('/login')

    await page.locator('[name="email"]').fill('Lorem@test.com')
    await page.locator('[name="password"]').fill('i1')
    await page.locator('[name="password"]').press('Enter')

    await expect(page.locator('[name="email"]')).toHaveValue('Lorem@test.com')
    await expect(page.locator('[name="password"]')).toHaveValue('i1')
  })
})
