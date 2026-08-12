import { createRng, type Rng } from '../rng/prng.js'
import type { Officer, OfficerRole } from './types.js'

const FIRST_NAMES = [
  'Adaeze', 'Bram', 'Calla', 'Dmitri', 'Efua', 'Farid', 'Greta', 'Hana',
  'Ilsa', 'Joaquin', 'Kirra', 'Lech', 'Mireille', 'Nikau', 'Oyelola', 'Priya',
  'Quang', 'Rosalind', 'Soren', 'Tomas', 'Umar', 'Vasha', 'Wren', 'Ximena',
  'Yusuf', 'Zofia',
]

const SURNAMES = [
  'Achebe', 'Brandt', 'Castellanos', 'Duval', 'Eriksen', 'Fontaine', 'Grieve',
  'Hoshino', 'Ivankov', 'Jansen', 'Kowalczyk', 'Lindqvist', 'Mbeki', 'Naylor',
  'Okonkwo', 'Petrov', 'Quintana', 'Reven', 'Santhanam', 'Teller', 'Ueda',
  'Vance', 'Whitlock', 'Xiang', 'Yellowknife', 'Zhukov',
]

const TITLES: Record<OfficerRole, string> = {
  captain: 'Cpt.',
  security: 'Chief',
  science: 'Lt.',
  medical: 'Dr.',
}

function personName(rng: Rng, role: OfficerRole): string {
  return `${TITLES[role]} ${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`
}

/** The founding roster: the captain and three department officers, per seed. */
export function generateRoster(seed: string): Officer[] {
  const rng = createRng(`${seed}:roster`)
  const roles: OfficerRole[] = ['captain', 'security', 'science', 'medical']
  const usedFirst = new Set<string>()
  const usedLast = new Set<string>()

  return roles.map((role) => {
    // No shared first names or surnames on a four-person bridge: two Efuas in
    // the same log entry reads like a typo, not a coincidence.
    let first = rng.pick(FIRST_NAMES)
    while (usedFirst.has(first)) first = rng.pick(FIRST_NAMES)
    usedFirst.add(first)
    let last = rng.pick(SURNAMES)
    while (usedLast.has(last)) last = rng.pick(SURNAMES)
    usedLast.add(last)

    return {
      role,
      name: `${TITLES[role]} ${first} ${last}`,
      skill: 3,
      status: 'fit' as const,
      origin: 'founding' as const,
    }
  })
}

/**
 * A generic crew member steps up. They arrive with a name for the first time
 * and less skill than the officer they replace — the ship keeps a science
 * officer, but not that science officer.
 *
 * Seeded by how many promotions have happened, so replay is exact.
 */
export function promoteGeneric(seed: string, role: OfficerRole, promotionCount: number): Officer {
  const rng = createRng(`${seed}:promotion:${promotionCount}`)
  return {
    role,
    name: personName(rng, role),
    skill: 2,
    status: 'fit',
    origin: 'promoted',
  }
}
