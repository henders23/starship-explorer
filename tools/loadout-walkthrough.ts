import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
export function preparedTeam(seed = 'equipped-team'): Campaign {
  let state = createCampaign(seed)
  const act = (action: CampaignAction) => {
    const lock = actionLock(state, action)
    if (lock) throw new Error(`${action.type}: ${lock}`)
    state = reduceCampaign(state, action)
  }
  const station = state.world.locations.find((s) => s.systemId === state.at && s.kind === 'station')!
  act({ type: 'investigate', locationId: station.id })
  const work = () => act({ type: 'service', locationId: station.id, service: 'contract' })
  for (const project of ['fire-control', 'plasma-ballistics', 'composite-hull', 'personal-shields'] as const) {
    act({ type: 'research', project })
    while (!state.research.completed.includes(project)) work()
  }
  act({ type: 'scan', tier: 'survey' })
  act({ type: 'investigate', locationId: state.world.locations.find((s) => s.name === 'The Silent Courier')!.id })
  return state
}
