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
  // Identity, weapon and environment must survive first render and narrow layouts.
  await expect(page.locator('img.tac-sq-face')).toHaveCount(4)
  await expect(page.locator('.tac-portrait')).toHaveCSS('background-size','cover')
  await expect(page.locator('.tac-board')).toHaveAttribute('data-environment', /medical|relay|reactor|archive|industrial|freight/)
  await expect(page.locator('.tac-visible-weapon').first()).toBeVisible()
  await expect(page.locator('.tac-scene-architecture')).toHaveCount(0)
  await expect(page.locator('svg.tac-board')).toContainText('LODESTAR / BOARDING FEED')
  await expect(page.getByText('Equipped ·', {exact:false})).toBeVisible()
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

test('inspect a procedural 3D squad figure without modifying a mission', async ({page}) => {
  const state=deployBoarding('3d-figure-inspection')
  let saved=''
  saveExploration(state,{getItem:()=>null,removeItem:()=>{},setItem:(_,value)=>{saved=value}})
  await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:EXPLORATION_SAVE_KEY,value:saved})
  await page.goto('/')
  await page.getByRole('button',{name:'Resume expedition'}).click()
  const orders=page.getByRole('region',{name:'Tactical map'})
  await expect(orders).toBeVisible()
  await page.getByRole('button',{name:'Inspect equipment in 3D'}).click()
  const inspector=page.getByRole('dialog',{name:'3D combat figure inspection'})
  await expect(inspector).toBeVisible()
  await expect(inspector.getByText(/Procedural reference model/)).toBeVisible()
  await inspector.getByRole('button',{name:'Return to mission'}).click()
  await expect(inspector).toHaveCount(0)
  await expect(orders).toBeVisible()
  await expect(page.getByRole('button',{name:'Tile 3,4',exact:true})).toBeVisible()
})
