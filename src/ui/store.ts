import { useMemo } from 'react'
import { create } from 'zustand'
import { candidatesFor, corroboratedIds, findContradictions } from '../engine/mystery/deduce.js'
import type { ClueId, ClueState, PlayerClue } from '../engine/mystery/types.js'
import { evidenceSites, heldClues, newGame, reduce, usableClues } from '../engine/state/reducer.js'
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
const SAVE_KEY = 'starship-explorer-save-v1'

/**
 * Persistence is exactly what the engine promised it would be: the state is
 * one serialisable object, so a save is a stringify and a resume is a parse.
 * The shape check is deliberately shallow — any save from a different schema
 * version simply fails it and the game starts fresh rather than crashing.
 */
function loadSave(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (
      typeof parsed?.seed !== 'string' ||
      !parsed.galaxy?.systems ||
      !parsed.tech ||
      !parsed.recruits ||
      !parsed.parts ||
      typeof parsed.ship?.hull !== 'number' ||
      typeof parsed.ordnance !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function persist(state: GameState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable: the game plays on, unsaved.
  }
}

/** Whether a resumable voyage is waiting in storage. */
export function hasSave(): boolean {
  return loadSave() !== null
}

export const useGame = create<Store>((set, get) => ({
  state: loadSave() ?? newGame(DEFAULT_SEED),
  lastEvents: [],
  dispatch: (action) => {
    const { state, events } = reduce(get().state, action)
    persist(state)
    set({ state, lastEvents: events })
  },
  restart: (seed) => {
    const state = newGame(seed)
    persist(state)
    set({ state, lastEvents: [] })
  },
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
  /** Held artefacts that cannot be read until a science officer decodes them. */
  undecoded: Set<ClueId>
  /** Whether anyone aboard can currently decode. */
  canDecode: boolean
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
    const readable = usableClues(state)
    const trusted = readable.filter((c) => c.state === 'trusted')
    const candidates = candidatesFor(readable, index)
    const contradictions = findContradictions(trusted, index, 3)

    const conflicted = new Set<ClueId>()
    for (const contradiction of contradictions) {
      for (const id of contradiction.clues) conflicted.add(id)
    }

    return {
      clues,
      trusted,
      undecoded: new Set(state.undecoded),
      canDecode: state.roster.some((o) => o.role === 'science' && o.status === 'fit'),
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
