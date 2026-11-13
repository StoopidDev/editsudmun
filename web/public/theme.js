// Sets the theme class before first paint so a dark user never sees a white flash. Same-origin file: CSP script-src 'self'.
try {
  const t = localStorage.getItem('theme')
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
} catch { /* storage blocked: follow light default */ }
