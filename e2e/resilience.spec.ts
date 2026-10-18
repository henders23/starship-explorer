import { expect, test } from '@playwright/test'

test('plays without browser storage and warns before discarding the unsaved voyage', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError') } })
  })
  await page.goto('/')
  await expect(page.getByRole('status').filter({ hasText: 'storage is blocked' })).toBeVisible()
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Autosave unavailable' })).toBeVisible()
  page.once('dialog', (dialog) => { expect(dialog.message()).toContain('could not be autosaved'); void dialog.dismiss() })
  await page.getByRole('button', { name: 'Title screen', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Exploration stations' })).toBeVisible()
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Title screen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Begin expedition', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('Escape closes expedition dialogs and returns focus to the control that opened them', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click()
  const opener = page.getByRole('button', { name: 'Away team', exact: true })
  await opener.click()
  await expect(page.getByRole('dialog', { name: 'Away team', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Away team', exact: true })).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('one sound switch mutes the music and is remembered', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.Audio
    const made: HTMLAudioElement[] = []
    ;(window as unknown as { __audio: HTMLAudioElement[] }).__audio = made
    window.Audio = function (src?: string) { const audio = new Original(src); made.push(audio); return audio } as unknown as typeof Audio
  })
  await page.goto('/')
  // Development mode mounts twice and discards the first player; the newest is the live theme.
  const themeMuted = () => page.evaluate(() => (window as unknown as { __audio: HTMLAudioElement[] }).__audio.at(-1)!.muted)
  expect(await themeMuted()).toBe(false)
  await page.getByRole('button', { name: 'Mute sound' }).click()
  expect(await themeMuted()).toBe(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible()
  expect(await themeMuted()).toBe(true)
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click()
  await page.getByRole('button', { name: 'Unmute sound' }).click()
  expect(await themeMuted()).toBe(false)
  await page.setViewportSize({ width: 320, height: 720 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('a corrupt expedition save is preserved and the player can begin a fresh voyage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('starship-explorer-exploration-v2', 'not valid JSON'))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('could not be read')
  page.once('dialog', dialog => void dialog.accept())
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Exploration stations' })).toBeVisible()
})

test('serves a favicon', async ({ page }) => {
  await page.goto('/')
  const href = await page.locator('link[rel=icon]').getAttribute('href')
  expect((await page.request.get(href!)).status()).toBe(200)
})
