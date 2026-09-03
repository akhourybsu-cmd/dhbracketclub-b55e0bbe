import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { LogOut, User, Volume2, VolumeX, BarChart3, MessageCircle, CalendarDays, MessageSquareText, Trophy, Bookmark, Zap, Sun, Moon, Bell, BellOff, Camera, Loader2, RefreshCw, Settings, ShieldCheck, KeyRound, Eye, EyeOff, Copy } from 'lucide-react';
import { nukeAndReload } from '@/lib/forceUpdate';
import { useTheme } from 'next-themes';
import dhMonogram from '@/assets/dh-monogram.png';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { formatDistanceToNow } from 'date-fns';
import NotificationPreferencesSection from '@/components/profile/NotificationPreferences';
import SecurityInfoPanel from '@/components/profile/SecurityInfoPanel';
import AdminHub from '@/components/profile/AdminHub';
import { validateImageFile, sanitizeUploadError } from '@/lib/uploadValidation';
import SoundSettingsCard from '@/components/profile/SoundSettingsCard';
import { ProfileCelebrationsSection } from '@/components/celebrations/ProfileCelebrationsSection';
import { ProfileReadshiftSection } from '@/components/readshift/ProfileReadshiftSection';
import LinkedAccounts from '@/components/profile/LinkedAccounts';

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { club, isClubAdmin, isPlatformOwner } = useClub();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [clubPwd, setClubPwd] = useState<string | null>(null);
  const [showClubPwd, setShowClubPwd] = useState(false);
  const { play, soundEnabled, toggleSound } = useSoundEffect();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();
  const [stats, setStats] = useState({ polls: 0, rankings: 0, events: 0, messages: 0, drafts: 0, draftPoints: 0, draftWins: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const [{ data: profile }, { data: pollVotes }, { data: rankSubs }, { data: rsvps }, { data: activity }, { data: draftResultsData }] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).single(),
        supabase.from('poll_votes').select('id').eq('user_id', user.id),
        supabase.from('ranking_submissions').select('id').eq('user_id', user.id),
        supabase.from('event_rsvps').select('id').eq('user_id', user.id).eq('status', 'going'),
        supabase.from('activity_feed').select('*, profiles:actor_user_id(display_name)').eq('actor_user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('draft_results' as any).select('points_awarded, rank').eq('user_id', user.id),
      ]);
      if (profile) {
        setDisplayName(profile.display_name);
        setAvatarUrl(profile.avatar_url);
      }
      const drResults = (draftResultsData || []) as any[];
      const totalDraftPts = drResults.reduce((sum: number, r: any) => sum + (r.points_awarded || 0), 0);
      const draftWins = drResults.filter((r: any) => r.rank === 1).length;
      setStats({
        polls: pollVotes?.length || 0,
        rankings: rankSubs?.length || 0,
        events: rsvps?.length || 0,
        messages: 0,
        drafts: drResults.length,
        draftPoints: totalDraftPts,
        draftWins,
      });
      if (activity) setRecentActivity(activity);
    };
    fetchProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const v = validateImageFile(file, { maxBytes: 5 * 1024 * 1024, label: 'Avatar' });
    if (!v.ok) {
      toast.error(v.error!);
      return;
    }

    setUploading(true);
    try {
      // Always derive the extension from MIME via validateImageFile —
      // never trust the user-supplied filename when writing to storage.
      const filePath = `${user.id}/avatar.${v.ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting param
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBust })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBust);
      toast.success('Avatar updated!');
      play('success');
    } catch (err) {
      toast.error(sanitizeUploadError(err, 'Failed to upload avatar'));
      play('error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);

    if (error) {
      toast.error(error.message);
      play('error');
    } else {
      toast.success('Profile updated!');
      play('success');
    }
    setLoading(false);
  };

  const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
    ranking_created: { icon: BarChart3, color: 'accent' },
    ranking_submitted: { icon: BarChart3, color: 'accent' },
    poll_created: { icon: MessageCircle, color: 'warning' },
    poll_voted: { icon: MessageCircle, color: 'warning' },
    draft_created: { icon: Bookmark, color: 'gold' },
    draft_completed: { icon: Bookmark, color: 'gold' },
    bracket_submitted: { icon: Trophy, color: 'primary' },
    event_created: { icon: CalendarDays, color: 'success' },
    post_created: { icon: MessageSquareText, color: 'primary' },
  };

  return (
    <div className="member-page max-w-md lg:max-w-none mx-auto lg:mx-0">
      {/* Page header — full width on every breakpoint.
          Note on the wrapper className above: mobile/tablet keeps the
          original 28rem reading-column. On lg+ the cap is lifted so
          the 2-column desktop layout below can use the full shell. */}
      <div className="page-header">
        <div className="page-header-icon">
          <User />
        </div>
        <div>
          <h1 className="page-header-title">Profile</h1>
          <p className="page-header-subtitle">Manage your DH account</p>
        </div>
      </div>

      {/* Desktop 2-column split (mobile/tablet keeps the original
          vertical stack — no `lg:` prefix means no change <lg):
            LEFT  (1fr) — Identity + Your Club  (who you are)
            RIGHT (1fr) — Your Stats + Recent Activity  (what you've done)
          Page header above stays full-width. Settings + Sound +
          Sign Out follow below the grid as a full-width block. */}
      <div className="flex flex-col gap-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <div className="min-w-0">

      {/* Identity card */}
      <div className="glass-card arena-edge p-6 mb-4">
        <div className="flex items-center gap-4 mb-6 relative z-10">
          {/* Avatar with upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-extrabold text-primary group btn-press"
            style={{
              background: avatarUrl
                ? 'transparent'
                : 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
              border: '1px solid hsl(var(--primary) / 0.1)',
              boxShadow: '0 0 20px hsl(var(--primary) / 0.06)',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              displayName ? displayName[0].toUpperCase() : '?'
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <div>
            <p className="font-bold text-lg leading-tight">{displayName}</p>
            <p className="text-[11px] text-muted-foreground/60 font-medium mt-0.5">{user?.email}</p>
            <p className="text-[10px] text-primary/60 font-medium mt-0.5">Tap photo to change</p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div>
            <label className="form-label">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="form-input" />
          </div>

          <Button onClick={handleSave} className="w-full h-11 font-bold rounded-xl btn-press text-[13px]" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Your Club */}
      {club ? (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Your Club</h3>
          <div className="flex items-center gap-3">
            {club.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-11 h-11 object-cover rounded-xl" style={{ border: '1px solid hsl(var(--club-accent) / 0.3)' }} />
            ) : (
              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-base" style={{
                background: 'linear-gradient(135deg, hsl(var(--club-accent) / 0.18), hsl(var(--club-accent) / 0.04))',
                border: '1px solid hsl(var(--club-accent) / 0.25)',
                color: 'hsl(var(--club-accent))',
              }}>
                {club.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[14px] leading-tight truncate">{club.name}</p>
              <p className="text-[10px] text-muted-foreground/70 font-semibold uppercase tracking-wider mt-0.5">
                {isClubAdmin ? 'Admin' : 'Member'}
              </p>
            </div>
            {isClubAdmin && (
              <Link to="/club/settings">
                <Button size="sm" variant="ghost" className="h-11 px-3 gap-1.5 text-[11px] font-bold rounded-xl">
                  <Settings className="w-3.5 h-3.5" /> Manage
                </Button>
              </Link>
            )}
          </div>
          {isPlatformOwner && (
            <Link to="/admin/clubs" className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-primary/85 hover:text-primary">
              <ShieldCheck className="w-3.5 h-3.5" /> Platform Owner — Review club requests
            </Link>
          )}

          {/* Club password (visible to admins always; to members only if admin enabled it) */}
          <ClubPasswordRow
            clubId={club.id}
            isAdmin={isClubAdmin}
            visible={showClubPwd}
            setVisible={setShowClubPwd}
            value={clubPwd}
            setValue={setClubPwd}
          />
        </div>
      ) : (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Your Club</h3>
          <p className="text-[12px] text-muted-foreground mb-3">You're not in a club yet.</p>
          <Link to="/club/request">
            <Button size="sm" className="w-full h-11 font-bold rounded-xl btn-press text-[12px]">Request a club</Button>
          </Link>
        </div>
      )}

        </div>{/* /lg left column — Identity + Club */}

        {/* RIGHT column — stats + recent activity */}
        <div className="min-w-0">

      {/* Stats */}
      <div className="glass-card p-5 mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Your Stats</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Polls Voted', value: stats.polls, icon: MessageCircle, color: 'warning' },
            { label: 'Rankings', value: stats.rankings, icon: BarChart3, color: 'accent' },
            { label: 'Events', value: stats.events, icon: CalendarDays, color: 'success' },
            { label: 'Drafts', value: stats.drafts, icon: Bookmark, color: 'gold' },
            { label: 'Draft Pts', value: stats.draftPoints, icon: Trophy, color: 'gold' },
            { label: 'Draft Wins', value: stats.draftWins, icon: Trophy, color: 'primary' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="w-9 h-9 rounded-xl mx-auto mb-1.5 flex items-center justify-center" style={{
                background: `linear-gradient(135deg, hsl(var(--${stat.color}) / 0.12), hsl(var(--${stat.color}) / 0.04))`,
              }}>
                <stat.icon className="w-4 h-4" style={{ color: `hsl(var(--${stat.color}))` }} />
              </div>
              <p className="text-lg font-extrabold leading-none">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="glass-card p-5 mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Recent Activity</h3>
          <div className="space-y-2.5">
            {recentActivity.map(a => {
              const config = ACTIVITY_ICONS[a.event_type] || { icon: Zap, color: 'primary' };
              const Icon = config.icon;
              const meta = typeof a.metadata === 'object' ? a.metadata : {};
              const title = meta?.title || meta?.topic || meta?.question || '';
              return (
                <div key={a.id} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: `linear-gradient(135deg, hsl(var(--${config.color}) / 0.12), hsl(var(--${config.color}) / 0.04))`,
                  }}>
                    <Icon className="w-3 h-3" style={{ color: `hsl(var(--${config.color}))` }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-foreground/80 truncate">
                      {a.event_type.replace(/_/g, ' ')}
                      {title && <span className="font-semibold"> — {title}</span>}
                    </p>
                    <p className="text-[9px] text-muted-foreground/70">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

        </div>{/* /lg right column — Stats + Recent Activity */}
      </div>{/* /lg 2-col grid */}

      {/* Settings — full width again on every breakpoint (the panel is
          dense form rows that doesn't benefit from 2-col splitting). */}
      <div className="glass-card p-5 mb-4 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Settings</h3>

        {/* Theme toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-primary" />
            ) : (
              <Sun className="w-4 h-4 text-primary" />
            )}
            <div>
              <p className="text-[13px] font-semibold">Dark Mode</p>
              <p className="text-[10px] text-muted-foreground">Switch between light and dark themes</p>
            </div>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => {
              setTheme(checked ? 'dark' : 'light');
              play('tap');
            }}
          />
        </div>

        {/* Sound toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-[13px] font-semibold">Sound & Haptics</p>
              <p className="text-[10px] text-muted-foreground">UI sounds and vibration feedback</p>
            </div>
          </div>
          <Switch
            checked={soundEnabled}
            onCheckedChange={() => {
              toggleSound();
              play('tap');
            }}
          />
        </div>

        {/* Push notifications toggle */}
        {pushSupported && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pushSubscribed ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-[13px] font-semibold">Push Notifications</p>
                <p className="text-[10px] text-muted-foreground">Get alerts for new chat messages</p>
              </div>
            </div>
            <Switch
              checked={pushSubscribed}
              disabled={pushLoading}
              onCheckedChange={async (checked) => {
                if (checked) {
                  const ok = await pushSubscribe();
                  if (ok) {
                    toast.success('Push notifications enabled!');
                    play('success');
                  } else {
                    toast.error('Could not enable notifications. Check browser permissions.');
                    play('error');
                  }
                } else {
                  await pushUnsubscribe();
                  toast.success('Push notifications disabled');
                  play('tap');
                }
              }}
            />
          </div>
        )}

        {/* Force update */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-primary" />
            <div>
              <p className="text-[13px] font-semibold">Force Update</p>
              <p className="text-[10px] text-muted-foreground">Clear cache and pull the latest build</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              toast.loading('Clearing cache and reloading...');
              play('tap');
              await nukeAndReload();
            }}
            className="h-11 text-[11px] font-bold rounded-xl btn-press"
          >
            Update
          </Button>
        </div>
      </div>

      {/* Admin Portal entry — only for global app admin / platform owner */}
      {(isPlatformOwner) && (
        <Link to="/admin" className="block glass-card arena-edge p-4 mb-4 flex items-center gap-3 btn-press" style={{ borderColor: 'hsl(var(--gold) / 0.3)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))', border: '1px solid hsl(var(--gold) / 0.3)' }}>
            <ShieldCheck className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(var(--gold))' }}>Admin</p>
            <p className="text-[14px] font-extrabold leading-tight">Open Admin Portal</p>
            <p className="text-[10px] text-muted-foreground/80">Manage the DH Club platform</p>
          </div>
        </Link>
      )}

      {/* Celebrations — only renders if the plugin is installed for this club */}
      <div className="mb-4">
        <ProfileCelebrationsSection />
      </div>

      {/* READSHIFT stats — only renders if the plugin is installed + played */}
      <ProfileReadshiftSection />

      <NotificationPreferencesSection />

      {/* Linked sign-in providers */}
      <LinkedAccounts />

      {/* Sound & Haptics */}
      <SoundSettingsCard />

      {/* Security & Privacy */}
      <SecurityInfoPanel />


      {/* DH branding */}
      <div className="flex items-center justify-center gap-2 py-4 mb-2">
        <img src={dhMonogram} alt="DH" className="w-5 h-5 object-contain opacity-30" />
        <span className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-[0.15em]">DH Member</span>
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-[13px] font-medium text-muted-foreground/60 hover:text-destructive transition-colors duration-200"
      >
        <LogOut className="w-3.5 h-3.5" /> Sign Out
      </button>
    </div>
  );
}

function ClubPasswordRow({
  clubId, isAdmin, visible, setVisible, value, setValue,
}: {
  clubId: string;
  isAdmin: boolean;
  visible: boolean;
  setVisible: (v: boolean) => void;
  value: string | null;
  setValue: (v: string | null) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    (supabase as any).rpc('get_club_password', { _club_id: clubId }).then(({ data }: any) => {
      if (!cancelled) setValue((data as string | null) ?? null);
    });
    return () => { cancelled = true; };
  }, [clubId, setValue]);

  if (value === null) {
    // Either not set yet, or hidden by admin and viewer is a member
    if (!isAdmin) return null;
    return (
      <div className="mt-3 pt-3 border-t border-border/30">
        <Link to="/club/settings" className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: 'hsl(var(--gold))' }}>
          <KeyRound className="w-3.5 h-3.5" /> Set your club password
        </Link>
      </div>
    );
  }

  const copy = () => {
    navigator.clipboard.writeText(value);
    toast.success('Password copied');
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
          <KeyRound className="w-3 h-3" /> Club Password
        </p>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="min-h-11 px-2 -mr-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-xl btn-press"
        >
          {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2">
        <code className="flex-1 font-mono text-sm font-semibold tracking-wide truncate">
          {visible ? value : '•'.repeat(Math.min(value.length, 12))}
        </code>
        <button onClick={copy} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted/40 btn-press" aria-label="Copy club password">
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
