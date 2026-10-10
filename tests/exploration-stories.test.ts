import { describe, it, expect } from 'vitest'
import { createCampaign, reduceCampaign, actionLock, fuelCapacity } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { storyAt } from '../src/engine/exploration/stories.js'
import { EXPLORATION_SAVE_KEY, loadExploration, saveExploration } from '../src/ui/exploration-save.js'
const apply = (s: Campaign, a: CampaignAction) => { expect(actionLock(s, a)).toBeNull(); return reduceCampaign(s, a) }
function courier(seed = 'stories') {
  let s = apply(createCampaign(seed), { type: 'scan', tier: 'survey' })
  const site = s.world.locations.find((l) => l.name === 'The Silent Courier')!
  s = apply(s, { type: 'investigate', locationId: site.id })
  return { s, site }
}
function roundtrip(s: Campaign, version = 5) {
  let raw = ''
  const storage = { removeItem: () => {}, getItem: () => raw, setItem: (_key: string, value: string) => { raw = value } }
  saveExploration(s, storage)
  raw = JSON.stringify({ ...JSON.parse(raw), version })
  return loadExploration(storage)
}
describe('authored expedition encounters', () => {
  it('keeps cargo, decisions and replay independent, including choices after recovery', () => {
    let { s, site } = courier()
    s = apply(s, { type: 'recover', locationId: site.id, approach: 'careful' })
    const materials = s.exploration.materials, findings = s.findings
    s = apply(s, { type: 'story', locationId: site.id, choiceId: 'carry' })
    expect(s.exploration.materials).toBe(materials); expect(s.findings).toEqual(findings)
    expect(s.stories).toHaveLength(1)
    expect(reduceCampaign(s, { type: 'story', locationId: site.id, choiceId: 'beacon' })).toBe(s)
    expect(roundtrip(s).campaign).toEqual(s)
    expect(roundtrip(s, 4).campaign).toBeNull()
  })
  it('migrates version-4 journals with unchanged gameplay state', () => {
    let { s, site } = courier('old-voyage')
    s = apply(s, { type: 'recover', locationId: site.id, approach: 'rapid' })
    expect(roundtrip(s, 4).campaign).toEqual(s)
  })
  it('rejects unknown, unseen, remote, duplicate and unaffordable decisions without mutation', () => {
    const { s, site } = courier()
    const choose: CampaignAction = { type: 'story', locationId: site.id, choiceId: 'beacon' }
    for (const bad of [createCampaign('stories'), { ...s, at: s.galaxy.adjacency[s.at]![0]! }, { ...s, exploration: { ...s.exploration, materials: 2 } }, { ...s, outcome: 'home' as const }, { ...s, driveTest: 'calibrating' as const }]) expect(reduceCampaign(bad, choose)).toBe(bad)
    expect(reduceCampaign(s, { ...choose, choiceId: '__proto__' })).toBe(s)
    const frozen = JSON.stringify(s)
    apply(s, choose)
    expect(JSON.stringify(s)).toBe(frozen)
  })
  it('requires another contacted system and pays the letter commission only once', () => {
    let { s, site } = courier()
    s = apply(s, { type: 'story', locationId: site.id, choiceId: 'carry' })
    const home = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = apply(s, { type: 'investigate', locationId: home.id })
    expect(actionLock(s, { type: 'deliver-letters', locationId: home.id })).toContain('another system')
    // Walk a real connected route to the nearest off-system station.
    const queue: string[][] = [[s.at]], seen = new Set([s.at]); let route: string[] = []
    while (queue.length) {
      const path = queue.shift()!, at = path.at(-1)!
      if (at !== s.at && s.world.locations.some((l) => l.systemId === at && l.kind === 'station')) { route = path.slice(1); break }
      for (const id of s.galaxy.adjacency[at]!) if (!seen.has(id)) { seen.add(id); queue.push([...path, id]) }
    }
    expect(route.length).toBeGreaterThan(0)
    for (const systemId of route) {
      if (actionLock(s, { type: 'travel', systemId })) s = apply(s, { type: 'emergency-fuel' })
      s = apply(s, { type: 'travel', systemId })
    }
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    expect(reduceCampaign(s, { type: 'deliver-letters', locationId: station.id })).toBe(s)
    s = apply(s, { type: 'investigate', locationId: station.id })
    const credits = s.exploration.credits, day = s.day
    s = apply(s, { type: 'deliver-letters', locationId: station.id })
    expect(s.exploration.credits).toBe(credits + 25); expect(s.day).toBe(day + 1)
    expect(s.lettersDelivered).toBe(true)
    expect(reduceCampaign(s, { type: 'deliver-letters', locationId: station.id })).toBe(s)
    expect(roundtrip(s).campaign).toEqual(s)
  })
  it('all choices across 30 galaxies conserve resources, advance research and reject repeat rewards', () => {
    const encountered = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const base = createCampaign(`adversarial-stories-${i}`)
      for (const site of base.world.locations) {
        const story = storyAt(base.seed, site)
        if (!story) continue
        encountered.add(story.id)
        expect(storyAt(base.seed, site)).toEqual(story)
        for (const choice of story.choices) {
          const s: Campaign = { ...base, at: site.systemId, research: { ...base.research, active: 'drive-diagnostics' }, exploration: { ...base.exploration, statuses: { [site.id]: 'investigated' } } }
          const action: CampaignAction = { type: 'story', locationId: site.id, choiceId: choice.id }
          const next = apply(s, action)
          expect(next.day).toBe(choice.days)
          expect(next.exploration.materials).toBe(s.exploration.materials + choice.materials)
          expect(next.exploration.credits).toBe(s.exploration.credits + choice.credits)
          expect(next.fuel).toBe(Math.min(fuelCapacity(s), s.fuel + choice.fuel))
          expect(next.research.progress['drive-diagnostics']).toBe(choice.days)
          expect(reduceCampaign(next, action)).toBe(next)
          expect(next.exploration.claimed).toEqual([])
        }
      }
    }
    expect(encountered.size).toBe(10)
  })
  it('does not replace an invalid saved journal', () => {
    const raw = JSON.stringify({ version: 5, ruleset: 'exploration-v2', seed: 'stories', legacyActions: null, actions: [{ type: 'story', locationId: 'bad', choiceId: 'carry' }] })
    const storage = new Map([[EXPLORATION_SAVE_KEY, raw]])
    expect(loadExploration({ removeItem: () => {}, getItem: (key) => storage.get(key) ?? null, setItem: (key, val) => storage.set(key, val) }).error).toBeTruthy()
    expect(storage.get(EXPLORATION_SAVE_KEY)).toBe(raw)
  })
})
