import { useEffect, useRef, useState } from 'react'

/**
 * Escape dismisses a dialog, and closing it returns focus to whatever opened
 * it. Call from the component that is mounted only while the dialog is open.
 */
export function useDialogDismiss(onDismiss: () => void) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  // Read during the first render, before any effect moves focus into the dialog.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      dismiss.current()
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      // Leave focus alone if it has already moved somewhere deliberate.
      const active = document.activeElement
      const stray = !active || active === document.body || !!active.closest('[role=dialog]')
      if (stray && opener?.isConnected && !opener.closest('[inert]')) opener.focus()
    }
  }, [opener])
}
