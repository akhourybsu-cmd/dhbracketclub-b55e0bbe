import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  resetKey: string;
}
interface State {
  hasError: boolean;
}

export class MemberRouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MemberRoute] render failed', error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-[70dvh] items-center justify-center px-4 py-10">
        <div className="glass-card w-full max-w-md p-7 text-center" role="alert">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">This page hit a snag</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Your account and saved information are safe. Reload this page, or return home and try again.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Reload
            </Button>
            <Button asChild className="h-11 rounded-xl">
              <a href="/dashboard"><Home className="h-4 w-4" /> Home</a>
            </Button>
          </div>
        </div>
      </main>
    );
  }
}
