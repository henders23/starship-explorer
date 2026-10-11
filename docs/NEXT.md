# Narrative milestone — The Long Relay

**Implemented · 11 October 2026.** The three stages, both choices, save-version 8 integration, objective card and ending acknowledgements are implemented. Automated journey/replay and browser checks are provided; independent human playtesting for comprehension and emotional impact remains outstanding.

This milestone introduces one memorable, connected story arc. The expedition already has
working research, recovery, combat and return systems. Its larger weakness is
that many choices end at the reward screen. A small arc with a remembered person
and a later consequence is the best test of player interest before adding scale.

This brief proposes a continuation of the existing Courier letters. It does not
change that finished story or add a new requirement for returning home.

## The player experience

The letters reached a relay, but one recipient lives beyond a damaged long-range
link. A station keeper asks whether the Ithaca can carry a copy to the next node.
There, a recipient wants a private reply carried back; repairing the relay would
also reconnect the settlement. The captain can restore the wider link or deliver
a local copy without spending scarce supplies. On returning, the player hears
what their chosen approach meant to the people using it.

Working title: **The Long Relay**. Target length: 15–25 minutes across ordinary
travel and three short scenes, to be tested. Two new recurring contacts:

- **Edda Sol**, station keeper: practical, protective of the people waiting for
  news, more interested in reliable commitments than heroic promises.
- **Tarek Sen**, recipient and survey technician: relieved to hear a familiar
  voice, but wary of letting a public network carry a personal answer.

These are new characters, not retroactively identified as tactical survivors.
Their names, portraits and roles stay fixed. Rescue callbacks can follow in a
later arc once stable survivor records are available beyond the last mission.

## Three beats

| Beat | Situation and choice | Persistent result |
| --- | --- | --- |
| 1. An answer is waiting | After Courier delivery, speak to Edda at a contacted station. Accept the optional request or close it for later. | Bind an origin and reachable destination; show an active objective |
| 2. The broken link | At the destination, meet Tarek. Repair the shared relay (5 materials, 2 days) or deliver a local copy (no resources, 3 days). | Store the approach; advance research with time; unlock return objective |
| 3. What came back | Return to Edda and acknowledge the response. | Pay 20 credits once; show a distinct reply and add a branch-specific ending record |

Travel/contact costs are additional and shown through the normal controls. The
original delivery still pays its original 25 credits. The new arc has no hidden
bonus, unique required technology or combat gate. Starting and acknowledging take
no campaign days; closing a scene is not a resource-generating action.

Repair restores communication for others and gets the local work done sooner,
but spends supplies the captain may need. Local delivery conserves supplies and
keeps the exchange personal, but leaves the wider relay damaged. Both are valid.
The follow-up must acknowledge both benefit and limitation without labelling one
choice morally correct. No later surprise penalty contradicts the stated terms.

Example voice targets, to be revised in the actual scene script:

> Edda: “Most people ask how old the letters are. You asked where they belonged.”

> Tarek: “You can put the relay back together. Give me a minute before you put my
> answer on it.”

Keep scenes around 150–250 words each, broken into short exchanges, with visible
choice terms. These are targets for this slice, not a requirement to fill space.
Show the emotional response and then return control to the player.

## Interface and art

Add a compact **Active voyage** card with the current objective, named destination
and a **Locate on chart** action. If the current system is the destination,
explain that station contact is next rather than suggesting another jump.
The archive stores completed beats and their results. Return-home confirmation
can identify unfinished optional work without blocking departure.

One relay environment and two consistent contact portraits are the maximum new
art scope. Use realistic materials, restrained practical lighting and crop-safe
composition. Keep dialogue and buttons outside art. Reuse an existing asset only
if it fits the location and does not imply the wrong character. Review desktop
and 390/320px phone screens before calling the art finished. No tactical expansion,
new combat animation system or faction reputation meter is required for this slice.

## Implementation order

1. Finalise the three scene scripts and consequences; prove each branch has a
   reason a reasonable player would choose it.
2. Add explicit opt-in arc state/actions, stable site binding and save-version
   handling. Keep all existing accepted journals unchanged.
3. Connect the objective card, chart destination, scenes, archive and homecoming
   acknowledgement using the engine's state.
4. Create any necessary art and review it in the actual interface.
5. Test both branches, all reload boundaries, invalid/repeated orders, zero-store
   play, deferral and returning home with the arc unfinished.
6. Observe first-time players, revise confusing or emotionally flat parts, then
   publish the tested milestone to `main` and verify deployment.

The proposed schema and N01–N10 acceptance criteria are in
[SPECIFICATION.md](SPECIFICATION.md#10-proposed-next-slice-the-long-relay).

## Done means

Both branches are playable with legal actions; every stage survives reload;
old saves behave identically until explicit opt-in; no reward can be doubled;
phone and keyboard users can find the next step; the ending recalls the actual
choice. The noncombat Return Drive route still works.

Automation can establish those functional gates. Human observation must establish
whether players care: aim for four of five new players finding the next objective
without help and at least three recalling a person's response. If testers are
not available, publish only with that evidence gap stated; do not claim the
interest target is achieved. Fix confusion before expanding the arc system.

## After this slice — current priorities

Use what players remember to guide the next work: crew progression and one rescue
follow-up, then the first faction-linked arc. Add tactical enemies/role abilities
and directional animation once they support those situations. Broad release also
requires long-journal safety, performance measurement and complete-run playtests.

## Completion notes

The implementation lives in `src/engine/exploration/arcs.ts`, with persistent state and action validation in `campaign.ts`; dialogue and the active objective are in `src/ui/LongRelay.tsx`. The canonical save envelope is version 8. Both resource branches, legal travel, reloading and completion are covered by `tests/long-relay.test.ts` and `e2e/long-relay.spec.ts`. No old voyage starts the arc without the player's decision.

The next content milestone should be a **rescue-survivor callback** that makes an earlier crew extraction matter later in the galaxy, followed by one faction-linked encounter. For combat visual quality, track [cinematic combat work](https://github.com/henders23/starship-explorer/issues/18). These should remain optional until the previous stage has been playtested for comprehension.
