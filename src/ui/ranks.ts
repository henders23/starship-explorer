import type { Operative } from '../engine/tactical/mission.js'

/**
 * Display ranks. The founding squad leader is the sergeant; everyone else
 * starts as a private and is promoted by service XP (3 per successful mission).
 */
export function rankOf(operative: Pick<Operative, 'id' | 'xp'> | undefined): string {
  if (!operative) return 'Pvt'
  if (operative.id === 'operative-0') return 'Sgt'
  return operative.xp >= 9 ? 'Cpl' : operative.xp >= 3 ? 'Pfc' : 'Pvt'
}
