/** A report shows the actual situation, not the system backdrop. Stable event IDs keep imagery consistent in the captain's log. */
export interface ReportArtwork { src: string; alt: string; caption: string }
export const REPORT_ART: Record<string, ReportArtwork> = {
  'last-post': {src:'/assets/reports/silent-courier.webp',alt:'Abandoned courier drifting in shadow, its tiny transmitter lit',caption:'Courier / last signal'},
  'tethered-tug': {src:'/assets/reports/mining-tug.webp',alt:'Industrial mining tug caught by a taut cable among ore-laden asteroids',caption:'Mining tug / tether incident'},
  'winter-garden': {src:'/assets/reports/greenhouse.webp',alt:'Frost-coated abandoned spacecraft greenhouse, six small living trees under grow lights',caption:'Derelict / greenhouse bay'},
  'unfinished-map': {src:'/assets/reports/star-chart.svg',alt:'Navigation table with projected route lines ending at an annotated dust corridor',caption:'Navigator / incomplete route'},
  'rain-vault': {src:'/assets/reports/rain-vault.webp',alt:'Ancient subterranean water reservoir beneath bronze arches and pressure gauges',caption:'Installation / rain reservoir'},
  'night-orchestra': {src:'/assets/reports/night-towers.svg',alt:'Three long thin resonant towers standing over an ancient mechanism at twilight',caption:'Ruins / resonant towers'},
  'tidal-lights': {src:'/assets/reports/tidal-lights.svg',alt:'Luminous branching patterns glowing beneath an alien ocean surface',caption:'Ocean / bioluminescent tides'},
  'borrowed-minute': {src:'/assets/reports/temporal-probe.webp',alt:'Survey probe surrounded by a faint doubled holographic afterimage',caption:'Anomaly / probe telemetry'},
  'empty-chair': {src:'/assets/reports/settlement.webp',alt:'Alien settlement projects a luminous table with one empty place and a broken water filter',caption:'Outpost / request for assistance'},
  'long-watch': {src:'/assets/reports/cryopod.svg',alt:'A lone emergency cryopod in a damaged habitat beside a working heartbeat monitor',caption:'Distress signal / emergency capsule'},
  'long-relay': {src:'/assets/reports/relay-control.webp',alt:'Damaged relay control room with an active console and silent communications array',caption:'Relay station / broken link'},
  'survivor': {src:'/assets/reports/damaged-shuttle.webp',alt:'Small survey shuttle with a breached rear section and a weak rescue beacon',caption:'Survivor / last signal'},
  'boarding': {src:'/assets/exploration/mission-rescue.webp',alt:'A rescue team approaches a sealed derelict compartment',caption:'Away team / mission briefing'},
}
export function reportArtwork(id:string):ReportArtwork|null { return REPORT_ART[id] ?? null }
