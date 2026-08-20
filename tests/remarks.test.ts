import { describe, expect, it } from 'vitest'
import { assignRemarks, REMARK_BY_ID, REMARKS, remarkFits } from '../src/engine/crew/remarks.js'
import { newGame } from '../src/engine/state/reducer.js'

/**
 * The bridge's remarks on the chart. Three things have to hold, and none of
 * them is about prose: a line must be *true* of the star it is said about,
 * every star must get one, and the same sky must always say the same things.
 */
const SEEDS = ['golden-2', 'golden-4', 'voyager', 'alpha', 'beta', 'gamma']

describe('crew remarks', () => {
  it('has unique ids and a line for every one', () => {
    expect(new Set(REMARKS.map((r) => r.id)).size).toBe(REMARKS.length)
    for (const remark of REMARKS) {
      expect(remark.line.length).toBeGreaterThan(40)
      expect(remark.line.trim()).toBe(remark.line)
    }
  })

  it('never says something a system is not', () => {
    for (const seed of SEEDS) {
      const galaxy = newGame(seed).galaxy
      const assigned = assignRemarks(seed, galaxy)
      for (const system of galaxy.systems) {
        const remark = REMARK_BY_ID[assigned[system.id]!]
        expect(remark, `${seed}/${system.id} went unremarked`).toBeDefined()
        const degree = (galaxy.adjacency[system.id] ?? []).length
        expect(
          remarkFits(remark!, system, degree),
          `${seed}/${system.id}: "${remark!.line}" is not true of it`,
        ).toBe(true)
      }
    }
  })

  it('gives every star in a sky its own line, and the same line every voyage', () => {
    for (const seed of SEEDS) {
      const galaxy = newGame(seed).galaxy
      const assigned = assignRemarks(seed, galaxy)
      expect(Object.keys(assigned)).toHaveLength(galaxy.systems.length)
      expect(new Set(Object.values(assigned)).size).toBe(galaxy.systems.length)

      const again = assignRemarks(seed, galaxy)
      for (const system of galaxy.systems) expect(again[system.id]).toBe(assigned[system.id])
    }
  })

  it('leans on what a system actually holds rather than small talk', () => {
    for (const seed of SEEDS) {
      const galaxy = newGame(seed).galaxy
      const assigned = assignRemarks(seed, galaxy)
      const specific = galaxy.systems.filter(
        (s) => REMARK_BY_ID[assigned[s.id]!]!.subject.kind !== 'any',
      )
      expect(specific.length / galaxy.systems.length).toBeGreaterThan(0.7)
    }
  })
})
