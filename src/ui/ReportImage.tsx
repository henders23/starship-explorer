import { reportArtwork } from './report-art.js'

/** Small, reusable illustration within the event itself, never the system stage. */
export function ReportImage({ eventId, compact = false }: { eventId: string; compact?: boolean }) {
  const art = reportArtwork(eventId)
  if (!art) return null
  return <figure className={`report-dossier-art${compact ? ' compact' : ''}`} data-testid={`report-image-${eventId}`}>
    <img src={art.src} alt={art.alt} loading="lazy" />
    <figcaption><span className="exp-eyebrow">Scene reconstruction</span>{art.caption}</figcaption>
  </figure>
}
