import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MemberLoadErrorProps {
  message?: string;
  onRetry: () => void;
  compact?: boolean;
}
export function MemberLoadError({
  message = 'We couldn’t load this right now. Please try again.',
  onRetry,
  compact = false,
}: MemberLoadErrorProps) {
  return (
    <div className={compact ? 'glass-card px-4 py-5 text-center' : 'empty-state glass-card'} role="alert">
      <div className={compact ? 'mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground' : 'empty-state-icon'}>
        <WifiOff className="h-5 w-5" />
      </div>
      <p className="empty-state-title">Connection interrupted</p>
      <p className="empty-state-desc mx-auto mt-1 max-w-sm">{message}</p>
      <Button type="button" variant="outline" onClick={onRetry} className="mt-4 h-11 rounded-xl gap-2">
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
