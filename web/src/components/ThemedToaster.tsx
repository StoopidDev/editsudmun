import { Toaster } from 'sonner'
import { useTheme } from '@/lib/theme'

// Sonner takes a theme string, so the toaster follows the page's theme class.
export function ThemedToaster() {
  const dark = useTheme()
  return (
    <Toaster position="bottom-center" theme={dark ? 'dark' : 'light'} mobileOffset={{ bottom: 80 }}
      toastOptions={{ classNames: { toast: 'bg-toast!' } }} />
  )
}
