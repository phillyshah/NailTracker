import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  /** Changing this value clears a caught error (we pass the route pathname). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes in the routed page and shows a recovery screen
 * instead of letting React unmount the whole tree to a blank white page.
 *
 * This wraps the <Outlet /> only, so the header and navigation stay mounted —
 * a user who hits a crash can always navigate away without restarting the app.
 * Navigating to a different route clears the error automatically via `resetKey`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Page crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // A route change is a fresh start — drop the previous page's error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle size={28} className="text-amber-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">This page didn&apos;t load</h2>
        <p className="mb-6 text-sm text-gray-500">
          Something went wrong displaying this page. Your data was not affected — any record you
          just saved was still saved.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="secondary" onClick={() => { window.location.href = '/'; }}>
            Go to home
          </Button>
        </div>
        <p className="mt-6 font-mono text-xs text-gray-400">{error.message}</p>
      </div>
    );
  }
}
