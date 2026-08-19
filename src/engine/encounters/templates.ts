import type { Officer, OfficerRole } from '../crew/types.js'
import { dominantSite, type Site } from '../missions/sites.js'
import type { Clue, ClueSourceKind } from '../mystery/types.js'
import { createRng, type Rng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { RegionId, StarSystem } from '../worldgen/types.js'
import type { SceneBeat, SceneFigure, SceneInstance, SceneOption } from './types.js'

/**
 * The scene templates and the caster.
 *
 * Templates are authored; the seed casts them. A template family exists per
 * kind of content — trader, archive, castaway, crew memory, and one per
 * hazardous site type — and each family carries beat variants so repeat
 * encounters do not read identically. Casting is a pure function of the
 * game state: the same seed and the same arrival always play the same scene.
 */

interface CastContext {
  system: StarSystem
  clues: Clue[]
  site: Site | null
  /** Short address forms per role, e.g. "Lt. Novak"; falls back to the role. */
  officer: Record<OfficerRole, string>
  figure: SceneFigure | null
  rng: Rng
}

interface SceneTemplate {
  id: string
  /** Casts the outside party, if the family has one. */
  figure?: (rng: Rng) => SceneFigure
  /** Beat variants; the rng picks one. */
  variants: Array<(ctx: CastContext) => SceneBeat[]>
  options: (ctx: CastContext) => SceneOption[]
}

const shortName = (officer: Officer | undefined, fallback: string): string => {
  if (!officer) return fallback
  const parts = officer.name.split(' ')
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : officer.name
}

const account = (ctx: CastContext): string =>
  ctx.clues.length === 1 ? 'an account' : `${ctx.clues.length} accounts`

/**
 * Region flavour (R9): a clause of local weather the narrator can weave in,
 * so the same family reads differently in different parts of the sky.
 */
const REGION_FLAVOUR: Record<RegionId, string> = {
  shallows: 'out here in the Shallows, where traffic is a rumour and the lanes run quiet',
  'trade-reach': 'deep in the Trade Reach, with dock chatter crowding every open band',
  'cinder-belt': 'in the Cinder Belt, under a sky the colour of old burns',
  xenoline: 'along the Xenoline, where nothing on the chart had a human name first',
  'rift-margin': 'hard against the Rift Margin, where the instruments never quite settle',
}

const where = (ctx: CastContext): string => REGION_FLAVOUR[ctx.system.region]

/* ------------------------------------------------------------------------ *
 * Social families — the evidence is handed over, on terms.
 * ------------------------------------------------------------------------ */

const TRADER_NAMES = ['Veth', 'Ilquen', 'Mosca', 'Harrow', 'Qeb', 'Andessa', 'Roul']
const ARCHIVIST_NAMES = ['Senn', 'Odrath', 'Calverine', 'Ipp', 'Maro']
const CASTAWAY_NAMES = ['Ede Varga', 'Tomas Reel', 'Sana Oduya', 'Piotr Ilyin', 'Merit Okonkwo']

const trader: SceneTemplate = {
  id: 'trader',
  figure: (rng) => ({ name: `Broker ${rng.pick(TRADER_NAMES)}`, label: 'Trader' }),
  variants: [
    (ctx) => [
      { speaker: null, text: `A trade barque hangs off ${ctx.system.name}'s outer marker, running its lights in the pattern that means open for business.` },
      { speaker: 'figure', text: `“The lost ship. Word travels, Captain. You are buying charts, rumours, the shape of the sky — and it happens I sell exactly that.”` },
      { speaker: 'science', text: `Off-channel: “They will have heard something real — brokers always do. Whether they sell it to us straight is another matter.”` },
      { speaker: 'figure', text: `“I hold ${account(ctx)} of the rift you are chasing. The price is reasonable. For you, only slightly inflated.”` },
    ],
    (ctx) => [
      { speaker: null, text: `Two hours out from ${ctx.system.name}, a small fast hull matches course without being asked, close enough to read the scorch marks on the Indefatigable's flank.` },
      { speaker: 'figure', text: `“That is rift-burn on your plating, Captain, and rift-burn means you are shopping for exactly one thing. I happen to stock it: ${account(ctx)}, provenance negotiable, accuracy — well. Ask around.”` },
      { speaker: 'security', text: `“They matched our course before we ever hailed. They wanted this meeting, Captain. Worth remembering when they name a price.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} keeps a licensed exchange — three docks, one tariff board, and a broker's stall that has already printed your ship's silhouette on its awning.` },
      { speaker: 'figure', text: `“I flagged your hull the day the relay net first carried it, Captain. Sentiment, partly. Business, mostly: I hold ${account(ctx)} touching your anomaly, catalogued and priced before you ever made orbit.”` },
      { speaker: 'medical', text: `Quietly: “They knew we were coming before we did, Captain. I would ask what else they know and who they sold it to — after we have bought our share.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The wideband at ${ctx.system.name} carries one voice, ${where(ctx)} — a broker's tender running a circuit no registry lists, its hold full of other people's knowledge.` },
      { speaker: 'figure', text: `“No stall, no stack, no tariff board — I carry my inventory in my head, Captain, which is why nobody has ever taxed it. I hold ${account(ctx)} of your rift, word-perfect. The price is what it always is.”` },
      { speaker: 'science', text: `“Memory traders survive on being right, Captain — a broker who misremembers is a broker nobody pays twice. I would hear them out.”` },
    ],
  ],
  options: () => [
    {
      id: 'pay',
      label: 'Pay their price',
      detail: '1 day · 4 fuel siphoned across',
      effect: { kind: 'collect', days: 1, fuel: 4 },
    },
    {
      id: 'haggle',
      label: 'Haggle it out of them',
      detail: `2 days alongside · costs nothing but time`,
      effect: { kind: 'collect', days: 2 },
    },
    { id: 'leave', label: 'Break contact', detail: 'The account stays theirs, for now', effect: { kind: 'dismiss' } },
  ],
}

const archive: SceneTemplate = {
  id: 'archive',
  figure: (rng) => ({ name: `Archivist ${rng.pick(ARCHIVIST_NAMES)}`, label: 'Faction archive' }),
  variants: [
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} keeps an archive — climate-sealed stacks in orbit, older than the faction that guards them.` },
      { speaker: 'figure', text: `“Your request has been noted. The stacks hold ${account(ctx)} touching on your anomaly. Access is a matter of procedure. Procedure is a matter of patience.”` },
      { speaker: 'security', text: `Quietly: “Or a matter of what we are willing to hand the doorkeeper, Captain.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The registry at ${ctx.system.name} answers the hail with a queue number. Somewhere below, ${where(ctx)}, a reading room has held its silence for three hundred years.` },
      { speaker: 'figure', text: `“We are aware of your ship, your circumstances, and your urgency, Captain. The archive is aware of very little else — it holds ${account(ctx)} relevant to your filing, and it will surrender them in the order the forms allow.”` },
      { speaker: 'science', text: `“Archives this old index by accretion, Captain — the finding is the slow part, not the reading. Their procedure may genuinely be the fastest way through their own stacks.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name}'s archive was a warship once; the gun deck is a reading gallery now, and the fire-control room signs the visitor passes.` },
      { speaker: 'figure', text: `“Everything the old crews logged about your rift is bound in the after stacks — ${account(ctx)}, by our catalogue. The collection outlived the war and the navy both, Captain. It will outlast your patience too, unless we come to terms.”` },
      { speaker: 'medical', text: `“A warship that became a library, Captain. I have served on ships that made the opposite journey. I prefer this one.”` },
    ],
  ],
  options: () => [
    {
      id: 'formal',
      label: 'File the request and wait',
      detail: '2 days of procedure · costs nothing',
      effect: { kind: 'collect', days: 2 },
    },
    {
      id: 'consideration',
      label: 'A quiet consideration for the archivist',
      detail: '1 day · 3 fuel finds its way to their tender',
      effect: { kind: 'collect', days: 1, fuel: 3 },
    },
    { id: 'leave', label: 'Withdraw the request', effect: { kind: 'dismiss' } },
  ],
}

