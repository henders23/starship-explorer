/** High-detail recognition images appear only before combat. The room-targeting
 * silhouettes in combat deliberately retain their validated hitbox geometry. */
export const CONTACT_SHIP_ART: Readonly<Record<string,string>> = {
  'rust-queen': '/assets/ships/expedition-helios.webp',
  'carrion-jack': '/assets/ships/expedition-ironclad.webp',
  'reaver': '/assets/ships/expedition-cathedral.webp',
  'magpie': '/assets/ships/expedition-ghost.webp',
  'lance-cutter': '/assets/ships/expedition-ironclad.webp',
  'warden': '/assets/ships/expedition-cathedral.webp',
  'toll-barque': '/assets/ships/expedition-helios.webp',
  'ledger': '/assets/ships/expedition-helios.webp',
  'silent-blade': '/assets/ships/expedition-manta.webp',
  'umbra': '/assets/ships/expedition-manta.webp',
  'tithe': '/assets/ships/expedition-ghost.webp',
  'cantor': '/assets/ships/expedition-cathedral.webp',
  'reliquary': '/assets/ships/expedition-cathedral.webp',
  'sovereign': '/assets/ships/expedition-cathedral.webp',
}
export const contactArtForClass=(classId:string,fallback:string)=>CONTACT_SHIP_ART[classId]??fallback
