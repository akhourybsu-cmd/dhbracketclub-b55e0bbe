import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Bell, AtSign, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Channel, Category, ChannelType, PostPermission, NotificationMode } from './types';
import { CHANNEL_TYPE_META, CHANNEL_TYPE_ORDER } from './channelTypeMeta';

const EMOJI_OPTIONS = [
  '💬', '📢', '🏀', '🎬', '🍕', '🎲', '✈️', '🏆',
  '🎮', '🎵', '📚', '🏈', '⚽', '🎯', '💡', '🔥',
  '❤️', '🌍', '📸', '🛠️', '💰', '🎤', '🐶', '🚀',
];

type ChannelUpdates = Partial<Pick<Channel, 'name' | 'description' | 'icon' | 'category_id' | 'is_default' | 'channel_type' | 'post_permission'>>;

interface ChannelSettingsDialogProps {
  channel: Channel;
  categories: Category[];
  open: boolean;
  isAdmin?: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (channelId: string, updates: ChannelUpdates) => Promise<boolean>;
  onDelete: (channelId: string) => void;
}

const TYPE_OPTIONS = CHANNEL_TYPE_ORDER.map(id => ({ id, ...CHANNEL_TYPE_META[id] }));

const NOTIF_OPTIONS: { value: NotificationMode; label: string; hint: string; icon: typeof Bell }[] = [
  { value: 'all', label: 'All messages', hint: 'Notify me for every new message', icon: Bell },
  { value: 'mentions', label: 'Mentions only', hint: 'Just @mentions and replies to me', icon: AtSign },
  { value: 'muted', label: 'Muted', hint: 'No push notifications from this channel', icon: BellOff },
];

