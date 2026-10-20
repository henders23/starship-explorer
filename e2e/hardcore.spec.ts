import { expect, test } from '@playwright/test'
import { createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'
function envelope(s: Campaign) { let raw = ''; saveExploration(s, { getItem: () => null, removeItem: () => {}, setItem: (_, v) => { raw = v } }); return raw }

test('a hardcore voyage is chosen at the title and ends when the ship is lost', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('checkbox', { name: /Hardcore/ }).check()
  await page.getByRole('button', { name: 'Begin expedition', exact: true }).click()
  await page.getByRole('button', { name: 'Skip briefing' }).click()
  await expect(page.locator('.exp-hardcore-mark')).toHaveText('HARDCORE')

  // A hardcore voyage that has just lost its ship in an escort.
  let s = reduceCampaign(createCampaign('hardcore-e2e'), { type: 'hardcore' })
  const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
  s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
  s = reduceCampaign(s, { type: 'escort', locationId: station.id, rules: 2 })
  s = reduceCampaign(s, { type: 'ship-order', order: { type: 'engage' } })
  for (const w of [0, 1]) s = reduceCampaign(s, { type: 'ship-order', order: { type: 'weapon', index: w, mode: 'off' } })
  s = reduceCampaign(s, { type: 'ship-order', order: { type: 'power', system: 'shields', amount: 0 } })
  for (let i = 0; i < 400 && s.shipBattle!.phase === 'battle'; i++) s = reduceCampaign(s, { type: 'ship-order', order: { type: 'advance', seconds: 5 } })
  expect(s.shipBattle!.result).toBe('disabled')
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: EXPLORATION_SAVE_KEY, raw: envelope(s) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Resume expedition', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Main power lost.' })).toBeVisible()
  await page.getByRole('button', { name: 'Final log entry' }).click()
  await expect(page.getByRole('heading', { name: 'The Lodestar is lost.' })).toBeVisible()
  await page.getByRole('button', { name: 'Return to title' }).click()
  await expect(page.getByRole('button', { name: 'Begin expedition', exact: true })).toBeVisible()
})
