import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Keycraft runtime error:', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen items-center justify-center p-6"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            color: 'var(--ink-primary)',
          }}
        >
          <div
            className="max-w-md rounded-2xl p-8 text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
            }}
          >
            <h1 className="text-xl font-bold tracking-tight">
              Something went wrong
            </h1>
            <p
              className="mt-2 text-sm"
              style={{ color: 'var(--ink-muted)' }}
            >
              A local state error interrupted the studio. Reloading will restore
              your saved themes and history.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="keycap-accent mt-6 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Reload Keycraft
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
