import { describe, expect, it } from 'vitest'
import { createOperation, initialRoster, pathTo, tileAt, reduceMission, tacticalLock } from '../src/engine/tactical/mission.js'
import { OPERATION_KINDS } from '../src/engine/tactical/operations.js'
import { siteVariant, survivorNames } from '../src/engine/tactical/variants.js'
import type { DeckVariant } from '../src/engine/tactical/variants.js'
import { launchOperation, completeOperation, nextOperationOrder, readyOperation } from '../tools/operation-walkthrough.js'
import { actionLock } from '../src/engine/exploration/campaign.js'
import type { CampaignAction } from '../src/engine/exploration/campaign.js'
import { saveExploration, loadExploration } from '../src/ui/exploration-save.js'

describe('boarding deck variety', () => {
  it('has fifteen deterministic, distinct deck configurations with clear spawn points and connected objectives', () => {
    const signatures = new Set<string>()
    for(const kind of OPERATION_KINDS) for(const variant of [1,2,3,4,5] as const) {
      const args = ['layout-test','site','Deck',initialRoster().slice(0,4),2,{},kind,variant] as const
      const m = createOperation(...args)
      expect(createOperation(...args)).toEqual(m)
      signatures.add(JSON.stringify({tiles:m.tiles,objective:m.objective,targets:[...m.operation!.survivors,...m.operation!.crates]}))
      expect(m.units.every((u)=>tileAt(m,u)==='floor'),`${kind}/${variant} units ${m.units.map(u=>`${u.id}:${tileAt(m,u)}@${u.x},${u.y}`).join(',')}`).toBe(true)
      expect(new Set(m.units.map(u=>`${u.x},${u.y}`)).size).toBe(m.units.length)
      const points = [...m.operation!.survivors,...m.operation!.crates,m.objective]
      for(const p of points) { expect(tileAt(m,p)).toBe('floor'); expect(pathTo(m,m.units[0]!,p,false)?.length,`${kind}/${variant} goal at ${p.x},${p.y}`).toBeGreaterThan(0) }
    }
    expect(signatures.size).toBe(15)
  })
  it('keeps a site’s people and deck stable on retry, with diversity across sites', () => {
    const casts = new Set<string>(), decks = new Set<DeckVariant>()
    for(let i=0;i<30;i++) {
      const names=survivorNames(`expedition:site-${i}:boarding:0`,`site-${i}`)
      expect(survivorNames(`expedition:site-${i}:boarding:9`,`site-${i}`)).toEqual(names)
      expect(names[0]).not.toBe(names[1]); casts.add(names.join('/'))
      const deck=siteVariant('expedition',`site-${i}`);decks.add(deck)
      expect(siteVariant('expedition',`site-${i}`)).toBe(deck)
    }
    expect(casts.size).toBeGreaterThan(20);expect(decks.size).toBe(5)
  })
  it('rejects forged variant values while accepting the original journal format', () => {
    const launched=launchOperation('variant-validation','rescue',1)
    const order=launched.actions.at(-1)!
    const ready=readyOperation('variant-validation')
    for(const variant of [0,6,-1,NaN,'1',null]) expect(actionLock(ready,{...order,variant} as CampaignAction)).toBeTruthy()
    const old=launchOperation('variant-validation','rescue')
    expect(old.mission!.operation!.variant).toBeUndefined()
    expect(old.mission!.operation!.survivors[0]!.name).toBe('Dr Imani Hale')
  })
  it('replays new variants through active objectives and reports; older envelopes reject the new field', () => {
    let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v},removeItem:()=>{}}
    for(const kind of OPERATION_KINDS) for(const variant of [1,2,3,4,5] as const) {
      const run=completeOperation('variant-journal',kind,3,variant)
      for(const state of [run.interaction!,run.extraction!,run.report,run.final]) {
        saveExploration(state,storage);expect(loadExploration(storage).campaign).toEqual(state)
      }
      saveExploration(run.deployed,storage);raw=JSON.stringify({...JSON.parse(raw),version:6})
      expect(loadExploration(storage).campaign).toBeNull()
    }
    const old=launchOperation('old-journal','salvage');saveExploration(old,storage)
    raw=JSON.stringify({...JSON.parse(raw),version:6});expect(loadExploration(storage).campaign).toEqual(old)
  })
  it('completes 120 legal varied missions at introductory through maximum threat', () => {
    let returned=0
    for(const kind of OPERATION_KINDS) for(const variant of [1,2,3,4,5] as const) for(let i=0;i<8;i++) {
      let m=createOperation(`variant-${i}`,'s','Variation',initialRoster().slice(0,4),i%3,{},kind,variant)
      for(let n=0;n<300 && m.outcome==='active';n++) {
        const order=nextOperationOrder(m);expect(tacticalLock(m,order)).toBeNull();m=reduceMission(m,order)
      }
      expect(m.outcome,`${kind}/${variant}/${i}`).toBe('success')
      expect(m.rescued.length,`${kind}/${variant}/${i} crew extracted`).toBeGreaterThanOrEqual(3)
      returned+=m.rescued.length
    }
    expect(returned).toBeGreaterThanOrEqual(450)
  })
})
