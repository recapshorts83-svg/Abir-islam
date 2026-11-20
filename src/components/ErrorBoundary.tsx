import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#070b16] text-[#eaf0ff]">
          <div className="w-full max-w-md rounded-2xl vvp-card p-7 text-center space-y-4">
            <h1 className="text-xl font-bold text-[#eaf0ff]">Something went wrong</h1>
            <p className="text-sm text-[#98a5c8] break-words">
              Please reload the page or return to the home catalog.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold vvp-btn-primary"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium vvp-card text-[#eaf0ff] hover:bg-white/10"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
