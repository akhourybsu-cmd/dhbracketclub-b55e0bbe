import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Activity, RefreshCw, Trophy, Bookmark, Bell, ChevronRight, Loader2, Swords, Building2, BarChart3, Sliders, Users } from 'lucide-react';
import { useClub } from '@/contexts/ClubContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { nukeAndReload, subscribeProbeState, fetchRemoteBuildId, type ProbeState } from '@/lib/forceUpdate';
import { toast } from 'sonner';

type Tool = {
  icon: typeof Shield;
  label: string;
  description: string;
  to?: string;
  onClick?: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  iconColor?: string;
};

function ToolRow({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const inner = (
    <div className="flex items-center gap-3 w-full min-h-[44px] py-2.5 px-3 rounded-xl hover:bg-muted/40 active:bg-muted/60 transition-colors btn-press">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(var(--${tool.iconColor || 'gold'}) / 0.14), hsl(var(--${tool.iconColor || 'gold'}) / 0.04))`,
          border: `1px solid hsl(var(--${tool.iconColor || 'gold'}) / 0.18)`,
        }}
      >
        {tool.loading ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: `hsl(var(--${tool.iconColor || 'gold'}))` }} />
        ) : (
          <Icon className="w-4 h-4" style={{ color: `hsl(var(--${tool.iconColor || 'gold'}))` }} />
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[13px] font-semibold leading-tight">{tool.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
    </div>
  );

  if (tool.to) {
    return <Link to={tool.to} className="block">{inner}</Link>;
  }
  return (
    <button
      type="button"
      onClick={tool.onClick}
      disabled={tool.disabled || tool.loading}
      className="block w-full disabled:opacity-60"
    >
      {inner}
    </button>
  );
}

function formatRelative(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function outcomeColor(o: ProbeState['lastOutcome']): string {
  switch (o) {
    case 'ok': return 'hsl(var(--primary))';
    case 'mismatch': return 'hsl(var(--gold))';
    case 'network-failed':
    case 'invalid-json': return 'hsl(var(--destructive))';
    default: return 'hsl(var(--muted-foreground))';
  }
}

function UpdateDiagnostics({ buildId }: { buildId: string }) {
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const [swInfo, setSwInfo] = useState<{ scriptURL: string | null; regs: number; cacheKeys: string[] }>({
    scriptURL: null, regs: 0, cacheKeys: [],
  });
  const [, force] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsub = subscribeProbeState(setProbe);
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshSW = async () => {
      try {
        const regs = 'serviceWorker' in navigator
          ? await navigator.serviceWorker.getRegistrations()
          : [];
        const active = regs[0]?.active?.scriptURL ?? regs[0]?.installing?.scriptURL ?? regs[0]?.waiting?.scriptURL ?? null;
        const cacheKeys = 'caches' in window ? await caches.keys() : [];
        if (!cancelled) setSwInfo({ scriptURL: active, regs: regs.length, cacheKeys });
      } catch {
        // noop
      }
    };
    void refreshSW();
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    await fetchRemoteBuildId();
    setChecking(false);
  };

  const localShort = String(buildId).slice(0, 12);
  const remoteShort = probe?.lastRemoteBuildId ? String(probe.lastRemoteBuildId).slice(0, 12) : '—';
  const isStale = probe?.lastOutcome === 'mismatch';

  return (
    <div
      className="mt-2 rounded-xl p-3 space-y-2"
      style={{
        background: 'hsl(var(--muted) / 0.25)',
        border: `1px solid ${isStale ? 'hsl(var(--gold) / 0.4)' : 'hsl(var(--border) / 0.6)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
          Update Diagnostics
        </p>
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="text-[10px] font-semibold px-2 py-1 rounded-md disabled:opacity-50 btn-press"
          style={{
            color: 'hsl(var(--primary))',
            background: 'hsl(var(--primary) / 0.1)',
            border: '1px solid hsl(var(--primary) / 0.3)',
          }}
        >
          {checking ? 'Checking…' : 'Check now'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
        <span className="text-muted-foreground/70">local build</span>
        <span className="text-right truncate">{localShort}</span>

        <span className="text-muted-foreground/70">remote build</span>
        <span className="text-right truncate" style={{ color: isStale ? 'hsl(var(--gold))' : undefined }}>
          {remoteShort}
        </span>

        <span className="text-muted-foreground/70">last probe</span>
        <span className="text-right" style={{ color: outcomeColor(probe?.lastOutcome ?? 'never') }}>
          {probe?.lastOutcome ?? 'never'} · {formatRelative(probe?.lastAttemptAt ?? null)}
        </span>

        <span className="text-muted-foreground/70">last success</span>
        <span className="text-right">{formatRelative(probe?.lastSuccessAt ?? null)}</span>

        <span className="text-muted-foreground/70">probes ok / fail</span>
        <span className="text-right">{probe?.successes ?? 0} / {probe?.failures ?? 0}</span>

        <span className="text-muted-foreground/70">SW registrations</span>
        <span className="text-right">{swInfo.regs}</span>

        <span className="text-muted-foreground/70">SW script</span>
        <span className="text-right truncate" title={swInfo.scriptURL ?? ''}>
          {swInfo.scriptURL ? swInfo.scriptURL.split('/').pop() : 'none'}
        </span>

        <span className="text-muted-foreground/70">cache keys</span>
        <span className="text-right">{swInfo.cacheKeys.length}</span>
      </div>

      {isStale && (
        <p className="text-[10px] leading-snug pt-1" style={{ color: 'hsl(var(--gold))' }}>
          New build detected. The auto-update toast should appear shortly, or tap "Force Refresh App" above.
        </p>
      )}
    </div>
  );
}

export default function AdminHub() {
  const { user } = useAuth();
  const { isPlatformOwner } = useClub();
  const { isSubscribed, subscribe } = usePushNotifications();
  const { play } = useSoundEffect();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  if (!isAdmin) return null;

  const handleForceRefresh = async () => {
    setRefreshing(true);
    play('tap');
    toast.loading('Clearing cache and reloading…');
    await nukeAndReload();
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTesting(true);
    try {
      if (!isSubscribed) {
        const ok = await subscribe();
        if (!ok) {
          toast.error('Allow notification permissions first');
          setTesting(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { test: true, user_id: user.id },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success('Test notification sent!');
        play('success');
      } else {
        toast.error(data?.error || 'No test notification was delivered.');
        play('error');
      }
    } catch (err) {
      console.error('Test push error:', err);
      toast.error('Failed to send test notification');
      play('error');
    }
    setTesting(false);
  };

  const appManagement: Tool[] = [
    { icon: Activity, label: 'Sync Runs & Logs', description: 'Bracket sync, game updates, audit trail', to: '/admin', iconColor: 'gold' },
    { icon: RefreshCw, label: 'Force Refresh App', description: 'Clear cache & pull latest build', onClick: handleForceRefresh, loading: refreshing, iconColor: 'primary' },
    ...(isPlatformOwner ? [{ icon: Building2, label: 'Clubs', description: 'Approve requests & manage clubs', to: '/admin/clubs', iconColor: 'gold' } as Tool] : []),
  ];

  const competitions: Tool[] = [
    { icon: Trophy, label: 'NFL Game Center Admin', description: 'Seasons, weeks, games, scoring, and markets', to: '/pickem/admin', iconColor: 'gold' },
    { icon: Bookmark, label: 'Drafts Hub', description: 'Manage drafts & league seasons', to: '/drafts', iconColor: 'accent' },
    { icon: Swords, label: 'Rune Delve Analytics', description: 'Per-level stats, cliffs, AI handoff', to: '/rune-delve/analytics', iconColor: 'primary' },
    { icon: Swords, label: 'Rune Delve Playtest Sim', description: 'Stress-test any future level (1-150)', to: '/rune-delve/simulator', iconColor: 'accent' },
    { icon: BarChart3, label: 'Rune Delve Balance Report', description: 'Full-spectrum audit · sim + live data', to: '/rune-delve/balance', iconColor: 'gold' },
    { icon: BarChart3, label: 'Nexus Defense Balance', description: 'Mission, tower & ability telemetry', to: '/nexus/balance', iconColor: 'primary' },
    { icon: Sliders, label: 'Nexus Mission Calibration', description: 'Tune live mission difficulty', to: '/nexus/calibration', iconColor: 'warning' },
    { icon: Users, label: 'Nexus Co-op Operations', description: 'Start, monitor & end club operations', to: '/nexus/operation', iconColor: 'accent' },
  ];

  const diagnostics: Tool[] = [
    { icon: Bell, label: 'Send Test Notification', description: 'Verify push delivery to this device', onClick: handleTestPush, loading: testing, iconColor: 'warning' },
  ];

  return (
    <div
      className="relative glass-card arena-edge p-5 mb-4 overflow-hidden"
      style={{
        borderColor: 'hsl(var(--gold) / 0.28)',
        boxShadow: '0 0 32px hsl(var(--gold) / 0.08)',
      }}
    >
      {/* Gold radial glow */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--gold) / 0.18), transparent 70%)' }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 mb-5">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))',
            border: '1px solid hsl(var(--gold) / 0.3)',
            boxShadow: '0 0 20px hsl(var(--gold) / 0.15)',
          }}
        >
          <Shield className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(var(--gold))' }}>
            Admin Tools
          </p>
          <p className="text-[15px] font-extrabold leading-tight">Commissioner Hub</p>
        </div>
      </div>

      {/* App Management */}
      <div className="relative z-10 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 px-1">
          App Management
        </p>
        <div className="space-y-0.5">
          {appManagement.map((t) => <ToolRow key={t.label} tool={t} />)}
        </div>
        <UpdateDiagnostics buildId={buildId} />
      </div>

      {/* Competitions */}
      <div className="relative z-10 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 px-1">
          Competitions
        </p>
        <div className="space-y-0.5">
          {competitions.map((t) => <ToolRow key={t.label} tool={t} />)}
        </div>
      </div>

      {/* Diagnostics */}
      <div className="relative z-10 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 mb-1.5 px-1">
          Diagnostics
        </p>
        <div className="space-y-0.5">
          {diagnostics.map((t) => <ToolRow key={t.label} tool={t} />)}
        </div>
      </div>

      {/* Build info */}
      <div className="relative z-10 pt-3 border-t border-border/40 flex items-center justify-between text-[9px] font-mono text-muted-foreground/60">
        <span>build {String(buildId).slice(0, 12)}</span>
        <span className="truncate max-w-[160px]">uid {user?.id.slice(0, 8)}…</span>
      </div>
    </div>
  );
}
