import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { APP_VERSION } from '../version';

interface Props {
  children: ReactNode;
  /** Changing this value clears a caught error (we pass the route pathname). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  copied: boolean;
}

/**
 * Catches render-time crashes in the routed page and shows a recovery screen
 * instead of letting React unmount the whole tree to a blank white page.
 *
 * This wraps the <Outlet /> only, so the header and navigation stay mounted —
 * a user who hits a crash can always navigate away without restarting the app.
 * Navigating to a different route clears the error automatically.
 *
 * The details block matters: a bare `error.message` (all this used to show) is
 * often not enough to identify the failing component from a user's screenshot.
 * We also record the error NAME — which distinguishes a SyntaxError from a
 * TypeError and so points at a completely different cause — plus the React
 * component stack, and offer one-tap copy so it can be pasted into a bug report.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    // Full detail to the console for anyone with devtools open.
    console.error('[ErrorBoundary] Page crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // A route change is a fresh start — drop the previous page's error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: null, copied: false });
    }
  }

  /** Everything a maintainer needs to locate the fault, as plain text. */
  private details(): string {
    const { error, componentStack } = this.state;
    return [
      `Nail Tracker v${APP_VERSION}`,
      `Page: ${window.location.pathname}`,
      `Error: ${error?.name}: ${error?.message}`,
      '',
      'Stack:',
      error?.stack ?? '(none)',
      '',
      'Component stack:',
      componentStack ?? '(none)',
    ].join('\n');
  }

  private copy = () => {
    navigator.clipboard
      .writeText(this.details())
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch(() => {
        /* clipboard blocked — the details are on screen and in the console */
      });
  };

  render() {
    const { error, copied } = this.state;
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
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => this.setState({ error: null, componentStack: null })}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => { window.location.href = '/'; }}>
            Go to home
          </Button>
          <Button variant="secondary" onClick={this.copy}>
            {copied ? 'Copied' : 'Copy error details'}
          </Button>
        </div>

        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-center text-xs text-gray-400 hover:text-gray-600">
            Technical details
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-left font-mono text-[11px] leading-relaxed text-gray-600">
            {this.details()}
          </pre>
        </details>
      </div>
    );
  }
}
