import { describe, expect, it } from 'vitest'
import { freshLines } from '../src/ui/fresh-log.js'

const full = Array.from({ length: 50 }, (_, i) => `Day ${i} · entry ${i}`)

describe('fresh log lines', () => {
  it('finds a new line once the log is full and drops its oldest', () => {
    expect(freshLines(full, [...full.slice(1), 'Day 50 · new'])).toEqual(['Day 50 · new'])
    expect(freshLines(full, [...full.slice(3), 'a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })
  it('finds a batched order that rewrites the last line', () => {
    expect(freshLines(full, [...full.slice(0, -1), 'Day 49 · entry 49 · twice'])).toEqual(['Day 49 · entry 49 · twice'])
  })
  it('repeats an identical order', () => {
    expect(freshLines(['x'], ['x', 'x'])).toEqual(['x'])
    expect(freshLines(full, [...full.slice(1), full[49]!])).toEqual([full[49]!])
  })
  it('shows at most four lines and nothing for an unchanged log', () => {
    expect(freshLines(['a'], ['a', '1', '2', '3', '4', '5'])).toEqual(['2', '3', '4', '5'])
    expect(freshLines(full, [...full])).toEqual([])
  })
})
