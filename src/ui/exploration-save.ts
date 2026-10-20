import { createCampaign, migratePreview, reduceCampaign } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { createCampaign as createPreview, reduceCampaign as reducePreview } from '../engine/exploration/legacy-campaign.js'
import type { CampaignAction as PreviewAction } from '../engine/exploration/legacy-campaign.js'
import type { StorageLike } from './save.js'

export const EXPLORATION_SAVE_KEY = 'starship-explorer-exploration-v2'
export const EXPLORATION_SAVE_VERSION = 14
/** Versions only ever written by pre-release builds whose battle and rift rules kept changing; their journals cannot be replayed faithfully. */
const PRE_RELEASE_VERSIONS = [11, 12, 13]
/**
 * The longest journal the loader accepts, about 3.5 MB of storage. Saving
 * refuses anything longer so the voyage reports an autosave failure instead
 * of writing a save that could never be resumed.
 */
export const MAX_JOURNAL_ACTIONS = 50_000
export type ExplorationSave = { campaign: Campaign | null; error: string | null }
function replayPreview(seed: string, actions: PreviewAction[]): Campaign {
  let old = createPreview(seed)
  for (const action of actions) {
    const next = reducePreview(old, action)
    if (next === old) throw new Error('Invalid preview action')
    old = next
  }
  return migratePreview(old)
}
/** A version-1 journal is replayed under its original rules, then explicitly migrated. */
export function loadExploration(storage: StorageLike): ExplorationSave {
  try {
    const raw = storage.getItem(EXPLORATION_SAVE_KEY)
    if (!raw) return { campaign: null, error: null }
    const envelope = JSON.parse(raw)
    if (PRE_RELEASE_VERSIONS.includes(envelope?.version)) return { campaign: null, error: 'This expedition was saved by a pre-release build and cannot be replayed. It has been kept unchanged.' }
    if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, EXPLORATION_SAVE_VERSION].includes(envelope?.version) || envelope.ruleset !== 'exploration-v2')
      return { campaign: null, error: 'This exploration save uses another version. It has been kept unchanged.' }
    if (typeof envelope.seed !== 'string' || !envelope.seed.length || envelope.seed.length > 200 ||
      !Array.isArray(envelope.actions) || envelope.actions.length > MAX_JOURNAL_ACTIONS) throw new Error('Invalid save')
    if (envelope.version === 1) return { campaign: replayPreview(envelope.seed, envelope.actions), error: null }
    const prefix = envelope.legacyActions
    if (prefix !== null && (!Array.isArray(prefix) || prefix.length > 10000)) throw new Error('Invalid migration prefix')
    let campaign = prefix === null ? createCampaign(envelope.seed) : replayPreview(envelope.seed, prefix)
    // Rules read no more of the journal than its last entry, so each step sees
    // only that entry and the journal is rebuilt here. Handing every step the
    // whole journal made long voyages quadratic to load.
    const journal: CampaignAction[] = [...campaign.actions]
    for (const action of envelope.actions as CampaignAction[]) {
      // V2 journals predate boarding and trauma research. Their accepted actions
      // retain identical semantics; the new roster is additive migration state.
      if (envelope.version === 2 && (['deploy', 'tactical', 'debrief', 'rest-team', 'recruit'].includes(action?.type) ||
        ('project' in (action ?? {}) && (action as { project: string }).project === 'trauma-protocols'))) throw new Error('Invalid version-2 action')
      if (envelope.version < 4 && (['escort', 'ship-order', 'ship-debrief'].includes(action?.type) ||
        ('project' in (action ?? {}) && ['fire-control', 'ion-projector', 'focus-beam', 'layered-shields', 'adaptive-shields'].includes((action as { project: string }).project)))) throw new Error('Invalid pre-combat action')
      if (envelope.version < 5 && (['story', 'deliver-letters', 'loadout'].includes(action?.type) || ('project' in (action ?? {}) && ['plasma-ballistics', 'personal-shields'].includes((action as { project: string }).project)))) throw new Error('Invalid pre-stories action')
      if (envelope.version < 6 && action?.type === 'deploy-operation') throw new Error('Invalid pre-operations action')
      if (envelope.version < 7 && action?.type === 'deploy-operation' && action.variant !== undefined) throw new Error('Invalid pre-variant action')
      if (envelope.version < 8 && ['start-arc', 'arc-choice'].includes(action?.type)) throw new Error('Invalid pre-relay action')
      if(envelope.version<9 && (['accept-survivor','deploy-recorder','close-survivor'].includes(action?.type)||(action?.type==='deploy-operation'&&action.rememberSurvivors!==undefined)||(action?.type==='tactical'&&action.order?.type==='drop-recorder')))throw new Error('Invalid pre-survivor action')
      if (envelope.version < 10 && action?.type === 'auto-research') throw new Error('Invalid pre-automation action')
      if (envelope.version < 14 && ((action?.type === 'escort' && action.rules !== undefined) || (action?.type === 'travel' && action.hazards !== undefined) || (action?.type === 'service' && action.service === 'ordnance') || action?.type === 'signal' || action?.type === 'buy-weapon' || ['hardcore', 'begin', 'sell-weapon', 'upgrade-reactor', 'field-repair'].includes(action?.type) || (action?.type === 'return-home' && action.finale !== undefined))) throw new Error('Invalid pre-projectile action')
      const step = { ...campaign, actions: journal.slice(-1) }
      const next = reduceCampaign(step, action)
      if (next === step) throw new Error('Invalid action journal')
      if (next.actions.length > step.actions.length) journal.push(next.actions.at(-1)!)
      else journal[journal.length - 1] = next.actions.at(-1)!
      campaign = next
    }
    return { campaign: { ...campaign, actions: journal }, error: null }
  } catch {
    return { campaign: null, error: 'The exploration save could not be read. It has been kept unchanged.' }
  }
}
export function saveExploration(state: Campaign, storage: StorageLike): boolean {
  if (state.actions.length > MAX_JOURNAL_ACTIONS) return false
  try {
    storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify({ version: EXPLORATION_SAVE_VERSION,
      ruleset: state.ruleset, seed: state.seed, legacyActions: state.legacyActions, actions: state.actions }))
    return true
  } catch { return false }
}
