import { useMemo } from 'react'
import { create } from 'zustand'
import { candidatesFor, corroboratedIds, findContradictions } from '../engine/mystery/deduce.js'
import type { ClueId, ClueState, PlayerClue } from '../engine/mystery/types.js'
import { evidenceSites, heldClues, newGame, reduce } from '../engine/state/reducer.js'
import type { Action, GameEvent, GameState } from '../engine/state/types.js'
import { GalaxyIndex } from '../engine/worldgen/index-galaxy.js'
import type { SystemId } from '../engine/worldgen/types.js'

/**
 * A thin store over the engine reducer. It holds state and forwards actions;
 * it contains no rules. Every derived number the UI shows comes from an engine
 * selector, so there is exactly one place where the game's logic lives.
 */
interface Store {
  state: GameState
  lastEvents: GameEvent[]
  dispatch: (action: Action) => void
  restart: (seed: string) => void
}

const DEFAULT_SEED = 'voyager'

export const useGame = create<Store>((set, get) => ({
  state: newGame(DEFAULT_SEED),
  lastEvents: [],
  dispatch: (action) => {
    const { state, events } = reduce(get().state, action)
    set({ state, lastEvents: events })
  },
  restart: (seed) => set({ state: newGame(seed), lastEvents: [] }),
}))

/**
 * The galaxy index is derived, not state — it holds caches and a class
 * instance, so it must not live in the serialisable store. Rebuilt only when
 * the galaxy identity changes.
 */
export function useGalaxyIndex(): GalaxyIndex {
  const galaxy = useGame((s) => s.state.galaxy)
  return useMemo(() => new GalaxyIndex(galaxy), [galaxy])
}

export interface NavPlotView {
  /** Every clue the player holds, answer key stripped. */
  clues: PlayerClue[]
  trusted: PlayerClue[]
  /** Systems consistent with everything currently trusted. */
  candidates: SystemId[]
  candidateSet: Set<SystemId>
  /** Minimal sets of trusted clues that cannot all be true. */
  contradictions: Array<{ clues: ClueId[] }>
  /** Clue ids caught up in at least one contradiction. */
  conflicted: Set<ClueId>
  corroborated: Set<ClueId>
  sites: Set<SystemId>
  /** True when the trusted set is self-defeating and admits nothing at all. */
  impossible: boolean
}

/**
 * Everything the Nav Plot needs, recomputed when the filing changes.
 *
 * Deliberately not memoised per-field: candidate filtering is a handful of
 * bitmask ANDs and completes far inside a frame, and correctness of the live
 * update matters more here than shaving microseconds.
 */
export function useNavPlot(): NavPlotView {
  const state = useGame((s) => s.state)
  const index = useGalaxyIndex()

  return useMemo(() => {
    const clues = heldClues(state)
    const trusted = clues.filter((c) => c.state === 'trusted')
    const candidates = candidatesFor(clues, index)
    const contradictions = findContradictions(trusted, index, 3)

    const conflicted = new Set<ClueId>()
    for (const contradiction of contradictions) {
      for (const id of contradiction.clues) conflicted.add(id)
    }

    return {
      clues,
      trusted,
      candidates,
      candidateSet: new Set(candidates),
      contradictions,
      conflicted,
      corroborated: corroboratedIds(clues),
      sites: evidenceSites(state),
      impossible: trusted.length > 0 && candidates.length === 0,
    }
  }, [state, index])
}

export function useDispatch(): (action: Action) => void {
  return useGame((s) => s.dispatch)
}

export const fileClue = (clue: ClueId, state: ClueState): Action => ({ type: 'file', clue, state })
