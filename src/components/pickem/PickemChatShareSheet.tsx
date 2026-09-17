import { useEffect, useMemo, useState } from 'react';
import { Check, Hash, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { ChatBottomSheet } from '@/components/chat/ChatBottomSheet';
import type { Channel } from '@/components/chat/types';
import { buildPickemShareMessage } from '@/lib/pickemShare';

interface PickemChatShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekId: string;
  weekNumber: number;
  weekLabel: string;
  pickedCount: number;
  totalGames: number;
  nativeText: string;
  chatInstalled: boolean;
}

export function PickemChatShareSheet(props: PickemChatShareSheetProps) {
  const { user } = useAuth();
  const { isClubAdmin } = useClub();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!props.open || !props.chatInstalled) return;
    let cancelled = false;
    setLoading(true);
    void supabase.from('channels').select('*').order('position').then(({ data, error }) => {
      if (cancelled) return;
      const eligible = ((data ?? []) as Channel[]).filter(channel =>
        (channel.channel_type !== 'admin_only' || isClubAdmin)
        && (channel.post_permission === 'all' || isClubAdmin),
      );
      setChannels(eligible);
      setSelectedId(current => eligible.some(channel => channel.id === current) ? current : eligible[0]?.id ?? null);
      setLoading(false);
      if (error) toast.error('Could not load chat channels');
    });
    return () => { cancelled = true; };
  }, [isClubAdmin, props.chatInstalled, props.open]);

  const message = useMemo(() => buildPickemShareMessage({
    origin: window.location.origin,
    weekId: props.weekId,
    weekNumber: props.weekNumber,
    weekLabel: props.weekLabel,
    pickedCount: props.pickedCount,
    totalGames: props.totalGames,
  }), [props.pickedCount, props.totalGames, props.weekId, props.weekLabel, props.weekNumber]);

  const shareToChat = async () => {
    if (!user || !selectedId || sending) return;
    setSending(true);
    const { data, error } = await supabase.from('messages').insert({ channel_id: selectedId, user_id: user.id, content: message }).select('id, channel_id, user_id, content').single();
    setSending(false);
    if (error || !data) {
      toast.error(error?.message || 'Could not share picks');
      return;
    }
    void supabase.functions.invoke('send-push-notification', { body: { record: data } }).catch(() => {});
    props.onOpenChange(false);
    navigate(`/chat?channel=${encodeURIComponent(selectedId)}&message=${encodeURIComponent(data.id)}`);
  };

  const shareElsewhere = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${props.weekLabel} Pick’em`, text: props.nativeText });
      else {
        await navigator.clipboard.writeText(props.nativeText);
        toast.success('Pick card copied');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error('Could not share this card');
    }
  };

  return (
    <ChatBottomSheet open={props.open} onOpenChange={props.onOpenChange} title="Share your pick card" description={`${props.weekLabel} · ${props.pickedCount}/${props.totalGames} picks`} className="sm:block sm:left-1/2 sm:right-auto sm:w-[420px] sm:-translate-x-1/2 sm:rounded-t-2xl">
      <div className="space-y-3">
        {props.chatInstalled && (
          <section>
            <p className="mb-2 px-1 text-[10px] font-extrabold uppercase text-muted-foreground">DH Chat</p>
            {loading ? (
              <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : channels.length > 0 ? (
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {channels.map(channel => (
                  <Button key={channel.id} type="button" variant="ghost" onClick={() => setSelectedId(channel.id)} className="h-12 w-full justify-start px-3">
                    <Hash className="h-4 w-4 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-left">{channel.name}</span>
                    {selectedId === channel.id && <Check className="h-4 w-4 text-primary" />}
                  </Button>
                ))}
              </div>
            ) : <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">No channels are available for posting.</p>}
            <Button type="button" onClick={shareToChat} disabled={!selectedId || sending || loading} className="mt-2 w-full">
              {sending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
              Share to selected chat
            </Button>
          </section>
        )}
        <Button type="button" variant="outline" onClick={shareElsewhere} className="w-full">
          <Share2 /> Share another way
        </Button>
      </div>
    </ChatBottomSheet>
  );
}