const castaway: SceneTemplate = {
  id: 'castaway',
  figure: (rng) => ({ name: rng.pick(CASTAWAY_NAMES), label: 'Castaway' }),
  variants: [
    (ctx) => [
      { speaker: null, text: `A distress transponder, decades out of date, chirps from a habitat module in a slow orbit around ${ctx.system.name}.` },
      { speaker: 'figure', text: `“You're — you came through it too, didn't you. The light that goes wrong. I can hear it in your drive note. Nobody else sounds like us.”` },
      { speaker: 'medical', text: `“Alive, alone, and talking, Captain. Whatever they know, they have had years to think about it.”` },
      { speaker: 'figure', text: `“I kept records. ${account(ctx)}, everything I could fix about where the rift touches. Come alongside and it is yours — I only want the company.”` },
    ],
    (ctx) => [
      { speaker: null, text: `A lifeboat rides a powered-down orbit at ${ctx.system.name}, hull striped with patch-welds in a dozen mismatched alloys. Somebody has been keeping it alive by hand for a very long time.` },
      { speaker: 'figure', text: `“Careful on approach — the port thruster lies. You are the first hull I have seen ${where(ctx)} in six years, and the first ever that sounds like mine did. You came through it. So you will want what I know.”` },
      { speaker: 'security', text: `“One lifeboat, one heat signature, no weapons live, Captain. Whatever they are guarding, it is not an ambush.”` },
      { speaker: 'figure', text: `“${account(ctx)}, kept the old way — written down. Ink does not corrupt when the light goes wrong. Come and read.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The habitable world at ${ctx.system.name} has one fire burning on its night side, and the fire is arranged in a signal square older than any code aboard.` },
      { speaker: 'medical', text: `“That is a distress layout from the first survey era, Captain. Whoever set it learned it a lifetime ago — and has kept lighting it.”` },
      { speaker: 'figure', text: `“I stopped counting the years when the counting got heavy. But I never stopped watching the sky, and the sky out here does things I can name for you — ${account(ctx)}, if you will sit with an old wreck while they tell it.”` },
    ],
  ],
  options: () => [
    {
      id: 'aboard',
      label: 'Bring them aboard',
      detail: '2 days · they talk freely over mess rations',
      effect: { kind: 'collect', days: 2 },
    },
    {
      id: 'airlock',
      label: 'Keep it to airlock range',
      detail: '1 day · guarded answers, but answers',
      effect: { kind: 'collect', days: 1 },
    },
    { id: 'leave', label: 'Log the contact and stand off', effect: { kind: 'dismiss' } },
  ],
}

