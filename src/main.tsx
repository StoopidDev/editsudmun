import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-thai'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}>
    <App />
    <Toaster position="bottom-center" theme="light" />
  </QueryClientProvider>,
)
