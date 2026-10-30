export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'everguide-theme'
const listeners = new Set<() => void>()

/** The theme on <html data-theme>; index.html sets it before the first paint. */
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#f8fafc' : '#0a0f1c')
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
  for (const listener of listeners) listener()
}

export function subscribeToTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
