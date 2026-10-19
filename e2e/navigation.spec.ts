import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createCampaign } from '../src/engine/exploration/campaign.js'
import { courseFinder } from '../src/engine/exploration/navigation.js'
import { chartTo, openProject } from './helpers.js'

const SEED = 'navigation-e2e'
/** A distant system the starting tank can reach in one go. */
function destination(minJumps: number) {
  const s = createCampaign(SEED), find = courseFinder(s)
  const options = s.galaxy.systems.map((system) => ({ system, course: find(system.id)! }))
    .filter(({ course }) => course.path.length - 1 >= minJumps && course.fuel <= s.fuel)
    .sort((a, b) => a.course.path.length - b.course.path.length || a.system.id.localeCompare(b.system.id))
  const { system, course } = options[0]!
  return { name: system.name, jumps: course.path.length - 1, fuel: course.fuel, firstHop: s.galaxy.systems.find((x) => x.id === course.path[1])!.name }
}
async function begin(page: Page) {
  await page.goto('/')
  await page.getByRole('textbox').fill(SEED)
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click()
  await page.getByRole('button', { name: 'Skip briefing' }).click()
}
const chart = chartTo

test('flies a whole multi-jump route in one order', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message))
  const target = destination(5)
  await begin(page)
  await chart(page, target.name)
  await expect(page.getByText(`${target.jumps} JUMPS · ${target.fuel} FUEL`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Travel the route · ${target.jumps} jumps · ${target.fuel} fuel` }).click()
  await expect(page.getByTestId('exp-day')).toHaveText(String(target.jumps))
  await expect(page.getByRole('heading', { name: target.name, exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Plotted course' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('travels in stages from the course card and pauses when research completes', async ({ page }) => {
  const target = destination(6)
  await begin(page)
  await page.getByRole('button', { name: /Research lab/ }).click()
  await (await openProject(page, 'Drive Diagnostics')).getByRole('button', { name: 'Begin research', exact: true }).click()
  await chart(page, target.name)
  await page.getByRole('button', { name: new RegExp(`^Next jump only · ${target.firstHop}`) }).click()
  const card = page.getByRole('region', { name: 'Plotted course' })
  await expect(card).toContainText(target.name)
  await expect(card).toContainText(`${target.jumps - 1} jumps left`)
  await card.getByRole('button', { name: /^Continue the route/ }).click()
  // Drive Diagnostics takes four days: the course pauses on day four with three jumps flown.
  await expect(page.getByTestId('exp-day')).toHaveText('4')
  await expect(page.locator('.exp-log')).toContainText('Research complete: Drive Diagnostics')
  await expect(card).toContainText(`${target.jumps - 4} jumps left`)
  // An idle laboratory is flagged on its tab; automatic research is switched on inside.
  await expect(page.getByRole('button', { name: /Research lab/ })).toContainText('idle')
  await page.getByRole('button', { name: /Research lab/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Laboratory idle' })).toBeVisible()
  await page.getByRole('checkbox', { name: /Continue the route home automatically/ }).check()
  await expect(page.getByRole('status').filter({ hasText: 'Automatic research starts Exotic Energy Storage' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /Continue the route home automatically/ })).toBeChecked()
  const leads = page.locator('.exp-science-leads').first()
  await expect(leads.locator('.exp-lead small').first()).toHaveText(/^(In this system|\d+ jumps? · \d+ fuel)$/)
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await page.getByRole('button', { name: /Research lab/ }).click()
  await expect(page.getByRole('checkbox', { name: /Continue the route home automatically/ })).toBeChecked()
})

test('route controls fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  const target = destination(5)
  await begin(page)
  await chart(page, target.name)
  await expect(page.getByRole('button', { name: /^Travel the route/ })).toBeVisible()
  await page.getByRole('button', { name: /^Next jump only/ }).click()
  await expect(page.getByRole('region', { name: 'Plotted course' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
