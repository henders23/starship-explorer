import { expect, test } from '@playwright/test'
import { createCampaign } from '../src/engine/exploration/campaign.js'
import { briefing, chartTo, openProject, travelTo } from './helpers.js'

const SEED = 'exploration-playable'
const start = createCampaign(SEED)
const nameOf = (id: string) => start.galaxy.systems.find((s) => s.id === id)!.name
/** The first neighbour of each system in turn, as the old neighbour list offered it. */
function hops(from: string, count: number) {
  const names: string[] = []
  let at = from
  for (let i = 0; i < count; i++) { at = start.galaxy.adjacency[at]![0]!; names.push(nameOf(at)) }
  return names
}

test('exploration preview: discovery, lab, services, revisit and reload', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('textbox').fill(SEED)
  await page.getByRole('button', { name: 'Begin expedition' }).click()
  await expect(page.getByRole('navigation', { name: 'Exploration stations' })).toBeVisible()
  const startName = await page.locator('.exp-system-hero h2').innerText()
  expect(startName).toBe(nameOf(start.at))
  await page.getByRole('button', { name: 'Research lab', exact: false }).first().click()
  await (await openProject(page, 'Planetary Spectrometry')).getByRole('button', { name: 'Begin research', exact: true }).click()
  await page.getByRole('button', { name: 'Current system', exact: false }).click()
  await page.getByRole('button', { name: 'Survey system · 1 day' }).click()
  await page.getByRole('button', { name: /The Silent Courier/ }).click()
  await page.getByRole('button', { name: 'Investigate · 1 day', exact: true }).click()
  await briefing(page)
  await expect(page.locator('.exp-detail')).toContainText('power cell')
  await page.getByRole('button', { name: 'Remote investigation · 2 days · no damage' }).click()
  await expect(page.getByTestId('exp-materials')).toHaveText('26')
  await expect(page.locator('.exp-log')).toContainText('Research complete: Planetary Spectrometry')
  await page.getByRole('button', { name: /Discoveries/ }).click()
  await expect(page.getByRole('heading', { name: 'Exotic energy', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  await (await openProject(page, 'Deep Survey Array')).getByRole('button', { name: 'Begin research', exact: true }).click()
  await page.getByRole('button', { name: /Current system/ }).click()
  await page.getByTestId('location-station').first().click()
  await page.getByRole('button', { name: 'Establish contact · 1 day' }).click()
  await expect(page.getByRole('heading', { name: 'Station services' })).toBeVisible()
  await travelTo(page, hops(start.at, 1)[0]!)
  await expect(page.getByTestId('exp-day')).toHaveText('6')
  await travelTo(page, startName)
  await page.getByTestId('location-station').first().click()
  await expect(page.getByRole('heading', { name: 'Station services' })).toBeVisible()
  await page.getByRole('button', { name: 'Refuel +20 · 10 credits · 1 day' }).click()
  await expect(page.getByTestId('exp-fuel')).toHaveText('80/80')
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await expect(page.getByTestId('exp-materials')).toHaveText('26')
  await expect(page.getByTestId('exp-day')).toHaveText('8')
  await page.getByRole('button', { name: /The Silent Courier/ }).click()
  await briefing(page)
  await expect(page.locator('.exp-detail')).toContainText('cannot be collected twice')
  // Complete the research/refit loop through real controls, then prove it persists.
  for (const name of hops(start.at, 4)) await travelTo(page, name)
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  const array = await openProject(page, 'Deep Survey Array')
  await expect(array.getByRole('button', { name: 'Install array · 20 materials + 65 credits' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('research-desktop.png'), fullPage: true })
  await array.getByRole('button', { name: 'Install array · 20 materials + 65 credits' }).click()
  await page.getByRole('button', { name: /Current system/ }).click()
  await page.getByRole('button', { name: 'Deep scan · 1 day' }).click()
  await expect(page.getByTestId('exp-materials')).toHaveText('6')
  await expect(page.locator('.exp-log')).toContainText('Deep scan complete')
  await page.screenshot({ path: testInfo.outputPath('exploration-desktop.png'), fullPage: true })
  await chartTo(page, startName)
  await page.screenshot({ path: testInfo.outputPath('galaxy-desktop.png'), fullPage: true })
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await expect(page.getByTestId('exp-day')).toHaveText('14')
  await page.getByRole('button', { name: /Research lab/ }).first().click()
  await expect(await openProject(page, 'Deep Survey Array')).toContainText('Fitted and active')
  expect(errors).toEqual([])
})

test('exploration fits a narrow screen and the title leads with the expedition', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Starship Explorer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Take command' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Begin expedition' }).click()
  await page.getByRole('button', { name: 'Survey system · 1 day' }).click()
  await page.getByRole('button', { name: /The Silent Courier/ }).click()
  await page.getByRole('button', { name: 'Investigate · 1 day', exact: true }).click()
  await briefing(page)
  await expect(page.getByRole('button', { name: 'Remote investigation · 2 days · no damage' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('exploration-mobile.png'), fullPage: true })
})

test('Classic Voyage is retired even when the old URL is requested', async ({ page }) => {
  await page.goto('/?classic')
  await expect(page.getByRole('button', { name: 'Take command' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Begin expedition' })).toBeVisible()
})
