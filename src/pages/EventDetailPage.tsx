import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, MapPin, Send, Trash2, ArrowLeft, Pencil, Check, X, MoreVertical
} from 'lucide-react';
import ShareButton from '@/components/ShareButton';
import { format, isPast } from 'date-fns';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type RSVP = { id: string; user_id: string; status: string; profiles?: { display_name: string } };
type Comment = { id: string; user_id: string; content: string; created_at: string; profiles?: { display_name: string } };

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [event, setEvent] = useState<any>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', location: '', starts_at: '', ends_at: '' });
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const fetchData = async () => {
      const [{ data: ev }, { data: rs }, { data: cm }] = await Promise.all([
        supabase.from('events').select('*, profiles:created_by(display_name)').eq('id', eventId).single(),
        supabase.from('event_rsvps').select('*, profiles:user_id(display_name)').eq('event_id', eventId),
        supabase.from('event_comments').select('*, profiles:user_id(display_name)').eq('event_id', eventId).order('created_at'),
      ]);
      if (ev) {
        setEvent(ev);
        setEditForm({
          title: ev.title,
          description: ev.description || '',
          location: ev.location || '',
          starts_at: ev.starts_at ? format(new Date(ev.starts_at), "yyyy-MM-dd'T'HH:mm") : '',
          ends_at: ev.ends_at ? format(new Date(ev.ends_at), "yyyy-MM-dd'T'HH:mm") : '',
        });
      }
      if (rs) setRsvps(rs as RSVP[]);
      if (cm) setComments(cm as Comment[]);
      setLoading(false);
    };
    fetchData();
  }, [eventId]);

  const handleRsvp = async (status: string) => {
    if (!user || !eventId) return;
    play('tap');
    const existing = rsvps.find(r => r.user_id === user.id);
    if (existing) {
      if (existing.status === status) {
        await supabase.from('event_rsvps').delete().eq('id', existing.id);
      } else {
        await supabase.from('event_rsvps').update({ status }).eq('id', existing.id);
      }
    } else {
      await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id, status });
    }
    const { data } = await supabase.from('event_rsvps').select('*, profiles:user_id(display_name)').eq('event_id', eventId);
    if (data) setRsvps(data as RSVP[]);
  };

  const handleComment = async () => {
    if (!newComment.trim() || !user || !eventId) return;
    play('tap');
    const content = newComment.trim();
    setNewComment('');
    await supabase.from('event_comments').insert({ event_id: eventId, user_id: user.id, content });
    const { data } = await supabase.from('event_comments').select('*, profiles:user_id(display_name)').eq('event_id', eventId).order('created_at');
    if (data) setComments(data as Comment[]);
  };

  const handleSaveEdit = async () => {
    if (!eventId || !editForm.title.trim() || !editForm.starts_at) return;
    const { error } = await supabase.from('events').update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      location: editForm.location.trim() || null,
      starts_at: new Date(editForm.starts_at).toISOString(),
      ends_at: editForm.ends_at ? new Date(editForm.ends_at).toISOString() : null,
    }).eq('id', eventId);
    if (error) { toast.error('Failed to update'); return; }
    toast.success('Event updated');
    setEditing(false);
    // Refresh
    const { data: ev } = await supabase.from('events').select('*, profiles:created_by(display_name)').eq('id', eventId).single();
    if (ev) setEvent(ev);
  };

  const handleDelete = async () => {
    if (!eventId) return;
    await supabase.from('event_comments').delete().eq('event_id', eventId);
    await supabase.from('event_rsvps').delete().eq('event_id', eventId);
    await supabase.from('events').delete().eq('id', eventId);
    toast.success('Event deleted');
    navigate('/events');
  };

  if (loading) return <div className="loading-spinner"><div className="loading-spinner-ring" /><p className="loading-spinner-text">Loading…</p></div>;
  if (!event) return <div className="text-center py-16 text-muted-foreground font-medium text-sm">Event not found</div>;

  const userRsvp = rsvps.find(r => r.user_id === user?.id)?.status;
  const isCreator = user?.id === event.created_by;
  const goingList = rsvps.filter(r => r.status === 'going');
  const maybeList = rsvps.filter(r => r.status === 'maybe');
  const eventPast = isPast(new Date(event.starts_at));

  return (
    <div className="member-page max-w-2xl mx-auto">
      <div>
        {/* Nav */}
        <div className="flex items-center gap-1 justify-between mb-4">
          <button onClick={() => navigate('/events')} className="back-link mb-0">
            <ArrowLeft className="w-3.5 h-3.5" /> Events
          </button>
          <div className="flex items-center gap-1">
            <ShareButton contentType="event" contentId={eventId!} title={event.title} />
            {isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-11 h-11 rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center" aria-label="Event actions">
                    <MoreVertical className="w-4 h-4 text-muted-foreground/70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  <DropdownMenuItem onClick={() => setEditing(true)} className="text-xs gap-2">
                    <Pencil className="w-3.5 h-3.5" /> Edit Event
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteAlert(true)} className="text-xs gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Event
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Edit mode */}
        <AnimatePresence>
          {editing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-sm font-bold">Edit Event</h3>
                <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-11 text-sm font-semibold bg-muted/50 border-border/35 rounded-xl" />
                <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="text-sm min-h-[60px] bg-muted/50 border-border/25" />
                <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" className="h-11 text-xs bg-muted/50 border-border/35 rounded-xl" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 block">When</label>
                    <Input type="datetime-local" value={editForm.starts_at} onChange={e => setEditForm(f => ({ ...f, starts_at: e.target.value }))} className="h-11 text-xs bg-muted/50 border-border/35 rounded-xl" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 block">Until</label>
                    <Input type="datetime-local" value={editForm.ends_at} onChange={e => setEditForm(f => ({ ...f, ends_at: e.target.value }))} className="h-11 text-xs bg-muted/50 border-border/35 rounded-xl" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} disabled={!editForm.title.trim() || !editForm.starts_at} className="flex-1 h-11 text-xs font-bold rounded-xl gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)} className="h-11 w-11 p-0 text-xs rounded-xl" aria-label="Cancel editing">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Event header */}
        {!editing && (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{
                background: eventPast ? 'hsl(var(--muted) / 0.5)' : 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.04))',
              }}>
                <span className={cn("text-[9px] font-bold uppercase leading-none", eventPast ? 'text-muted-foreground/70' : 'text-primary')}>
                  {format(new Date(event.starts_at), 'MMM')}
                </span>
                <span className={cn("text-[18px] font-extrabold leading-none", eventPast ? 'text-muted-foreground/70' : 'text-primary')}>
                  {format(new Date(event.starts_at), 'd')}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-extrabold tracking-tight leading-tight">{event.title}</h1>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">by {event.profiles?.display_name}</p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-[12px] text-primary font-semibold">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(event.starts_at), 'EEEE, MMMM d · h:mm a')}
                {event.ends_at && ` — ${format(new Date(event.ends_at), 'h:mm a')}`}
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60">
                  <MapPin className="w-3.5 h-3.5" /> {event.location}
                </div>
              )}
              {event.description && (
                <p className="text-[13px] text-foreground/80 leading-relaxed mt-3">{event.description}</p>
              )}
            </div>
          </>
        )}

        {/* RSVP buttons */}
        {!eventPast && (
          <div className="flex gap-2 mb-6">
            {['going', 'maybe', 'pass'].map(status => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                onClick={() => handleRsvp(status)}
                className={cn(
                  "flex-1 h-11 text-xs font-bold capitalize rounded-xl transition-colors",
                  userRsvp === status
                    ? status === 'going' ? 'bg-success/20 text-success border border-success/30'
                      : status === 'maybe' ? 'bg-warning/20 text-warning border border-warning/30'
                      : 'bg-destructive/15 text-destructive border border-destructive/30'
                    : 'bg-muted/50 text-muted-foreground/70 border border-transparent hover:bg-muted/50'
                )}
              >
                {status === 'going' ? '✓ Going' : status === 'maybe' ? 'Maybe' : "Can't go"}
              </Button>
            ))}
          </div>
        )}

        {eventPast && (
          <div className="mb-6 px-3 py-2 rounded-xl bg-muted/50 border border-border/25">
            <p className="text-[11px] text-muted-foreground/70 font-medium text-center">This event has passed</p>
          </div>
        )}

        {/* Attendees */}
        {goingList.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Going ({goingList.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {goingList.map(r => (
                <span key={r.id} className="px-2.5 py-1 rounded-lg bg-success/10 text-[11px] font-semibold text-success/80">
                  {r.profiles?.display_name}
                </span>
              ))}
            </div>
          </div>
        )}
        {maybeList.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Maybe ({maybeList.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {maybeList.map(r => (
                <span key={r.id} className="px-2.5 py-1 rounded-lg bg-warning/10 text-[11px] font-semibold text-warning/80">
                  {r.profiles?.display_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Discussion */}
        <div className="border-t border-border/25 pt-4">
          <h3 className="text-[13px] font-bold mb-3">Discussion</h3>
          <div className="space-y-3 mb-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  <UserAvatar userId={c.user_id} name={c.profiles?.display_name || '?'} size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-foreground/80">{c.profiles?.display_name}</span>
                    <span className="text-[9px] text-muted-foreground/70">{format(new Date(c.created_at), 'MMM d · h:mm a')}</span>
                  </div>
                  <p className="text-[12px] text-foreground/80 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-xs text-muted-foreground/70">No comments yet — start the conversation</p>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 h-11 text-xs bg-muted/50 border-border/25"
            />
            <Button size="sm" onClick={handleComment} disabled={!newComment.trim()} className="h-11 w-11 p-0 rounded-xl" aria-label="Send comment">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{event.title}" and all RSVPs and comments. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
