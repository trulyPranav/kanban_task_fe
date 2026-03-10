import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
          <p className="text-[15px] font-semibold text-(--color-text-1)">Something went wrong</p>
          <p className="text-[13px] text-text-2 max-w-md text-center">{this.state.error.message}</p>
          <button
            className="h-8 px-4 rounded-lg bg-(--color-text-1) text-white text-[12px] font-medium cursor-pointer hover:bg-primary-hover transition-colors"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