const memory: SceneTemplate = {
  id: 'memory',
  variants: [
    (ctx) => [
      { speaker: null, text: `Nothing hails the ship at ${ctx.system.name}. The prompt comes from inside it.` },
      { speaker: 'science', text: `“Captain — this system. I have seen this sky before, or something near it. Give me a watch with the old survey logs and I will have it pinned down.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} resolves in the forward ports, and somebody on the bridge goes quiet mid-sentence.` },
      { speaker: 'science', text: `“That configuration — I have read about this place, Captain. Before we were taken. Let me work it up properly; memory is evidence if you treat it carefully.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The night watch logs it first: a junior rating standing too long at the mess viewport, ${where(ctx)}, sketching the starfield on a ration wrapper from memory.` },
      { speaker: 'medical', text: `“They came to me about the dreams before they came to anyone about the sketch, Captain. It is not trauma. It is recall — this sky matches a chart they memorised in another life, and it is trying to surface.”` },
      { speaker: 'science', text: `“Then we surface it properly — controlled sessions, cross-checked against the survey library. Done carefully, a remembered chart is as good as a bought one.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} is on no chart aboard — but the ship's own survey library flags a partial match, buried in an appendix nobody has opened since the anomaly.` },
      { speaker: 'science', text: `“Somebody aboard annotated this appendix years ago, Captain, and the hand is one of ours. Between the margin notes and what they still remember, there is a real account of this sky waiting to be assembled.”` },
    ],
  ],
  options: () => [
    {
      id: 'recall',
      label: 'Give them the watch',
      detail: '1 day · the recollection goes on the plot',
      effect: { kind: 'collect', days: 1 },
    },
    { id: 'later', label: 'Not now', effect: { kind: 'dismiss' } },
  ],
}

