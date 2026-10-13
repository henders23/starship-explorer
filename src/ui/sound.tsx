import { create } from 'zustand'
import { browserStorage } from './save.js'

const MUTE_KEY = 'starship-ithaca-muted'

function readMuted(): boolean {
  try {
    return browserStorage()?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** The player's sound preference: one switch for the theme and ship ambience. */
export const useSound = create<{ muted: boolean; toggle: () => void }>((set, get) => ({
  muted: readMuted(),
  toggle: () => {
    const muted = !get().muted
    try {
      browserStorage()?.setItem(MUTE_KEY, muted ? '1' : '0')
    } catch {
      /* the choice lasts for this visit */
    }
    set({ muted })
  },
}))

export function MuteButton({ className = 'exp-button', icon = false }: { className?: string; icon?: boolean }) {
  const muted = useSound((s) => s.muted)
  const toggle = useSound((s) => s.toggle)
  const label = muted ? 'Unmute sound' : 'Mute sound'
  if (icon) return (
    <button type="button" className="exp-icon-button mute-toggle" onClick={toggle} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}
      </svg>
    </button>
  )
  return (
    <button type="button" className={`${className} mute-toggle`} onClick={toggle}>
      {label}
    </button>
  )
}
