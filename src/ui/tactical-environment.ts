import type { Mission } from '../engine/tactical/mission.js'

/** Read-only scene treatment; does not modify cover, pathing, hit chances or mission saves. */
export type DeckMood = 'medical'|'freight'|'relay'|'archive'|'reactor'|'industrial'
export interface DeckStyle { key:DeckMood;name:string;accent:string;floor:string;light:string;warning:string }
export const DECK_STYLES:Record<DeckMood,DeckStyle>={
 medical:{key:'medical',name:'Medical annex',accent:'#a9ecda',floor:'#263f49',light:'#8be2dd',warning:'STERICARE / QUARANTINE'},
 freight:{key:'freight',name:'Industrial cargo deck',accent:'#e0bc7f',floor:'#40352c',light:'#eab376',warning:'CARGO / HAZARD'},
 relay:{key:'relay',name:'Uplink control gallery',accent:'#c9a2ed',floor:'#273746',light:'#9e7fe4',warning:'SIGNAL / SECURITY'},
 archive:{key:'archive',name:'Archive vault',accent:'#c8d0ee',floor:'#293348',light:'#93a9eb',warning:'RESTRICTED / ARCHIVE'},
 reactor:{key:'reactor',name:'Reactor and coolant section',accent:'#f4b19b',floor:'#49302c',light:'#f8a177',warning:'HEAT / HIGH VOLTAGE'},
 industrial:{key:'industrial',name:'Derelict recovery deck',accent:'#8fd8d9',floor:'#30434e',light:'#7cc4d3',warning:'REPAIR / ACCESS'},
}
export function deckStyle(m:Pick<Mission,'operation'|'recorder'>):DeckStyle {
 if(m.recorder)return DECK_STYLES.archive
 if(m.operation?.kind==='rescue')return DECK_STYLES.medical
 if(m.operation?.kind==='sabotage')return DECK_STYLES.relay
 if(m.operation?.kind==='salvage')return m.operation?.variant===5?DECK_STYLES.freight:DECK_STYLES.reactor
 return DECK_STYLES.industrial
}