export function ChannelSettingsDialog({ channel, categories, open, isAdmin, onOpenChange, onUpdate, onDelete }: ChannelSettingsDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [icon, setIcon] = useState(channel.icon || '');
  const [categoryId, setCategoryId] = useState(channel.category_id || '');
  const [isDefault, setIsDefault] = useState(channel.is_default);
  const [channelType, setChannelType] = useState<ChannelType>(channel.channel_type || 'general');
  const [postPermission, setPostPermission] = useState<PostPermission>(channel.post_permission || 'all');
  const [saving, setSaving] = useState(false);

  // Per-user notification preference for this channel.
  // `notifLoaded` flips true the moment we know the real mode so we
  // can dim the selection buttons until then instead of showing a
  // false-default flash of "All messages".
  const [notifMode, setNotifMode] = useState<NotificationMode>('all');
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  // Reset form state whenever the channel changes OR dialog opens
  useEffect(() => {
    if (!open) return;
    setName(channel.name);
    setDescription(channel.description || '');
    setIcon(channel.icon || '');
    setCategoryId(channel.category_id || '');
    setIsDefault(channel.is_default);
    setChannelType(channel.channel_type || 'general');
    setPostPermission(channel.post_permission || 'all');
  }, [channel.id, open]);

  // Load this user's notification preference for the channel.
  // Reset to unloaded state on every open/channel change so users
  // never see a stale value before the fetch resolves.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setNotifLoaded(false);
    (async () => {
      const { data } = await (supabase as any)
        .from('channel_notification_prefs')
        .select('mode')
        .eq('channel_id', channel.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setNotifMode((data?.mode as NotificationMode) || 'all');
        setNotifLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, channel.id]);

  const handleSetNotifMode = async (next: NotificationMode) => {
    if (!user || notifSaving || next === notifMode) return;
    setNotifSaving(true);
    const prev = notifMode;
    setNotifMode(next);
    const { error } = await (supabase as any)
      .from('channel_notification_prefs')
      .upsert(
        { user_id: user.id, channel_id: channel.id, mode: next },
        { onConflict: 'user_id,channel_id' }
      );
    if (error) {
      setNotifMode(prev);
      toast.error('Could not update notifications');
    } else {
      // Success toast so the user sees confirmation of their tap
      // (silent saves felt like nothing happened).
      const label = NOTIF_OPTIONS.find(o => o.value === next)?.label ?? next;
      toast.success(`Notifications: ${label}`);
    }
    setNotifSaving(false);
  };

  // Announcements + admin_only imply admin-only posting; keep state in sync.
  const effectivePermission: PostPermission =
    channelType === 'announcements' || channelType === 'admin_only' ? 'admins' : postPermission;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const sanitizedName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const success = await onUpdate(channel.id, {
      name: sanitizedName,
      description: description.trim() || null,
      icon: icon || null,
      category_id: categoryId || null,
      is_default: isDefault,
      channel_type: channelType,
      post_permission: effectivePermission,
    });
    setSaving(false);
    if (success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[85dvh] p-0 rounded-2xl flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0 flex-shrink-0">
          {/* Unified title: always show the channel being configured
              so users (admin or not) see at a glance which channel
              they're touching. Admins get an extra subtitle to clarify
              they're in the full Settings view. */}
          <DialogTitle className="text-base font-bold">
            <span className="text-muted-foreground/55 font-medium">#</span>
            {channel.name}
          </DialogTitle>
          {isAdmin && (
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground/55 mt-0.5">
              Channel Settings
            </p>
          )}
        </DialogHeader>

        {/* Native overflow container — replaced the Radix ScrollArea
            because its overlay scrollbar pattern doesn't always
            propagate touch-drag events on mobile inside a Dialog.
            Symptom: users could see the first row of the icon picker
            but couldn't scroll past it to reach Channel Type / Save /
            Delete. A plain `overflow-y-auto` div uses the platform's
            native scroll which works everywhere. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
          <div className="px-5 pb-5 pt-3 space-y-5">
            {/* Notifications — visible to ALL members */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Notifications</Label>
              <div className="space-y-1.5">
                {NOTIF_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  // Until the user's actual pref has loaded from the
                  // server, treat NO option as selected (instead of
                  // the false-default "all" flashing first). Once
                  // notifLoaded flips true, the real selection renders.
                  const selected = notifLoaded && notifMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={notifSaving || !notifLoaded}
                      onClick={() => handleSetNotifMode(opt.value)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                        selected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border/30 hover:bg-muted/40',
                        (notifSaving || !notifLoaded) && 'opacity-60'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', selected ? 'text-primary' : 'text-muted-foreground/70')} />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[13px] font-bold leading-tight', selected ? 'text-primary' : 'text-foreground/90')}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{opt.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {isAdmin && <Separator />}

            {/* Admin-only: Channel configuration */}
            {isAdmin && (
              <>
                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Channel Name</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="channel-name"
                    className="chat-mobile-input h-10 text-sm"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What's this channel about?"
                    className="chat-mobile-input text-sm resize-none min-h-[60px]"
                    rows={2}
                  />
                </div>

                {/* Emoji/Icon — bumped to 40×40 on mobile so each tile
                    is a comfortable thumb target in the picker grid;
                    desktop keeps the tighter 36×36 since pointer
                    precision is higher. */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setIcon('')}
                      className={`w-10 h-10 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center text-xs border transition-all ${!icon ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/30 hover:bg-muted/50'}`}
                      aria-label="No icon"
                    >
                      #
                    </button>
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => setIcon(e)}
                        className={`w-10 h-10 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center text-lg transition-all ${icon === e ? 'border border-primary bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'}`}
                        aria-label={`Set icon to ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="chat-mobile-input w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Channel type */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Channel Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const selected = channelType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setChannelType(opt.id)}
                          className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all ${
                            selected
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border/30 hover:bg-muted/40'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground/70'}`} />
                          <div className="min-w-0">
                            <p className={`text-[12px] font-bold ${selected ? 'text-primary' : 'text-foreground/85'}`}>{opt.label}</p>
                            <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{opt.hint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Post permission — always visible so the user
                    understands the current rule. When the channel
                    type implies admin-only posting (announcements,
                    admin_only), the switch is locked ON with an
                    explanation so it doesn't look broken / vanished.
                    For 'general' channels the switch is interactive. */}
                {(() => {
                  const forced = channelType === 'announcements' || channelType === 'admin_only';
                  return (
                    <div className={cn('flex items-center justify-between py-1', forced && 'opacity-90')}>
                      <div className="min-w-0 flex-1 pr-3">
                        <Label className="text-xs font-semibold">Admins-only Posting</Label>
                        <p className="text-[11px] text-muted-foreground/70">
                          {forced
                            ? `Locked on by "${CHANNEL_TYPE_META[channelType].label}" channel type.`
                            : 'Members can still read; only admins can post.'}
                        </p>
                      </div>
                      <Switch
                        checked={forced ? true : postPermission === 'admins'}
                        disabled={forced}
                        onCheckedChange={(v) => setPostPermission(v ? 'admins' : 'all')}
                      />
                    </div>
                  );
                })()}

                {/* Default toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <Label className="text-xs font-semibold">Default Channel</Label>
                    <p className="text-[11px] text-muted-foreground/70">New users land here first</p>
                  </div>
                  <Switch checked={isDefault} onCheckedChange={setIsDefault} />
                </div>

                {/* Save: 44px on mobile, 40px on lg+ — primary
                    confirmation action so it earns the HIG target. */}
                <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full h-11 lg:h-10 text-sm font-bold">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>

                <Separator />

                {/* Danger zone */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">Danger Zone</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      {/* Destructive action — give it a comfortable 44px
                          target on mobile so accidental misfires are
                          rarer; desktop keeps the tighter h-9. */}
                      <Button variant="destructive" size="sm" className="w-full h-11 lg:h-9 text-xs gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Delete Channel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the channel and all its messages, reactions, and read states. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => { onDelete(channel.id); onOpenChange(false); }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        </div>{/* /native scroll container */}
      </DialogContent>
    </Dialog>
  );
}
