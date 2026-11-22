import { Component, type ErrorInfo, type ReactNode } from "react"
import { RotateCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI crashed:", error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="container-page grid min-h-[70dvh] place-items-center py-16">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-lift">
          <TriangleAlert className="mx-auto size-10 text-serious" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-semibold">Something slipped.</h1>
          <p className="mt-3 text-muted-foreground">
            The page hit an unexpected problem. Nothing you did caused it — give it another go.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={this.retry}><RotateCw aria-hidden="true" />Try again</Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}>Back to home</Button>
          </div>
        </div>
      </div>
    )
  }
}
