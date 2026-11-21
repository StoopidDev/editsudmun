import { Toaster } from 'sonner'
import { useTheme } from '@/lib/theme'

// Sonner takes a theme string, so the toaster follows the page's theme class.
export function ThemedToaster() {
  const dark = useTheme()
  return (
    <Toaster position="bottom-center" theme={dark ? 'dark' : 'light'} mobileOffset={{ bottom: 80 }}
      toastOptions={{ classNames: {
        toast: 'rounded-card! border-line! bg-toast! font-sans! text-ink! shadow-md!',
        description: 'text-sub!',
        actionButton: 'rounded-md! bg-brand! font-medium! text-white!',
        cancelButton: 'rounded-md! bg-chip! text-ink!',
      } }} />
  )
}
