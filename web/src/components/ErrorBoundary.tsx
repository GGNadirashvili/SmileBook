import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { failed: boolean }

/** Keeps a failing widget (e.g. the map) from blanking the whole page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State { return { failed: true } }
  componentDidCatch(error: unknown) { console.error('ErrorBoundary caught', error) }
  render() {
    if (this.state.failed) {
      return this.props.fallback ?? (
        <div className="grid h-full min-h-40 place-items-center rounded-2xl bg-white p-6 text-center text-muted ring-1 ring-line">
          რუკის ჩატვირთვა ვერ მოხერხდა. სია ჩვეულებრივ მუშაობს.
        </div>
      )
    }
    return this.props.children
  }
}
