import type { Rng } from '../rng/prng.js'

const PREFIXES = [
  'Ash', 'Bel', 'Cor', 'Dra', 'Eph', 'Fal', 'Gar', 'Hel', 'Ith', 'Jor',
  'Kel', 'Lum', 'Mer', 'Nyx', 'Oph', 'Per', 'Quel', 'Rho', 'Sil', 'Tam',
  'Umb', 'Ves', 'Wyr', 'Xan', 'Yel', 'Zeph',
]

const MIDDLES = ['', '', '', 'a', 'e', 'i', 'o', 'ar', 'en', 'ia', 'ur', 'os']

const SUFFIXES = [
  'ax', 'is', 'or', 'un', 'eth', 'ara', 'ion', 'ux', 'ane', 'ir',
  'ost', 'yn', 'el', 'ade', 'ome', 'ath',
]

const CATALOGUE = ['HD', 'NGC', 'Vela', 'Kepler', 'Gliese', 'Wolf', 'Ross']

const FACTION_FORMS = [
  (core: string) => `the ${core} Combine`,
  (core: string) => `the ${core} Compact`,
  (core: string) => `the ${core} Directorate`,
  (core: string) => `the ${core} Concord`,
  (core: string) => `the ${core} Ascendancy`,
  (core: string) => `the Order of ${core}`,
  (core: string) => `the ${core} Free Companies`,
]

function coreName(rng: Rng): string {
  return rng.pick(PREFIXES) + rng.pick(MIDDLES) + rng.pick(SUFFIXES)
}

export function makeNamer(rng: Rng) {
  const used = new Set<string>()

  const unique = (make: () => string): string => {
    for (let attempt = 0; attempt < 64; attempt++) {
      const name = make()
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
    // Fall back to a numeric suffix rather than looping forever.
    let n = 2
    let name = make()
    while (used.has(`${name} ${n}`)) n++
    used.add(`${name} ${n}`)
    return `${name} ${n}`
  }

  return {
    system: (): string =>
      unique(() =>
        rng.chance(0.22)
          ? `${rng.pick(CATALOGUE)} ${rng.range(100, 9999)}`
          : coreName(rng),
      ),
    faction: (): string => unique(() => rng.pick(FACTION_FORMS)(coreName(rng))),
  }
}
