import { actionLock, fuelCapacity } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import type { ExplorationLocation } from '../engine/exploration/v2.js'
import { storyAt, choiceTerms } from '../engine/exploration/stories.js'

export function ExplorationStory({ state, site, dispatch }: { state: Campaign; site: ExplorationLocation; dispatch: (action: CampaignAction) => void }) {
  const story = storyAt(state.seed, site)
  if (!story || state.exploration.statuses[site.id] === 'detected') return null
  const record = state.stories.find((r) => r.locationId === site.id)
  const chosen = story.choices.find((c) => c.id === record?.choiceId)
  return <section className="exp-story" aria-label={story.title}>
    <span className="exp-eyebrow">{chosen ? `CAPTAIN’S RECORD / DAY ${record!.day}` : 'CAPTAIN’S DECISION / OPTIONAL'}</span>
    <h3>{story.title}</h3>
    <p>{chosen ? chosen.outcome : story.text}</p>
    {!chosen && <>
      {story.choices.map((choice) => {
        const action: CampaignAction = { type: 'story', locationId: site.id, choiceId: choice.id }
        const lock = actionLock(state, action)
        return <div key={choice.id} className="exp-story-choice">
          <button className="exp-button" disabled={!!lock} onClick={() => dispatch(action)}>
            <strong>{choice.label}</strong><small>{choiceTerms(choice)}</small>
          </button>
          {choice.id === 'carry' && <small>Deliver at a station in another system for 25 credits.</small>}
          {choice.fuel > 0 && state.fuel + choice.fuel > fuelCapacity(state) && <small>Tank space: {fuelCapacity(state) - state.fuel}. Excess fuel cannot be stored.</small>}
          {lock && <small>{lock}</small>}
        </div>
      })}
      <small>This is separate from cargo recovery. You can decide later.</small>
    </>}
  </section>
}

export function LettersObjective({ state }: { state: Campaign }) {
  if (!state.stories.some((r) => r.storyId === 'last-post' && r.choiceId === 'carry')) return null
  return <article className="exp-letter-objective"><span className="exp-eyebrow">{state.lettersDelivered ? 'SIDE VOYAGE COMPLETE' : 'SIDE VOYAGE / THE LAST POST'}</span>
    <h3>{state.lettersDelivered ? 'The letters are home' : '143 letters. One promise.'}</h3>
    <p>{state.lettersDelivered ? '“We kept the light on too.” The relay delivered the Courier’s final messages.' : 'Contact a station outside your arrival system to relay the Courier’s letters. Delivery: 1 day · +25 credits.'}</p>
  </article>
}
