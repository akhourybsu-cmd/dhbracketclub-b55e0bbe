import { useState } from 'react';
import { toast } from 'sonner';
import { Flag, Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { cn } from '@/lib/utils';

/** Platform switchboard: turn a feature on for everyone, or just for yourself. */
export default function AdminFeatureFlagsPage() {
  const { flags, loading, error, refresh, setEnabled, toggleMe, myFlags, userId } = useFeatureFlags();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>, successMessage: string) => {
    setBusyKey(key);
    try {
      await fn();
      toast.success(successMessage);
    } catch (err: any) {
      toast.error(err?.message || 'Could not update this flag');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AdminLayout title="Feature Flags" subtitle="Toggle modules and beta tools across the platform.">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground/80">
          {loading ? 'Loading…' : `${flags.length} ${flags.length === 1 ? 'flag' : 'flags'}`}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-2 h-9 rounded-lg border border-border/70 btn-press"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="glass-card p-4 mb-3 text-[12px]" style={{ color: 'hsl(0 84% 62%)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'hsl(var(--primary) / 0.14)', border: '1px solid hsl(var(--primary) / 0.22)' }}
          >
            <Flag className="w-5 h-5 text-primary" />
          </div>
          <p className="text-[13px] font-bold mb-1">No feature flags yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {flags.map(flag => {
            const onForMe = myFlags.has(flag.key);
            const inRollout = Boolean(userId && flag.rollout?.user_ids?.includes(userId));
            const rolloutCount = flag.rollout?.user_ids?.length ?? 0;
            const busy = busyKey === flag.key;
            return (
              <div key={flag.key} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold font-mono">{flag.key}</p>
                    {flag.description && (
                      <p className="text-[11px] text-muted-foreground/85 leading-snug mt-0.5">{flag.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {flag.enabled
                        ? 'On for everyone'
                        : rolloutCount > 0
                          ? `Early access for ${rolloutCount} ${rolloutCount === 1 ? 'person' : 'people'}`
                          : 'Off'}
                      {onForMe && ' · visible to you'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        flag.key,
                        () => setEnabled(flag.key, !flag.enabled),
                        flag.enabled ? `${flag.key} turned off` : `${flag.key} turned on for everyone`,
                      )
                    }
                    aria-label={flag.enabled ? 'Turn off for everyone' : 'Turn on for everyone'}
                    className={cn('w-12 h-7 rounded-full relative transition-colors shrink-0', flag.enabled ? 'bg-primary' : 'bg-muted')}
                  >
                    <span
                      className="absolute top-0.5 w-6 h-6 rounded-full bg-background transition-all"
                      style={{ left: flag.enabled ? 22 : 2 }}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={busy || !userId}
                  onClick={() =>
                    run(
                      flag.key,
                      () => toggleMe(flag.key),
                      inRollout ? 'Removed your early access' : 'Early access granted to you',
                    )
                  }
                  className="mt-3 w-full flex items-center justify-center gap-1.5 h-10 rounded-lg text-[11px] font-bold border border-border/70 btn-press"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {inRollout ? 'Remove my early access' : 'Give me early access'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
