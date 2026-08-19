import type { MysteryOptions } from '../mystery/generate.js'

/**
 * Voyage length (R10): the short galaxy is the first-run mode — the same
 * game, the same contract, roughly half the sky. The annulus shrinks with
 * the system count so lane density (and therefore fuel pressure and route
 * texture) stays close to the full sector's; the mystery keeps its proof
 * thresholds untouched, so a short puzzle is still a proven-solvable one.
 *
 * A seed names a sky only together with its length: the same seed generates
 * different galaxies in different modes.
 */
export type VoyageLength = 'standard' | 'short'

export const VOYAGE_OPTIONS: Record<VoyageLength, Partial<MysteryOptions>> = {
  standard: {},
  short: {
    galaxy: {
      systemCount: 48,
      innerRadius: 340,
      outerRadius: 730,
    },
    // Fewer honest clues to chase: the deduction stays a deduction, but the
    // gathering tour fits a shorter evening.
    targetRedundancy: 1.7,
    maxTrueClues: 14,
  },
}

export const VOYAGE_LABELS: Record<VoyageLength, string> = {
  short: 'Short voyage — a nearer sky, a first command',
  standard: 'Full sector — the whole ninety-star hunt',
}
