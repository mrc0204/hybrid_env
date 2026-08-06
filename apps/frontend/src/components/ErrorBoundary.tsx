import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort catch for render-time exceptions. Without this, any unhandled
 * throw in the component tree (e.g. malformed API data slipping past a type
 * assertion) unmounts the whole app to a blank white page with no signal —
 * the worst possible failure mode mid-demo.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-void px-6 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-severity-high">
            Something went wrong
          </span>
          <p className="max-w-[360px] text-[13px] leading-relaxed text-ink-muted">
            {this.state.error.message || "The interface hit an unexpected error."}
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="mt-2 rounded-lg border border-line px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted transition-colors duration-200 hover:border-line-strong hover:text-ink"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
