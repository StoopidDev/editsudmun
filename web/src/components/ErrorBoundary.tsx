import { Component, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-base">เกิดข้อผิดพลาด กรุณารีเฟรชหน้า</p>
          <Button type="button" className="min-h-11" onClick={() => location.reload()}>
            <RotateCw />รีเฟรชหน้า
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
