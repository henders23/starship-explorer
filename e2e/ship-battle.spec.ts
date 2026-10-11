import { expect, test } from '@playwright/test'
import { escortContact, runEscort } from '../tools/ship-walkthrough.js'
import { SHIP_BY_ID } from '../src/engine/combat/ships.js'
import { contactArtForClass } from '../src/ui/ship-contact-art.js'
import { createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'
function envelope(s: Campaign) { let raw = ''; saveExploration(s, { getItem: () => null, removeItem: () => {}, setItem: (_, v) => { raw = v } }); return raw }

test('station escort contact, negotiation, one-time reward and saved report', async ({ page }, info) => {
  const contact = escortContact('browser-escort')
  let s = createCampaign(contact.seed)
  for (const a of contact.actions.slice(0, -1)) s = reduceCampaign(s, a)
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw) }, { key: EXPLORATION_SAVE_KEY, raw: envelope(s) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await page.getByTestId('location-station').first().click()
  await page.getByRole('button', { name: 'Review escort contact' }).click()
  await expect(page.getByRole('heading', { name: 'A ship across our bow.' })).toBeVisible()
  const ship=SHIP_BY_ID[contact.shipBattle!.classId]!
  const image=page.getByTestId('contact-recon-art')
  await expect(image).toHaveAttribute('src',contactArtForClass(ship.id,ship.sprite))
  expect(await image.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true)
  await page.getByRole('button', { name: 'Hail the contact', exact: true }).click()
  await page.screenshot({ path: info.outputPath('escort-contact.png'), fullPage: true })
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await page.getByRole('button', { name: 'Pay passage · 15 credits', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No shots fired.' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await page.getByRole('button', { name: 'Acknowledge escort report', exact: true }).click()
  await page.getByTestId('location-station').first().click()
  await expect(page.getByRole('button', { name: 'Review escort contact' })).toBeDisabled()
  await expect(page.getByTestId('exp-materials')).toHaveText('26')
})

test('real-time battle pauses, targets rooms, saves and completes a combat escort', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message))
  const run = runEscort('escort-sweep-1')
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw) }, { key: EXPLORATION_SAVE_KEY, raw: envelope(run.nearEnd) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume battle', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Target engines', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Pulse laser', exact: true })).toContainText('Target: engines')
  await page.getByRole('button', { name: 'Repair shields', exact: true }).click()
  await expect(page.locator('.space-reactor')).toContainText('Repair team: shields')
  const arena = (await page.locator('.space-arena').boundingBox())!
  expect(arena.height).toBeGreaterThan(400)
  expect((await page.locator('.space-console').boundingBox())!.x).toBeGreaterThanOrEqual(arena.x + arena.width - 1)
  await page.screenshot({ path: info.outputPath('ship-battle-desktop.png'), fullPage: true })
  // Test the actual clock while weapons are off so the report cannot race the pause button.
  await page.getByRole('article', { name: 'Pulse laser', exact: true }).getByRole('button', { name: 'off', exact: true }).click()
  await page.getByRole('article', { name: 'Hellion missile', exact: true }).getByRole('button', { name: 'off', exact: true }).click()
  await page.getByRole('button', { name: 'Resume battle', exact: true }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Pause battle', exact: true }).click()
  const paused = await page.locator('.space-header small').textContent()
  await page.waitForTimeout(1200)
  await expect(page.locator('.space-header small')).toHaveText(paused!)
  await page.reload()
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume battle', exact: true })).toBeVisible()
  await page.getByRole('article', { name: 'Pulse laser', exact: true }).getByRole('button', { name: 'auto', exact: true }).click()
  await page.getByRole('article', { name: 'Hellion missile', exact: true }).getByRole('button', { name: 'auto', exact: true }).click()
  for (let i = 0; i < 50 && await page.getByRole('button', { name: 'Advance 1 second', exact: true }).isVisible(); i++) await page.getByRole('button', { name: 'Advance 1 second', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'The lane is clear.' })).toBeVisible()
  await page.getByRole('button', { name: 'Acknowledge escort report' }).click()
  expect(errors).toEqual([])
})

test('mobile battle controls and charged retreat', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const battle = runEscort('escort-mobile').battle
  await page.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw) }, { key: EXPLORATION_SAVE_KEY, raw: envelope(battle) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await page.locator('.space-arena').boundingBox())!.height).toBeGreaterThan(600)
  await page.screenshot({ path: info.outputPath('ship-battle-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: '− engines', exact: true }).click()
  await page.getByRole('button', { name: '+ engines', exact: true }).click()
  await page.getByRole('button', { name: 'Charge retreat · engines required', exact: true }).click()
  for (let i = 0; i < 10 && await page.getByRole('button', { name: 'Advance 1 second', exact: true }).isVisible(); i++) await page.getByRole('button', { name: 'Advance 1 second', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'The tender turns back.' })).toBeVisible()
  await page.getByRole('button', { name: 'Acknowledge escort report' }).click()
  await expect(page.getByRole('heading', { name: 'Beyond the familiar' })).toBeVisible()
})
