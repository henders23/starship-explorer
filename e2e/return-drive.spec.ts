import { expect, test } from '@playwright/test'
import { runReturnVoyage } from '../tools/exploration-walkthrough.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { openProject } from './helpers.js'

function envelope(state: Campaign) {
  let result = ''
  saveExploration(state, { getItem: () => null, removeItem: () => {}, setItem: (_, value) => { result = value } })
  return result
}

test('field test → final research → construction → continue exploring → return home', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const run = runReturnVoyage('browser-return-drive')
  await page.addInitScript(({ key, raw }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw)
  }, { key: EXPLORATION_SAVE_KEY, raw: envelope(run.beforeTest) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  await page.getByRole('button', { name: 'Begin prototype field test', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Prototype field test' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('prototype-test.png'), fullPage: true })
  // The event survives reloading, rather than depending on a transient UI flag.
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await page.getByRole('button', { name: 'Map with remote probes · 2 days · no damage' }).click()
  await expect(page.getByRole('dialog', { name: 'Prototype field test' })).toBeHidden()
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  await (await openProject(page, 'Drive Stabilisation')).getByRole('button', { name: 'Begin research', exact: true }).click()
  await page.getByRole('button', { name: /Current system/ }).click()
  await page.getByTestId('location-station').first().click()
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Survey contract · 3 days · earn 8 materials + 18 credits' }).click()
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  await page.getByRole('button', { name: 'Construct Return Drive · 60 materials + 150 credits' }).click()
  await expect(page.getByRole('button', { name: 'Return home', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Return home', exact: true }).click()
  await page.getByRole('button', { name: 'Keep exploring', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Return home confirmation' })).toBeHidden()
  await page.getByRole('button', { name: /Fabrication & fitting/ }).click()
  await page.screenshot({ path: testInfo.outputPath('return-drive-workshop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Return home', exact: true }).click()
  await page.getByRole('button', { name: 'Activate Return Drive', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'A familiar sky.', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('home-ending.png'), fullPage: true })
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Voyage complete' })).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile research explains locks and queues a dependent project', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Begin expedition' }).click()
  await page.getByRole('button', { name: 'Skip briefing' }).click()
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  const diagnostics = await openProject(page, 'Drive Diagnostics')
  await diagnostics.getByRole('button', { name: 'Begin research', exact: true }).click()
  const exotic = await openProject(page, 'Exotic Energy Storage')
  await expect(exotic).toContainText('Requires Drive Diagnostics')
  await exotic.getByRole('button', { name: 'Add to queue', exact: true }).click()
  // Queued projects are numbered in the project list.
  await expect(page.getByRole('complementary', { name: 'Research projects' }).getByRole('button', { name: /^Exotic Energy Storage/ })).toContainText('Queued · 1')
  await expect(await openProject(page, 'Personal Shield Emitters')).toContainText('Requires Composite Hull')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.locator('.exp-deck').evaluate((element) => { element.scrollTop = 0 })
  await page.screenshot({ path: testInfo.outputPath('research-mobile.png'), fullPage: true })
})
