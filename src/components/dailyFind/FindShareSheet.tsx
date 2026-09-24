import { useEffect, useState } from 'react';
import { Check, Hash, Link2, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { Button } from '@/components/ui/button';
import { ChatBottomSheet } from '@/components/chat/ChatBottomSheet';
import type { Channel } from '@/components/chat/types';
import { buildFindShareMessage, buildFindShareUrl, type DailyFind } from '@/lib/dailyFind';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; find: DailyFind }

export function FindShareSheet({ open, onOpenChange, find }: Props) {
  const { user } = useAuth();
  const { isClubAdmin } = useClub();
  const { isInstalled } = useClubAssets();
  const chatInstalled = isInstalled('chat');
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !chatInstalled) return;
    let cancelled = false;
    setLoading(true);
    void supabase.from('channels').select('*').order('position').then(({ data }) => {
      if (cancelled) return;
      const ok = ((data ?? []) as Channel[]).filter(c => (c.channel_type !== 'admin_only' || isClubAdmin) && (c.post_permission === 'all' || isClubAdmin));
      setChannels(ok);
      setSelected(cur => ok.some(c => c.id === cur) ? cur : ok[0]?.id ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, chatInstalled, isClubAdmin]);

  const url = buildFindShareUrl(find.id);

  const toChat = async () => {
    if (!user || !selected || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('messages')
      .insert({ channel_id: selected, user_id: user.id, content: buildFindShareMessage(find) })
      .select('id, channel_id, user_id, content').single();
    setSending(false);
    if (error || !data) { toast.error('Could not share to chat'); return; }
    void supabase.functions.invoke('send-push-notification', { body: { record: data } }).catch(() => {});
    onOpenChange(false);
    navigate(`/chat?channel=${encodeURIComponent(selected)}&message=${encodeURIComponent(data.id)}`);
  };

  const elsewhere = async () => {
    try {
      if (navigator.share) await navigator.share({ title: find.title, text: `The Drop: ${find.title}`, url });
      else { await navigator.clipboard.writeText(url); toast.success('Link copied'); }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast.error('Could not share');
    }
  };

  return (
    <ChatBottomSheet open={open} onOpenChange={onOpenChange} title="Share this Drop" description={find.title} mobileOnly={false} className="drop-page drop-sheet sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2">
      <div className="space-y-3">
        {chatInstalled && (
          <section>
            <p className="mb-2 px-1 text-[10px] font-extrabold uppercase text-muted-foreground">DH Chat</p>
            {loading ? (
              <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : channels.length > 0 ? (
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {channels.map(c => (
                  <Button key={c.id} type="button" variant="ghost" onClick={() => setSelected(c.id)} className="h-12 w-full justify-start px-3">
                    <Hash className="h-4 w-4 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                    {selected === c.id && <Check className="h-4 w-4 text-primary" />}
                  </Button>
                ))}
              </div>
            ) : <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">No channels available.</p>}
            <Button type="button" onClick={toChat} disabled={!selected || sending || loading} className="mt-2 w-full">
              {sending ? <Loader2 className="animate-spin" /> : <MessageCircle />} Share to chat
            </Button>
          </section>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); toast.success('Link copied'); }}>
            <Link2 /> Copy link
          </Button>
          <Button type="button" variant="outline" onClick={elsewhere}><Share2 /> More</Button>
        </div>
      </div>
    </ChatBottomSheet>
  );
}
