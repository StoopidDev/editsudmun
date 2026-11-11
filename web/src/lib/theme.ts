import { useSyncExternalStore } from 'react'

// The class is set before paint by public/theme.js; this module changes it later and reads it back.
const KEY = 'theme'
const root = () => document.documentElement

function stored(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function setTheme(dark: boolean) {
  const apply = () => root().classList.toggle('dark', dark)
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light') } catch { /* per-browser convenience only */ }
  // Ease the brightness jump: cross-fade the whole page, instant under reduced motion.
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply)
  else apply()
}

export function toggleTheme() {
  setTheme(!root().classList.contains('dark'))
}

function subscribe(notify: () => void) {
  const obs = new MutationObserver(notify)
  obs.observe(root(), { attributes: true, attributeFilter: ['class'] })
  // With no stored choice the page follows the system setting, live.
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const onSystem = () => { if (stored() === null) root().classList.toggle('dark', mq.matches) }
  mq.addEventListener('change', onSystem)
  return () => { obs.disconnect(); mq.removeEventListener('change', onSystem) }
}

export function useTheme(): boolean {
  return useSyncExternalStore(subscribe, () => root().classList.contains('dark'), () => false)
}
