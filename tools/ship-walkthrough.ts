import { BATTLE_RULES } from '../src/engine/exploration/ship-battle.js'
import type { BattleRules } from '../src/engine/exploration/ship-battle.js'
import { createCampaign, reduceCampaign, actionLock } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
export function shipApply(s: Campaign, a: CampaignAction) {
  const lock = actionLock(s, a)
  if (lock) throw new Error(`${JSON.stringify(a)}: ${lock}`)
  return reduceCampaign(s, a)
}
export function escortContact(seed: string, rules: BattleRules = BATTLE_RULES): Campaign {
  let s = createCampaign(seed)
  const site = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
  s = shipApply(s, { type: 'investigate', locationId: site.id })
  return shipApply(s, { type: 'escort', locationId: site.id, ...(rules === 2 ? { rules } : {}) })
}
export function runEscort(seed: string, rules: BattleRules = BATTLE_RULES) {
  const contact = escortContact(seed, rules)
  let s = shipApply(contact, { type: 'ship-order', order: { type: 'engage' } })
  s = shipApply(s, { type: 'ship-order', order: { type: 'weapon', index: 1, mode: 'auto' } })
  s = shipApply(s, { type: 'ship-order', order: { type: 'power', system: 'engines', amount: 3 } })
  const battle = s
  let nearEnd = s
  for (let i = 0; i < 120 && s.shipBattle!.phase === 'battle'; i++) {
    nearEnd = s
    s = shipApply(s, { type: 'ship-order', order: { type: 'advance', seconds: 5 } })
  }
  if (s.shipBattle!.phase !== 'report') throw new Error('Escort stalled')
  return { contact, battle, nearEnd, report: s, final: shipApply(s, { type: 'ship-debrief' }) }
}
if (process.argv[1]?.endsWith('ship-walkthrough.ts')) for (let i = 0; i < Number(process.argv[2] ?? 20); i++) {
  const r = runEscort(`escort-sweep-${i}`)
  console.log(JSON.stringify({ seed: i, class: r.report.shipBattle!.classId, result: r.report.shipBattle!.result, time: r.report.shipBattle!.time, hull: r.final.hull }))
}
