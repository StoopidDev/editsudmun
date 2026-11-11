import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { toast, Toaster } from 'sonner'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-thai'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UploadProvider } from './lib/uploads'
import './index.css'

// A data router is what makes viewTransition work on Link and navigate.
const router = createBrowserRouter([{ path: '*', element: <App /> }])

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
    <Toaster position="bottom-center" theme="light" mobileOffset={{ bottom: 80 }} />
  </QueryClientProvider>,
)
