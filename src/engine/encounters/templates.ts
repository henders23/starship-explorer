import type { Officer, OfficerRole } from '../crew/types.js'
import { dominantSite, type Site } from '../missions/sites.js'
import type { Clue, ClueSourceKind } from '../mystery/types.js'
import { createRng, type Rng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { StarSystem } from '../worldgen/types.js'
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
  ],
  options: () => [
    { id: 'plan', label: 'Plan the entry', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Log the signal and stand off', effect: { kind: 'dismiss' } },
  ],
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
 * Cast the scene for the ship's current position, or null when the system
 * holds nothing (searched systems and empty space stay quiet on purpose —
 * silence has to keep meaning something).
 */
export function castScene(state: GameState, systemId: string): SceneInstance | null {
  if (state.searched.includes(systemId)) return null
  const clues = cluesWaitingAt(state, systemId)
  if (clues.length === 0) return null

  const system = state.galaxy.systems.find((s) => s.id === systemId)
  if (!system) return null

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
  const beats = rng.pick(template.variants)(ctx)

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
