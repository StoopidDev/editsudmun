// The letter on the physical key, so Ctrl+S and Ctrl+B still work while a Thai layout is active (there e.key is a Thai character). Latin layouts keep what the key prints.
export const shortcutKey = (e: Pick<KeyboardEvent, 'key' | 'code'>) =>
  /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : ''

// A modal dialog is open: page-level shortcuts and file drops must not act on the form behind it.
export const dialogOpen = () => !!document.querySelector('[data-slot="dialog-content"]:not([data-closed])')
