import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { toast } from 'sonner'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-thai'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemedToaster } from './components/ThemedToaster'
import { router } from './router'
import { UploadProvider } from './lib/uploads'
import './index.css'

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (e) => toast.error(e.message) }),
  defaultOptions: { queries: { retry: false } },
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <UploadProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </UploadProvider>
    <ThemedToaster />
  </QueryClientProvider>,
)
