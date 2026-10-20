import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, reduceCampaign, travelOrder } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { followCourse } from '../src/engine/exploration/navigation.js'
import { outcomeChips, quietChoice, SIGNAL_BY_ID, SIGNALS, signalAt, signalLuck } from '../src/engine/exploration/signals.js'
import { loadExploration, saveExploration } from '../src/ui/exploration-save.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
/** Flies outward until a signal waits, optionally of a given kind. */
function signalled(prefix: string, id?: string): Campaign {
  for (let i = 0; i < 300; i++) {
    const s = createCampaign(`${prefix}-${i}`)
    const target = [...s.galaxy.systems].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))[0]!
    const result = followCourse(s, target.id)
    if (result.stop === 'signal' && (!id || result.state.signal!.id === id)) return result.state
  }
  throw new Error(`No ${id ?? ''} signal found`)
}

describe('arrival signals', () => {
  it('wait only on a first arrival, block other orders until answered, and replay exactly', () => {
    const s = signalled('signal-a')
    expect(s.visited.filter((id) => id === s.at)).toHaveLength(1)
    expect(SIGNAL_BY_ID[s.signal!.id]).toBeDefined()
    expect(signalAt(s.seed, s.at)!.id).toBe(s.signal!.id)
    expect(actionLock(s, travelOrder(s.galaxy.adjacency[s.at]![0]!))).toBe('Answer the signal first')
    const storage = mem(); saveExploration(s, storage)
    expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
    const choice = SIGNAL_BY_ID[s.signal!.id]!.choices.find((c) => !c.cost)!
    const answered = reduceCampaign(s, { type: 'signal', choiceId: choice.id })
    expect(answered.signal).toBeUndefined()
    saveExploration(answered, storage)
    expect(loadExploration(storage).campaign).toEqual(answered)
  })
  it('never fires on journeys flown with plain travel orders', () => {
    const s = createCampaign('signal-plain')
    const target = [...s.galaxy.systems].sort((a, b) => b.r - a.r)[0]!
    expect(followCourse(s, target.id, false).state.signal).toBeUndefined()
  })
  it('charges costs up front and applies the seeded outcome', () => {
    const s = signalled('signal-trader', 'trader')
    const poor = { ...s, exploration: { ...s.exploration, credits: 5 } }
    expect(actionLock(poor, { type: 'signal', choiceId: 'fuel' })).toMatch(/credits/)
    const bought = reduceCampaign({ ...s, fuel: 10 }, { type: 'signal', choiceId: 'missiles' })
    expect(bought.missiles).toBe(s.missiles + 2); expect(bought.exploration.credits).toBe(s.exploration.credits - 12)
    expect(actionLock(s, { type: 'signal', choiceId: 'nonsense' })).toBe('Unknown response')
  })
  it('springs an ambush when bait is taken, as a rules-2 interception', () => {
    for (let i = 0; i < 40; i++) {
      const s = signalled(`signal-bait-${i}`, 'distress')
      const answer = SIGNAL_BY_ID.distress!.choices[0]!
      if (signalLuck(s.seed, s.signal!, answer)) continue
      const next = reduceCampaign(s, { type: 'signal', choiceId: 'answer' })
      expect(next.shipBattle).toMatchObject({ kind: 'interception', phase: 'contact', rules: 2 })
      return
    }
    throw new Error('No ambush found')
  })
  it('brings a survivor aboard, or takes their fare when the roster is full', () => {
    const s = signalled('signal-pilot', 'pilot')
    const joined = reduceCampaign(s, { type: 'signal', choiceId: 'rescue' })
    expect(joined.roster.length).toBe(s.roster.length + (s.roster.filter((o) => !o.dead).length < 6 ? 1 : 0))
  })
  it('authors every signal with a walk-away choice and an outcome for every risk', () => {
    for (const signal of SIGNALS) {
      expect(quietChoice(signal)).toBeDefined()
      for (const c of signal.choices) if (c.odds !== undefined) expect(c.bad).toBeDefined()
    }
  })
})

describe('signals and interceptions together', () => {
  it('offers an intercepted arrival\'s signal once the battle is debriefed', () => {
    for (let i = 0; i < 300; i++) {
      const s = createCampaign(`signal-after-${i}`)
      const target = [...s.galaxy.systems].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))[0]!
      const r = followCourse(s, target.id)
      if (r.stop !== 'contact' || !r.state.signalAfterBattle) continue
      let t = reduceCampaign(r.state, { type: 'ship-order', order: { type: 'pay' } })
      if (t.shipBattle!.phase !== 'report') { t = reduceCampaign(r.state, { type: 'ship-order', order: { type: 'hail' } }); t = reduceCampaign(t, { type: 'ship-order', order: { type: 'pay' } }) }
      t = reduceCampaign(t, { type: 'ship-debrief' })
      expect(t.signal).toEqual(r.state.signalAfterBattle); expect(t.signalAfterBattle).toBeUndefined()
      return
    }
    throw new Error('No intercepted signal found')
  })
  it('summarises outcomes as chips, net of costs', () => {
    expect(outcomeChips({ text: '', fuel: 3, hull: -6 })).toEqual(['+3 fuel', '−6 hull'])
    expect(outcomeChips({ text: '', missiles: 2 }, { credits: 12 })).toEqual(['−12 credits', '+2 missiles'])
    expect(outcomeChips({ text: '', ambush: true })).toEqual(['ambush'])
  })
})
