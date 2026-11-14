import { QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@fontsource-variable/anuphan'
import '@fontsource-variable/noto-sans-thai'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemedToaster } from './components/ThemedToaster'
import { queryClient } from './lib/queryClient'
import { router } from './router'
import './index.css'

// After a deploy an open tab asks for chunk files that no longer exist: reload once to get the new index.html.
window.addEventListener('vite:preloadError', (e) => {
  if (!navigator.onLine) return // offline is not a deploy: let the import fail and the caller show its error
  e.preventDefault()
  try {
    const last = Number(sessionStorage.getItem('chunk-reload') ?? 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem('chunk-reload', String(Date.now()))
  } catch { /* storage blocked: still reload once per page */ }
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
    <ThemedToaster />
  </QueryClientProvider>,
)
