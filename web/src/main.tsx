import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { toast, Toaster } from 'sonner'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-thai'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(e.message) }),
  defaultOptions: { queries: { retry: false } },
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster position="bottom-center" theme="light" />
  </QueryClientProvider>,
)
