/**
 * The chart briefing: one slide, shown the first time the captain takes the
 * Galaxy station, and reachable afterwards from the "?" on the map controls.
 *
 * It exists because the chart is the one screen the game never explains in
 * dialogue — the crew brief you on the mission, not on how to read an
 * instrument they assume you have used all your life. This is that
 * assumption, written down: what the marks mean, how to move, what the rail
 * does. It teaches navigation only. Nothing here is a hint about the answer.
 */
const GUIDE_KEY = 'starship-explorer-map-guide-seen'

/** Whether this browser has already been shown the chart briefing. */
export function guideSeen(storage: Storage = window.localStorage): boolean {
  try {
    return storage.getItem(GUIDE_KEY) === '1'
  } catch {
    // Private modes can refuse storage entirely; a briefing every time is a
    // far smaller failure than a chart that will not open.
    return false
  }
}

export function markGuideSeen(storage: Storage = window.localStorage): void {
  try {
    storage.setItem(GUIDE_KEY, '1')
  } catch {
    /* nothing to do: the briefing simply shows again next voyage */
  }
}

export function MapGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="guide-veil" role="dialog" aria-modal="true" aria-labelledby="map-guide-title">
      <div className="guide-card">
        <div className="guide-kicker">Astrogation · standing orders</div>
        <h2 id="map-guide-title">Reading the chart</h2>
        <p className="guide-lede">
          Ninety stars, and exactly one of them is the way home. The chart does not know which —
          it only shows you which ones your accounts still allow.
        </p>

        <div className="guide-columns">
          <section>
            <h3>The marks</h3>
            <ul>
              <li>
                <GuideMark>
                  <circle cx={9} cy={9} r={5.6} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} />
                  <circle cx={9} cy={9} r={2.2} fill="var(--color-phosphor)" />
                </GuideMark>
                <span>
                  <strong>Consistent</strong> — still fits every account you trust.
                </span>
              </li>
              <li>
                <GuideMark>
                  <circle cx={9} cy={9} r={4} fill="none" stroke="var(--color-ink-faint)" strokeWidth={0.9} />
                  <circle cx={9} cy={9} r={1.6} fill="var(--color-ink-faint)" />
                </GuideMark>
                <span>
                  <strong>Ruled out</strong> — kept on the chart, because knowing what you have
                  eliminated is half of knowing anything.
                </span>
              </li>
              <li>
                <GuideMark>
                  <circle cx={9} cy={9} r={6.5} fill="none" stroke="var(--color-amber)" strokeWidth={0.9} strokeDasharray="2.5 3" />
                  <circle cx={9} cy={9} r={2} fill="var(--color-amber)" />
                </GuideMark>
                <span>
                  <strong>Evidence</strong> — something waits there. Fly to it and respond to
                  collect the account.
                </span>
              </li>
              <li>
                <GuideMark>
                  <rect x={5.5} y={5.5} width={7} height={7} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} transform="rotate(45 9 9)" />
                </GuideMark>
                <span>
                  <strong>Specialist</strong> — someone dockside is looking for a berth.
                </span>
              </li>
              <li>
                <GuideMark>
                  <path d="M 9 2 L 15 9 L 9 16 L 3 9 Z" fill="none" stroke="var(--color-amber)" strokeWidth={1.2} />
                </GuideMark>
                <span>
                  <strong>The Ithaca</strong> — where you are. Lanes run between stars; fuel is
                  spent by the lane.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3>Moving about</h3>
            <ul className="guide-keys">
              <li><kbd>drag</kbd><span>pan the chart</span></li>
              <li><kbd>scroll</kbd><span>zoom in and out</span></li>
              <li><kbd>+</kbd><kbd>−</kbd><span>zoom by steps</span></li>
              <li><kbd>0</kbd><span>reset the view</span></li>
              <li><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd><span>step to the next star that way</span></li>
              <li><kbd>click</kbd><span>select a star</span></li>
              <li><kbd>⌕</kbd><span>find a star by name</span></li>
              <li><kbd>1</kbd>–<kbd>4</kbd><span>switch stations</span></li>
            </ul>
          </section>

          <section>
            <h3>The rail below</h3>
            <p>
              The <strong>left</strong> reads out the selected star: its catalogue entry, whether
              your plot still allows it, and whether anything waits there.
            </p>
            <p>
              The <strong>middle</strong> lists the stars still standing. Every name on it is a
              chip you can click to fly the selection straight there.
            </p>
            <p>
              The <strong>right</strong> is what the ship can do: travel the lanes, answer a
              contact, or — once the drive and the shield are built — commit the Long Jump.
            </p>
            <p>
              <strong>Evidence</strong> raises the drawer of accounts. Trust one and the field
              narrows; doubt one and it widens again. Some of them are lies.
            </p>
          </section>
        </div>

        <div className="guide-foot">
          <button onClick={onClose} className="guide-go">Take the chart</button>
          <span className="guide-hint">The “?” beside the zoom brings this back.</span>
        </div>
      </div>
    </div>
  )
}

function GuideMark({ children }: { children: React.ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
      {children}
    </svg>
  )
}