/* ------------------------------------------------------------------------ *
 * Hazardous families — the evidence is defended; the option is the mission.
 * ------------------------------------------------------------------------ */

const derelict: SceneTemplate = {
  id: 'derelict',
  variants: [
    (ctx) => [
      { speaker: null, text: `The contact at ${ctx.system.name} is a ship, and the ship is dead — cold hull, no rotation, running lights burned out years ago.` },
      { speaker: 'security', text: `“No power, no gravity, unknown structural state. And a log core somewhere in the dark that knew this sky before we did.”` },
      { speaker: 'science', text: `“If the core survived, it is worth the walk, Captain. Wrecks keep honest records.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name}'s debris field has a centre: a hulk, holed and silent, keeping station where its crew left it.` },
      { speaker: 'security', text: `“I have cut into wrecks like this before. It goes fine right up until it doesn't. My team, my order of entry.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The wreck at ${ctx.system.name} died under way: drive plume shadows are burned into the hull ahead of the breach, ${where(ctx)}. She was running from something when it caught her.` },
      { speaker: 'science', text: `“A ship that was running kept logs of what it was running from, Captain. That core is testimony. We should go and hear it.”` },
      { speaker: 'security', text: `“And whatever holed her did it fast and clean. I want that noted before anyone calls this wreck safe.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the boarding', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Stand off', detail: 'The wreck keeps its log a while longer', effect: { kind: 'dismiss' } },
  ],
}

const ruins: SceneTemplate = {
  id: 'ruins',
  variants: [
    (ctx) => [
      { speaker: null, text: `The survey pass over ${ctx.system.name} finds right angles where geology makes none: stonework, half-buried, older than anyone's species.` },
      { speaker: 'science', text: `“There is writing down there, Captain. Inscriptions do not lie about what their makers saw — though reading them is my problem, and getting me to them is yours.”` },
      { speaker: 'security', text: `“Unstable galleries, unknown ground. If we go, we go carefully.”` },
    ],
    (ctx) => [
      { speaker: null, text: `From orbit the structures at ${ctx.system.name} read as a single carved line kilometres long, ${where(ctx)} — an inscription meant to be legible from space, and it very nearly still is.` },
      { speaker: 'science', text: `“Whoever wrote at that scale wanted the sky itself to read it, Captain. The weathered sections will need close work at the base — that means boots on the ground, and mine among them.”` },
      { speaker: 'medical', text: `“Masonry that old goes without warning. I will have the medbay standing by, and I would rather stand by bored.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The ruins at ${ctx.system.name} are underwater — a drowned precinct in a shallow tidal sea, its galleries flooding and draining twice a day.` },
      { speaker: 'science', text: `“The water preserved the inscriptions and killed every expedition shortcut, Captain. There is a window at low tide when the inner chamber drains. We work inside it, or we do not work.”` },
      { speaker: 'security', text: `“A clock on the mission before we even land. Wonderful. Team stays roped, nobody chases artefacts into a filling gallery.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the expedition', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Mark it and stand off', effect: { kind: 'dismiss' } },
  ],
}

const holdout: SceneTemplate = {
  id: 'holdout',
  variants: [
    (ctx) => [
      { speaker: null, text: `Somebody answers the hail at ${ctx.system.name} — with a warning shot across the wideband and a demand to keep distance.` },
      { speaker: 'security', text: `“Barricaded, armed, and frightened, Captain. Frightened people know things. How they come out depends entirely on how we go in.”` },
      { speaker: 'medical', text: `“If there are wounded in there — and there are always wounded — that is a door that opens from our side.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The mining habitat at ${ctx.system.name} has sealed its docking ring from the inside. Through the wideband static, ${where(ctx)}, a voice counts off a perimeter warning on a loop — tired, young, and armed.` },
      { speaker: 'security', text: `“That warning has been running so long the voice has gone hoarse recording new ones, Captain. They have been under siege before — real or imagined — and they will treat us as the next one.”` },
      { speaker: 'medical', text: `“Hoarse, exhausted, frightened. Every one of those is a door, Captain, if we knock on it right.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name}'s survivors hold a gutted orbital yard — floodlights on the approaches, welded plate over every window, and a flag nobody recognises painted across the main doors.` },
      { speaker: 'science', text: `“They have watched the rift do things from that yard nobody civilised has records of, Captain. What they know, they earned by staying. It will not be handed over lightly.”` },
      { speaker: 'security', text: `“A defended yard has exactly as many ways in as its defenders have forgotten about. Give me an hour with the schematics before you choose how we do this.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the approach', detail: 'Choose the team and how you go in', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Keep our distance', effect: { kind: 'dismiss' } },
  ],
}

const listeningPost: SceneTemplate = {
  id: 'listening-post',
  variants: [
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} is transmitting. Not to the ship — to nobody. An automated station, old and powered, repeating itself into the dark.` },
      { speaker: 'science', text: `“That loop has structure, Captain. Somebody built this thing to listen to the rift, and it has been listening a very long time.”` },
      { speaker: 'security', text: `“Old, powered, and possibly rigged against exactly the kind of visit we are about to pay it.”` },
    ],
    (ctx) => [
      { speaker: null, text: `Three antenna spines rise off the ice moon at ${ctx.system.name}, ${where(ctx)}, all three aimed at the same empty point in the sky. The station beneath them still draws power. Nothing has answered it in centuries.` },
      { speaker: 'science', text: `“It is not broadcasting, Captain — it is asking. The same question, on the same schedule, aimed at the same coordinates. I want to know what it has heard back, and the answer lives in that core.”` },
      { speaker: 'security', text: `“Automated stations keep automated grudges. We sweep the approaches before anyone touches the question machine.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The signal at ${ctx.system.name} hides inside the pulsar's own beat — a listening post built to whisper under the loudest thing in the sky, by somebody who very much did not want to be found.` },
      { speaker: 'security', text: `“Concealment that deliberate means defences to match, Captain. Whoever hid it expected visitors with bad intentions and prepared for them.”` },
      { speaker: 'science', text: `“And it has sat here recording the rift under perfect cover ever since. That archive will be pristine. It is worth a careful walk, Captain.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the entry', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Log the signal and stand off', effect: { kind: 'dismiss' } },
  ],
}

/* ------------------------------------------------------------------------ *
 * Recruitment — somebody at the station wants a berth.
 * ------------------------------------------------------------------------ */

const RECRUIT_PITCH: Record<string, { intro: string; pitch: string }> = {
  gunnery: {
    intro: 'is leaning on the dock rail watching your gun mounts with a professional eye',
    pitch:
      '“Those mounts are laid a half-degree lazy, Captain — I could see it from the dock. I have run fire control on three hulls and outlived all of them. Take me on and your volleys land harder. That is the whole speech.”',
  },
  research: {
    intro: 'finds your science officer first, and the two of them are already arguing methodology',
    pitch:
      '“Your bench is doing months of work with one pair of hands, Captain. I have done rift-adjacent research since before it was survivable. Take me on and everything on that bench finishes sooner.”',
  },
  comms: {
    intro: 'addresses your comms array in three languages before switching, politely, to yours',
    pitch:
      '“Every script in this sector, Captain — I read them the way you read a fuel gauge. Whatever your matrix chews on for a day, I do while the kettle boils. And I would very much like to be somewhere else.”',
  },
}

/** Cast per site from state.recruits; not part of the static family tables. */
function recruitScene(state: GameState, systemId: string, system: StarSystem): SceneInstance {
  const specialist = state.recruits.sites[systemId]!
  const flavour = RECRUIT_PITCH[specialist.focus]!
  const figure: SceneFigure = {
    name: specialist.name,
    label: 'Looking for a berth',
    portrait: specialist.portrait,
  }
  return {
    at: systemId,
    templateId: 'recruit',
    figure,
    beats: [
      {
        speaker: null,
        text: `Dockside at ${system.name}, somebody ${flavour.intro}.`,
      },
      { speaker: 'figure', text: flavour.pitch },
    ],
    options: [
      {
        id: 'sign',
        label: `Take ${specialist.name} on`,
        detail: '1 day of orientation · their bonus is permanent',
        effect: { kind: 'recruit' },
      },
      { id: 'decline', label: 'Wish them luck ashore', effect: { kind: 'dismiss' } },
    ],
  }
}

/* ------------------------------------------------------------------------ */

const SOCIAL_FAMILIES: Partial<Record<ClueSourceKind, SceneTemplate>> = {
  'alien-trader': trader,
  'faction-archive': archive,
  castaway,
  'crew-memory': memory,
}

const SITE_FAMILIES: Record<string, SceneTemplate> = {
  derelict,
  ruins,
  holdout,
  'listening-post': listeningPost,
}

function cluesWaitingAt(state: GameState, systemId: string): Clue[] {
  return state.mystery.clues.filter(
    (clue) => clue.source.at === systemId && !state.collected.includes(clue.id),
  )
}

/**
 * The template family a system's evidence casts, judged from the run's
 * static clue placement (collected or not), so the answer never shifts
 * mid-run.
 */
function familyIdFor(state: GameState, systemId: string): string | null {
  const clues = state.mystery.clues.filter((c) => c.source.at === systemId)
  if (clues.length === 0) return null
  const site = dominantSite(clues.map((c) => c.source.kind))
  if (site) return SITE_FAMILIES[site.type]!.id
  return (SOCIAL_FAMILIES[clues[0]!.source.kind] ?? castaway).id
}

/**
 * Variant rotation (R9): each system that casts a family gets that family's
 * next variant in a fixed order, so one run never replays the same beats
 * until a family has more systems than the pool holds. Pure per seed — the
 * ordinal comes from the static clue placement, so replays are unaffected
 * by collection order.
 */
function variantIndex(state: GameState, templateId: string, systemId: string, count: number): number {
  const systems = new Set<string>()
  for (const clue of state.mystery.clues) systems.add(clue.source.at)
  const family = [...systems].filter((id) => familyIdFor(state, id) === templateId).sort()
  const ordinal = family.indexOf(systemId)
  return ordinal < 0 ? 0 : ordinal % count
}

/**
 * Cast the scene for the ship's current position, or null when the system
 * holds nothing (searched systems and empty space stay quiet on purpose —
 * silence has to keep meaning something).
 */
export function castScene(state: GameState, systemId: string): SceneInstance | null {
  const system = state.galaxy.systems.find((s) => s.id === systemId)
  if (!system) return null

  const clues = state.searched.includes(systemId) ? [] : cluesWaitingAt(state, systemId)
  if (clues.length === 0) {
    // No evidence (left) here — but a station may still hold a recruit.
    if (state.recruits.sites[systemId]) return recruitScene(state, systemId, system)
    return null
  }

  const site = dominantSite(clues.map((c) => c.source.kind))
  const template = site
    ? SITE_FAMILIES[site.type]!
    : (SOCIAL_FAMILIES[clues[0]!.source.kind] ?? castaway)

  const rng = createRng(`${state.seed}:scene:${systemId}`)
  const figure = template.figure ? template.figure(rng) : null

  const officer = {} as Record<OfficerRole, string>
  for (const role of ['captain', 'security', 'science', 'medical'] as OfficerRole[]) {
    officer[role] = shortName(state.roster.find((o) => o.role === role), `the ${role} officer`)
  }

  const ctx: CastContext = { system, clues, site, officer, figure, rng }
  const variant = variantIndex(state, template.id, systemId, template.variants.length)
  const beats = template.variants[variant]!(ctx)

  // A component waiting here is worth a line of its own: the science officer
  // flags it, so the player knows this stop feeds the technological track.
  for (const component of state.parts.sites[systemId] ?? []) {
    beats.push({
      speaker: 'science',
      text:
        component === 'engine'
          ? '“And Captain — the survey return shows drive machinery down there that no yard in this sector built. A core segment. If we are ever building the rift drive, we do not leave without it.”'
          : '“One more thing on the scan, Captain: lattice-work with rift-grade shielding signatures. A segment of exactly what the return transit needs. We do not leave without it.”',
    })
  }

  return {
    at: systemId,
    templateId: template.id,
    figure,
    beats,
    options: template.options(ctx),
  }
}
