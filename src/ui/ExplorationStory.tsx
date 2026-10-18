import { CrewLine } from './crew-presence.js'
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
    <h3>{story.title}</h3>
    {!chosen && <CrewLine person={site.kind === 'derelict' || site.kind === 'outpost' ? 'cross' : site.kind === 'resource-field' ? 'kerr' : 'morozova'} compact>
      {site.name === 'The Silent Courier' ? 'Someone kept this beacon alive for decades. We should find out what they were protecting.' :
        site.kind === 'derelict' ? 'We can take what we need, but first I want to know who left this place.' :
        site.kind === 'ruins' ? 'These readings are more than salvage. There is a history here.' :
        site.kind === 'world' ? 'We are visitors here. Observation may tell us more than interference.' :
        site.kind === 'resource-field' ? 'Useful material, yes. But we need to consider what taking it costs.' :
        'The signal is unusual. Let us understand it before we act.'}
    </CrewLine>}
    <p>{chosen ? chosen.outcome : story.text}</p>
    {chosen && <small>Captain’s record · {chosen.label} · day {record!.day}</small>}
    {!chosen && <>
      <div className="exp-story-choices">
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
      </div>
      <small>This is separate from cargo recovery. You can decide later.</small>
    </>}
  </section>
}

export function LettersObjective({ state }: { state: Campaign }) {
  if (!state.stories.some((r) => r.storyId === 'last-post' && r.choiceId === 'carry')) return null
  return <article className="exp-letter-objective relay-objective"><span className="exp-eyebrow">{state.lettersDelivered ? 'Side voyage complete' : 'Side voyage / The last post'}</span>
    <h3>{state.lettersDelivered ? 'The letters are home' : '143 letters. One promise.'}</h3>
    <p>{state.lettersDelivered ? '“We kept the light on too.” The relay delivered the Courier’s final messages.' : 'Contact a station outside your arrival system to relay the Courier’s letters. Delivery: 1 day · +25 credits.'}</p>
  </article>
}
