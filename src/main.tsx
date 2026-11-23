import React, { Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ============================================================================
// GOOGLE MAPS PLATFORM — TIER 1 IN-APP QUOTA / AUTH FAILURE DETECTION
// ============================================================================
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  if (
    args.some(
      (a) =>
        typeof a === 'string' &&
        (a.includes('OverQuotaMapError') || a.includes('QuotaExceededError'))
    )
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

// ============================================================================
// APPLICATION ERROR BOUNDARY (SURFACES FIRESTORE & RUNTIME ERRORS GRACEFULLY)
// ============================================================================
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    origConsoleError('Application ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let friendlyDetails = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendlyDetails = `${parsed.error} (Operation: ${parsed.operationType || 'unknown'}, Path: ${parsed.path || 'unknown'})`;
        }
      } catch {
        // Not JSON
      }

      return (
        <div className="min-h-screen bg-[#FFF8F1] text-[#3B2824] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E6D7C8] rounded-2xl p-8 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#B94E62] font-semibold mb-2">
              Lovey&apos;s Bakery &amp; Pizza Corners
            </p>
            <h1 className="font-serif text-2xl font-bold mb-3">
              We encountered a temporary issue
            </h1>
            <p className="text-sm text-[#6B544E] mb-4 leading-relaxed">
              {friendlyDetails}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.href = '/';
                }}
                className="px-5 py-2.5 rounded-xl bg-[#3B2824] text-[#FFF8F1] text-sm font-medium hover:bg-[#B94E62] transition-colors"
              >
                Return to Storefront
              </button>
              <a
                href="tel:+918090529971"
                className="px-5 py-2.5 rounded-xl border border-[#E6D7C8] text-[#3B2824] text-sm font-medium hover:bg-[#F5EBE1] transition-colors"
              >
                Call +91 80905 29971
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
