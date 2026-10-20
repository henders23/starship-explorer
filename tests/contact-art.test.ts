import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTACT_SHIP_ART } from '../src/ui/ship-contact-art.js'

describe('contact ship art', () => {
  it.each([...new Set(Object.values(CONTACT_SHIP_ART))])('%s is a complete WebP file', (path) => {
    const bytes = readFileSync(new URL(`../public${path}`, import.meta.url))
    expect(bytes.toString('latin1', 0, 4)).toBe('RIFF')
    expect(bytes.toString('latin1', 8, 12)).toBe('WEBP')
    expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length)
  })
})
