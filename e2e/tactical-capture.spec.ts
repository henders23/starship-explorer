import { expect, test } from '@playwright/test'
import { deployBoarding } from '../tools/tactical-walkthrough.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'

/** These are screenshots of the running game, NOT generated concept art. */
for (const width of [1440, 390]) test(`capture live boarding combat at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = deployBoarding('cinematic-comparison')
  let raw = ''
  saveExploration(state, { getItem: () => null, removeItem: () => {}, setItem: (_, value) => { raw = value } })
  await page.addInitScript(({ key, saved }) => localStorage.setItem(key, saved), { key: EXPLORATION_SAVE_KEY, saved: raw })
  await page.goto('/')
  await page.getByRole('button', { name: 'Resume expedition' }).click()
  await expect(page.getByRole('region', { name: 'Tactical map' })).toBeVisible()
  await page.getByRole('button', { name: 'Tile 3,4', exact: true }).click()
  await page.getByRole('button', { name: 'Target Custodian 1', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Last order' })).toContainText(/Shot hit|Shot missed/)
  // The game scrolls its own deck. Capture the tactical viewport, not the
  // order inspector simply because Playwright scrolled to the Fire button.
  await page.evaluate(() => {
    document.scrollingElement?.scrollTo(0,0)
    const deck=document.querySelector<HTMLElement>('.tactical-deck')
    if(deck)deck.scrollTop=0
  })
  await page.screenshot({ path: info.outputPath(`mid-mission-${width}.png`), fullPage: true, animations: 'disabled' })
  await expect(page.getByRole('navigation',{name:'Tactical quick actions'})).toBeVisible()
  await page.locator('.tac-quickbar').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`mid-mission-controls-${width}.png`), animations:'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
