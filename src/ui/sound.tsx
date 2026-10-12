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

export function MuteButton({ className = 'exp-button' }: { className?: string }) {
  const muted = useSound((s) => s.muted)
  const toggle = useSound((s) => s.toggle)
  return (
    <button type="button" className={`${className} mute-toggle`} onClick={toggle}>
      {muted ? 'Unmute sound' : 'Mute sound'}
    </button>
  )
}
