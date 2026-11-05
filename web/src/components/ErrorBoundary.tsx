import { Component, type ReactNode } from 'react'

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
          <button
            type="button"
            className="min-h-11 rounded-[10px] bg-primary px-4 text-primary-foreground"
            onClick={() => location.reload()}
          >
            รีเฟรชหน้า
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
