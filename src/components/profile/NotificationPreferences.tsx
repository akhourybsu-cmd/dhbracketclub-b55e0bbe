import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  MessageCircle, BarChart3, CalendarDays, Bookmark, Bell, AtSign, Lock,
  TrendingUp, Trophy, ListOrdered, FileText, ScrollText, Cake, Drama,
  Brackets, Shield, Swords, Megaphone, Pickaxe,
} from 'lucide-react';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type PrefItem = {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof MessageCircle;
};

type PrefGroup = {
  title: string;
  items: PrefItem[];
};

const GROUPS: PrefGroup[] = [
  {
    title: 'Social',
    items: [
      { key: 'chat_messages', label: 'Chat Messages', description: 'New messages, thread replies, reactions', icon: MessageCircle },
      { key: 'mentions', label: 'Mentions', description: '@mentions always break through', icon: AtSign },
      { key: 'posts', label: 'Posts & Feed', description: 'Comments and reactions on your posts', icon: FileText },
      { key: 'lore', label: 'Lore', description: 'Contributions and reactions on your lore', icon: ScrollText },
      { key: 'celebrations', label: 'Birthdays & Milestones', description: 'Daily celebrations digest', icon: Cake },
    ],
  },
  {
    title: 'Competition',
    items: [
      { key: 'drafts', label: 'Drafts', description: 'Turn alerts, podium, season updates', icon: Bookmark },
      { key: 'pickem', label: 'NFL Pick\'em', description: 'Week open, lock reminders, weekly winners', icon: Trophy },
      { key: 'brackets', label: 'Brackets', description: 'Invites, lock reminders, results', icon: Brackets },
      { key: 'portfolio_wars', label: 'Portfolio Wars', description: 'Weekly lock, results, leaderboard', icon: TrendingUp },
      { key: 'polls', label: 'Polls', description: 'New polls and closing reminders', icon: BarChart3 },
      { key: 'rankings', label: 'Rankings', description: 'New rankings to vote on', icon: ListOrdered },
      { key: 'events', label: 'Events', description: 'New events, RSVPs, and reminders', icon: CalendarDays },
    ],
  },
  {
    title: 'Games',
    items: [
      { key: 'lockbox', label: 'Lockbox', description: 'Lock created, cracked, and daily reminders', icon: Lock },
      { key: 'nexus', label: 'Nexus Defense', description: 'Operation phases and rewards', icon: Shield },
      { key: 'runedelve', label: 'Rune Delve', description: 'Daily challenge and mastery unlocks', icon: Swords },
      { key: 'deep_claim', label: 'Deep Claim', description: 'Batched crew returns, completed work and club projects', icon: Pickaxe },
      { key: 'narrative', label: 'Narrative RPG', description: 'Invites, scenes, and approvals', icon: Drama },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'system', label: 'Announcements', description: 'Club news and app updates', icon: Megaphone },
    ],
  },
];

export default function NotificationPreferencesSection() {
  const { prefs, loading, saving, error, update, refresh } = useNotificationPreferences();
  const { isSupported, isSubscribed, subscribe } = usePushNotifications();
  const { play } = useSoundEffect();
  const { user } = useAuth();
  const [testingSend, setTestingSend] = useState(false);

  const handleTestPush = async () => {
    if (!user) return;
    setTestingSend(true);
    try {
      if (!isSubscribed) {
        const ok = await subscribe();
        if (!ok) {
          toast.error('Please allow notification permissions first');
          setTestingSend(false);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: { test: true, user_id: user.id },
      });
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success('Test notification sent! Check your notifications.');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.error('No test notification was delivered. Turn Push Notifications off and on, then try again.');
      }
    } catch (err) {
      console.error('Test push error:', err);
      toast.error('Failed to send test notification');
    }
    setTestingSend(false);
  };

  return (
    <div className="glass-card p-5 mb-4 space-y-5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        Notification Preferences
      </h3>

      {loading && <p className="text-sm text-muted-foreground" role="status">Loading notification preferences…</p>}
      {error && <div role="alert" className="text-sm text-destructive">{error}<Button variant="outline" size="sm" onClick={() => void refresh()}>Retry preferences</Button></div>}

      {GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
            {group.title}
          </p>
          {group.items.map(({ key, label, description, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground">{description}</p>
                </div>
              </div>
              <Switch
                checked={prefs[key]}
                disabled={loading || saving}
                onCheckedChange={async (checked) => {
                  try {
                    await update(key, checked);
                    play('tap');
                    toast.success(`${label} ${checked ? 'enabled' : 'disabled'}`);
                  } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Notification preference could not save.'); }
                }}
              />
            </div>
          ))}
        </div>
      ))}

      {isSupported && (
        <div className="pt-3 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={handleTestPush}
            disabled={testingSend}
          >
            <Bell className="w-3.5 h-3.5" />
            {testingSend ? 'Sending…' : 'Send Test Notification'}
          </Button>
        </div>
      )}
    </div>
  );
}
