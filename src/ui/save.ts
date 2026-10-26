/** The subset of `Storage` the save system touches, so tests can fake it. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * The browser's local storage, or null when the browser refuses it. With
 * site data blocked, merely reading `window.localStorage` throws, so every
 * caller goes through here rather than touching the property directly.
 */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
