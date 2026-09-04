import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React boundary error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-background">
          <div className="bg-surface p-8 rounded-3xl border border-outline-variant shadow-elevation-3 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-alert-rose-container text-on-alert-rose-container flex items-center justify-center mx-auto mb-4 border border-alert-rose/20">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-xl font-extrabold text-on-surface mb-2">Something went wrong</h3>
            <p className="text-xs text-on-surface-variant mb-6 font-medium leading-relaxed">
              {this.state.error?.message || 'A temporary error occurred while rendering this page.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-3 px-6 bg-primary hover:bg-primary-hover text-on-primary font-extrabold text-sm rounded-xl transition-all shadow-elevation-1 active:scale-95"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
