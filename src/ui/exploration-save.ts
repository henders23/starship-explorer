import { createCampaign, migratePreview, reduceCampaign } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { createCampaign as createPreview, reduceCampaign as reducePreview } from '../engine/exploration/legacy-campaign.js'
import type { CampaignAction as PreviewAction } from '../engine/exploration/legacy-campaign.js'
import type { StorageLike } from './save.js'

export const EXPLORATION_SAVE_KEY = 'starship-explorer-exploration-v2'
export const EXPLORATION_SAVE_VERSION = 5
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
    if (![1, 2, 3, 4, EXPLORATION_SAVE_VERSION].includes(envelope?.version) || envelope.ruleset !== 'exploration-v2')
      return { campaign: null, error: 'This exploration save uses another version. It has been kept unchanged.' }
    if (typeof envelope.seed !== 'string' || !envelope.seed.length || envelope.seed.length > 200 ||
      !Array.isArray(envelope.actions) || envelope.actions.length > 10000) throw new Error('Invalid save')
    if (envelope.version === 1) return { campaign: replayPreview(envelope.seed, envelope.actions), error: null }
    const prefix = envelope.legacyActions
    if (prefix !== null && (!Array.isArray(prefix) || prefix.length > 10000)) throw new Error('Invalid migration prefix')
    let campaign = prefix === null ? createCampaign(envelope.seed) : replayPreview(envelope.seed, prefix)
    for (const action of envelope.actions as CampaignAction[]) {
      // V2 journals predate boarding and trauma research. Their accepted actions
      // retain identical semantics; the new roster is additive migration state.
      if (envelope.version === 2 && (['deploy', 'tactical', 'debrief', 'rest-team', 'recruit'].includes(action?.type) ||
        ('project' in (action ?? {}) && (action as { project: string }).project === 'trauma-protocols'))) throw new Error('Invalid version-2 action')
      if (envelope.version < 4 && (['escort', 'ship-order', 'ship-debrief'].includes(action?.type) ||
        ('project' in (action ?? {}) && ['fire-control', 'ion-projector', 'focus-beam', 'layered-shields', 'adaptive-shields'].includes((action as { project: string }).project)))) throw new Error('Invalid pre-combat action')
      if (envelope.version < 5 && (['story', 'deliver-letters', 'loadout'].includes(action?.type) || ('project' in (action ?? {}) && ['plasma-ballistics', 'personal-shields'].includes((action as { project: string }).project)))) throw new Error('Invalid pre-stories action')
      const next = reduceCampaign(campaign, action)
      if (next === campaign) throw new Error('Invalid action journal')
      campaign = next
    }
    return { campaign, error: null }
  } catch {
    return { campaign: null, error: 'The exploration save could not be read. It has been kept unchanged.' }
  }
}
export function saveExploration(state: Campaign, storage: StorageLike): boolean {
  try {
    storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify({ version: EXPLORATION_SAVE_VERSION,
      ruleset: state.ruleset, seed: state.seed, legacyActions: state.legacyActions, actions: state.actions }))
    return true
  } catch { return false }
}
