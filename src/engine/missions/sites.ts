import type { ClueSourceKind } from '../mystery/types.js'
import type { AwayTeam, Officer, OfficerRole } from '../crew/types.js'

/**
 * Away missions, M3 scope.
 *
 * Some evidence is simply handed over — a broker, an archivist, a fellow
 * castaway. The rest sits inside places that push back, and collecting it
 * means sending people. The team you pick determines which approaches are
 * open, what the odds are, and who is standing at the end.
 *
 * All odds are shown to the player as numbers before committing. Legible
 * systems, hidden content (DESIGN pillar 5): you always know the risk, never
 * what the galaxy holds.
 */

export type SiteType = 'derelict' | 'ruins' | 'holdout' | 'listening-post'

export interface Site {
  type: SiteType
  label: string
  /** Shown in the mission panel: what the place is like to enter. */
  description: string
}

export interface Approach {
  id: string
  label: string
  /** Which department officer must be on the team, if any. */
  needs: Exclude<OfficerRole, 'captain'> | null
  /** Base chances out of 100, before team bonuses. Always sum to 100. */
  clean: number
  messy: number
  disaster: number
}

const SITES: Record<SiteType, Site> = {
  derelict: {
    type: 'derelict',
    label: 'Derelict hulk',
    description:
      'A dead ship, cold for years. No power, no gravity, unknown structural state — and a log core somewhere inside it.',
  },
  ruins: {
    type: 'ruins',
    label: 'Planetary ruins',
    description:
      'Standing stonework older than your species. Unstable galleries, and inscriptions that will not read themselves.',
  },
  holdout: {
    type: 'holdout',
    label: 'Armed holdouts',
    description:
      'The people who know something are barricaded in and frightened, and they have weapons. How they come out depends on how you go in.',
  },
  'listening-post': {
    type: 'listening-post',
    label: 'Automated listening post',
    description:
      'A station transmitting to nobody. Old, powered, and possibly rigged against exactly the kind of visit you are about to make.',
  },
}

const APPROACHES: Record<SiteType, Approach[]> = {
  derelict: [
    { id: 'breach', label: 'Breach and sweep it room by room', needs: null, clean: 55, messy: 35, disaster: 10 },
    { id: 'cutting', label: 'Send a cutting team through the hold', needs: 'security', clean: 70, messy: 25, disaster: 5 },
    { id: 'repower', label: 'Repower the airlocks and walk in quiet', needs: 'science', clean: 80, messy: 16, disaster: 4 },
  ],
  ruins: [
    { id: 'dig', label: 'Dig straight for the inner chamber', needs: null, clean: 58, messy: 32, disaster: 10 },
    { id: 'perimeter', label: 'Hold a perimeter, work by torchlight', needs: 'security', clean: 72, messy: 23, disaster: 5 },
    { id: 'survey', label: 'Survey first, touch nothing twice', needs: 'science', clean: 82, messy: 15, disaster: 3 },
  ],
  holdout: [
    { id: 'rush', label: 'Rush them before they organise', needs: null, clean: 55, messy: 35, disaster: 10 },
    { id: 'stun', label: 'Stun sweep — take them standing', needs: 'security', clean: 74, messy: 21, disaster: 5 },
    { id: 'treat', label: 'Offer to treat their wounded first', needs: 'medical', clean: 86, messy: 11, disaster: 3 },
  ],
  'listening-post': [
    { id: 'rip', label: 'Rip the core out and run', needs: null, clean: 62, messy: 28, disaster: 10 },
    { id: 'sweep', label: 'Sweep it for triggers first', needs: 'security', clean: 74, messy: 21, disaster: 5 },
    { id: 'decrypt', label: 'Decrypt in place, leave it humming', needs: 'science', clean: 84, messy: 13, disaster: 3 },
  ],
}

/**
 * Which evidence requires an away mission, and what kind of place holds it.
 * The social sources hand their accounts over without a fight.
 */
const SITE_FOR_KIND: Partial<Record<ClueSourceKind, SiteType>> = {
  'derelict-log': 'derelict',
  'ruins-tablet': 'ruins',
  prisoner: 'holdout',
  'listening-post': 'listening-post',
}

/** Higher-ranked hazards win when a system holds several kinds of evidence. */
const DANGER_RANK: SiteType[] = ['derelict', 'ruins', 'holdout', 'listening-post']

/**
 * Evidence in these forms arrives as a raw artefact — an inscription, a
 * corrupted log, an encrypted loop. Without your science officer on the
 * ground it comes back undecoded: prose you cannot read and a constraint you
 * cannot file until someone qualified sits down with it.
 */
const DECODE_KINDS: ReadonlySet<ClueSourceKind> = new Set([
  'ruins-tablet',
  'derelict-log',
  'listening-post',
])

export function siteForKind(kind: ClueSourceKind): Site | null {
  const type = SITE_FOR_KIND[kind]
  return type ? SITES[type] : null
}

export function needsDecoding(kind: ClueSourceKind): boolean {
  return DECODE_KINDS.has(kind)
}

/** The site a mixed evidence cache presents: the most dangerous kind wins. */
export function dominantSite(kinds: readonly ClueSourceKind[]): Site | null {
  let best: SiteType | null = null
  for (const kind of kinds) {
    const type = SITE_FOR_KIND[kind]
    if (!type) continue
    if (best === null || DANGER_RANK.indexOf(type) < DANGER_RANK.indexOf(best)) best = type
  }
  return best ? SITES[best] : null
}

export function approachesFor(site: Site): Approach[] {
  return APPROACHES[site.type]
}

export interface Odds {
  clean: number
  messy: number
  disaster: number
}

/**
 * The numbers the player sees are the numbers the dice use. Bonuses shift
 * weight from the bad outcomes to the clean one; disaster is squeezed last
 * because it is the outcome people plan around.
 */
export function approachOdds(
  approach: Approach,
  team: AwayTeam,
  roster: readonly Officer[],
): Odds {
  let bonus = 0

  if (team.captain) bonus += 8

  for (const role of team.officers) {
    const officer = roster.find((o) => o.role === role && o.status === 'fit')
    if (!officer) continue
    // The approach's own specialist counts double-weight via skill.
    bonus += approach.needs === role ? 4 * (officer.skill - 1) : 2
  }

  bonus += Math.min(team.escorts, 4) * 2
  bonus += Math.min(team.hands, 4) * 1

  const clean = Math.min(95, approach.clean + bonus)
  let spent = clean - approach.clean
  const messy = Math.max(3, approach.messy - spent)
  spent -= approach.messy - messy
  const disaster = Math.max(2, approach.disaster - Math.max(0, spent))

  // Renormalise the remainder into messy so the three always sum to 100.
  return { clean, messy: 100 - clean - disaster, disaster }
}
