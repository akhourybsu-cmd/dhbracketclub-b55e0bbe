import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Plus, MapPin, Clock, Users, ChevronRight, X,
  List, Grid3X3, ChevronLeft
} from 'lucide-react';
import {
  format, isPast, isToday, isTomorrow, isThisWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths, subMonths
} from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { memberData, memberErrorMessage } from '@/lib/memberData';
import { nextRsvpStatus, optimisticGoingCount, type RsvpStatus } from '@/lib/memberWorkflows';
import { MemberLoadError } from '@/components/member/MemberLoadError';

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  rsvp_count?: number;
  user_rsvp?: string | null;
  profiles?: { display_name: string };
};

export default function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calMonth, setCalMonth] = useState(new Date());
  const [form, setForm] = useState({ title: '', description: '', location: '', starts_at: '', ends_at: '' });
  const [creating, setCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = (await memberData(
        supabase
          .from('events')
          .select('*, profiles:created_by(display_name)')
          .order('starts_at', { ascending: true }),
        'Load events',
      )) ?? [];

      const eventIds = data.map(e => e.id);
      const rsvpMap = new Map<string, number>();
      const userRsvpMap = new Map<string, string>();

      if (eventIds.length > 0) {
        const rsvps = (await memberData(
          supabase.from('event_rsvps').select('*').in('event_id', eventIds),
          'Load event RSVPs',
        )) ?? [];
        rsvps.forEach(r => {
          if (r.status === 'going') rsvpMap.set(r.event_id, (rsvpMap.get(r.event_id) || 0) + 1);
          if (r.user_id === user.id) userRsvpMap.set(r.event_id, r.status);
        });
      }

      setEvents(data.map(e => ({
        ...e,
        rsvp_count: rsvpMap.get(e.id) || 0,
        user_rsvp: userRsvpMap.get(e.id) || null,
      })));
    } catch (loadError) {
      setError(memberErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.starts_at || !user) return;
    setCreating(true);
    let createdEventId: string | null = null;
    try {
      const data = await memberData(
        supabase.from('events').insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
          created_by: user.id,
        }).select().single(),
        'Create event',
      );
      createdEventId = data.id;
      await memberData(
        supabase.from('event_rsvps').insert({ event_id: data.id, user_id: user.id, status: 'going' }).select('id'),
        'Create event RSVP',
      );
      play('success');
      void logActivity(user.id, { event_type: 'event_created', target_type: 'event', target_id: data.id, metadata: { title: data.title } }).catch(() => {});

      // Fire-and-forget push notification.
      void supabase.functions.invoke('send-push-notification', {
        body: {
          type: 'event',
          title: '📅 New Event',
          message: data.title,
          url: `/events/${data.id}`,
          sender_user_id: user.id,
        },
      }).catch(() => {});

      setShowCreate(false);
      setForm({ title: '', description: '', location: '', starts_at: '', ends_at: '' });
      navigate(`/events/${data.id}`);
    } catch (createError) {
      if (createdEventId) {
        await memberData(supabase.from('event_rsvps').delete().eq('event_id', createdEventId).select('id'), 'Roll back event RSVP').catch(() => {});
        await memberData(supabase.from('events').delete().eq('id', createdEventId).select('id'), 'Roll back event').catch(() => {});
      }
      toast.error(memberErrorMessage(createError));
    } finally {
      setCreating(false);
    }
  };

  const handleRsvp = async (eventId: string, status: RsvpStatus) => {
    if (!user) return;
    play('tap');
    const snapshot = events;
    const current = events.find(event => event.id === eventId)?.user_rsvp as RsvpStatus | null | undefined;
    const next = nextRsvpStatus(current ?? null, status);
    setEvents(previous => previous.map(event => {
      if (event.id !== eventId) return event;
      return {
        ...event,
        user_rsvp: next,
        rsvp_count: optimisticGoingCount(event.rsvp_count ?? 0, current, next),
      };
    }));

    try {
      const existing = await memberData(
        supabase
          .from('event_rsvps')
          .select('id, status')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle(),
        'Check event RSVP',
      );

      if (existing) {
        if (next === null) {
          await memberData(supabase.from('event_rsvps').delete().eq('id', existing.id).select('id'), 'Remove event RSVP');
        } else {
          await memberData(supabase.from('event_rsvps').update({ status: next }).eq('id', existing.id).select('id'), 'Update event RSVP');
        }
      } else {
        if (next) {
          await memberData(
            supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id, status: next }).select('id'),
            'Create event RSVP',
          );
        }
      }
    } catch (rsvpError) {
      setEvents(snapshot);
      toast.error(memberErrorMessage(rsvpError));
    }
  };

  const getTimeLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isThisWeek(d)) return format(d, 'EEEE');
    return format(d, 'MMM d');
  };

  const upcoming = events.filter(e => !isPast(new Date(e.starts_at)));
  const past = events.filter(e => isPast(new Date(e.starts_at)));

  // Calendar helpers
  const calDays = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    const days = eachDayOfInterval({ start, end });
    const padStart = getDay(start); // 0=Sunday
    return { days, padStart };
  }, [calMonth]);

  const eventsOnDay = (day: Date) => events.filter(e => isSameDay(new Date(e.starts_at), day));

  return (
    <div className="member-page" aria-busy={loading}>
      <div>
        {/* Header */}
        <div className="page-toolbar">
          <div className="page-header mb-0">
            <div className="page-header-icon"><CalendarDays /></div>
            <div>
              <h1 className="page-header-title">Events</h1>
              <p className="page-header-subtitle">Hang outs & plans</p>
            </div>
          </div>
          <div className="page-toolbar-actions">
            <div className="flex rounded-xl overflow-hidden border border-border/30" role="group" aria-label="Event view">
              <button
                onClick={() => setView('list')}
                className={cn("w-11 h-11 flex items-center justify-center transition-colors", view === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
                aria-label="List view"
                aria-pressed={view === 'list'}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView('calendar')}
                className={cn("w-11 h-11 flex items-center justify-center transition-colors", view === 'calendar' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
                aria-label="Calendar view"
                aria-pressed={view === 'calendar'}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)} className="page-action gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> New
            </Button>
          </div>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold">New Event</h3>
                  <button onClick={() => setShowCreate(false)} className="w-11 h-11 -m-2 rounded-xl hover:bg-muted/50 flex items-center justify-center" aria-label="Close create form"><X className="w-4 h-4" /></button>
                </div>
                <Input
                  aria-label="Event title"
                  placeholder="What's the plan?"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="h-11 text-sm font-semibold bg-muted/50 border-border/35 rounded-xl"
                  autoFocus
                />
                <Textarea
                  aria-label="Event description"
                  placeholder="Add some details (optional)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="text-sm min-h-[60px] bg-muted/50 border-border/25"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      aria-label="Event location"
                      placeholder="Location"
                      value={form.location}
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      className="h-11 text-xs bg-muted/50 border-border/35 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="event-start" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 block">When</label>
                    <Input id="event-start" type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className="h-11 text-xs bg-muted/50 border-border/35 rounded-xl" />
                  </div>
                  <div>
                    <label htmlFor="event-end" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1 block">Until (opt.)</label>
                    <Input id="event-end" type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className="h-11 text-xs bg-muted/50 border-border/35 rounded-xl" />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={!form.title.trim() || !form.starts_at || creating} className="w-full h-11 text-xs font-bold rounded-xl">
                  {creating ? 'Creating...' : 'Create Event'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && !loading && <MemberLoadError message={error} onRetry={() => void fetchEvents()} />}

        {/* ═══ CALENDAR VIEW ═══ */}
        {view === 'calendar' && !loading && !error && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="w-11 h-11 rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center" aria-label="Previous month">
                <ChevronLeft className="w-4 h-4 text-muted-foreground/60" />
              </button>
              <h2 className="text-sm font-bold tracking-tight">{format(calMonth, 'MMMM yyyy')}</h2>
              <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="w-11 h-11 rounded-xl hover:bg-muted/50 transition-colors flex items-center justify-center" aria-label="Next month">
                <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
              </button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[9px] font-bold text-muted-foreground/70 py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: calDays.padStart }).map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {calDays.days.map(day => {
                const dayEvents = eventsOnDay(day);
                const isCurrentMonth = isSameMonth(day, calMonth);
                const today = isToday(day);
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    disabled={dayEvents.length !== 1}
                    aria-label={`${format(day, 'MMMM d, yyyy')}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}` : ''}`}
                    className={cn(
                      "aspect-square rounded-lg flex flex-col items-center justify-center relative transition-colors",
                      dayEvents.length === 1 && 'cursor-pointer',
                      today ? 'bg-primary/15' : dayEvents.length === 1 && 'hover:bg-muted/50',
                      !isCurrentMonth && 'opacity-30'
                    )}
                    onClick={() => navigate(`/events/${dayEvents[0].id}`)}
                  >
                    <span className={cn("text-[11px] font-semibold", today && 'text-primary')}>{format(day, 'd')}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5" aria-hidden="true">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Events this month */}
            {(() => {
              const monthEvents = events.filter(e => isSameMonth(new Date(e.starts_at), calMonth));
              if (monthEvents.length === 0) return null;
              return (
                <div className="mt-4 space-y-1.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">This Month</h3>
                  {monthEvents.map(event => (
                    <Link key={event.id} to={`/events/${event.id}`} className="block">
                      <div className="glass-card p-3 flex items-center gap-3 transition-all hover:border-primary/15">
                        <div className="w-9 h-9 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{
                          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))',
                        }}>
                          <span className="text-[8px] font-bold text-primary uppercase leading-none">{format(new Date(event.starts_at), 'MMM')}</span>
                          <span className="text-[14px] font-extrabold text-primary leading-none">{format(new Date(event.starts_at), 'd')}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-[13px] truncate">{event.title}</h4>
                          <p className="text-[10px] text-muted-foreground/70">{format(new Date(event.starts_at), 'h:mm a')}{event.location ? ` · ${event.location}` : ''}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ LIST VIEW ═══ */}
        {view === 'list' && loading && (
          <div className="space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl skeleton-shimmer flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 rounded-md w-2/3 skeleton-shimmer" />
                    <div className="h-2.5 rounded-md w-1/2 skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'list' && !loading && !error && (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="mb-6">
                <h2 className="section-header mb-3">
                  <CalendarDays className="w-3.5 h-3.5 inline-block mr-1.5 text-primary" />
                  Upcoming
                </h2>
                {/* lg: 2-col grid so wide desktops aren't a tall single
                    stack of event cards. Mobile/tablet unchanged. */}
                <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
                  {upcoming.map((event, i) => (
                    <motion.div key={event.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass-card p-4 transition-all duration-200 hover:border-primary/15">
                      <div className="relative z-10">
                        <Link to={`/events/${event.id}`} className="block group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Date badge */}
                                <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{
                                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))',
                                }}>
                                  <span className="text-[8px] font-bold text-primary uppercase leading-none">{format(new Date(event.starts_at), 'MMM')}</span>
                                  <span className="text-[16px] font-extrabold text-primary leading-none">{format(new Date(event.starts_at), 'd')}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-[14px] tracking-tight truncate">{event.title}</h3>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="flex items-center gap-1 text-[11px] text-primary font-semibold">
                                      <Clock className="w-3 h-3" />
                                      {getTimeLabel(event.starts_at)} · {format(new Date(event.starts_at), 'h:mm a')}
                                    </span>
                                    {event.location && (
                                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                                        <MapPin className="w-3 h-3" />
                                        {event.location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0 mt-1" />
                            </div>
                        </Link>
                        <div className="flex items-center justify-between mt-2 pl-14">
                          <span className="text-[10px] text-muted-foreground/60 font-medium flex items-center gap-1">
                            <Users className="w-3 h-3" /> {event.rsvp_count} going
                          </span>
                          <div className="flex gap-1" aria-label={`RSVP for ${event.title}`}>
                            {(['going', 'maybe'] as RsvpStatus[]).map(status => (
                              <button
                                type="button"
                                key={status}
                                onClick={() => void handleRsvp(event.id, status)}
                                aria-pressed={event.user_rsvp === status}
                                className={cn(
                                  "min-h-11 px-3 rounded-xl text-[10px] font-bold capitalize transition-colors",
                                  event.user_rsvp === status
                                    ? status === 'going' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                                    : 'bg-muted/50 text-muted-foreground/70 hover:bg-muted/70'
                                )}
                              >
                                {status === 'going' ? '✓ Going' : 'Maybe'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h2 className="section-header mb-3 text-muted-foreground/60">Past</h2>
                <div className="space-y-1.5 opacity-50 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2">
                  {past.slice(0, 5).map(event => (
                    <Link key={event.id} to={`/events/${event.id}`} className="block">
                      <div className="glass-card p-3 transition-all duration-200 hover:border-border/25">
                        <div className="flex items-center gap-3 relative z-10">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-[13px] truncate">{event.title}</h3>
                            <p className="text-[10px] text-muted-foreground/60">{format(new Date(event.starts_at), 'MMM d, yyyy · h:mm a')}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {events.length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--success) / 0.12), hsl(var(--success) / 0.04))' }}>
              <CalendarDays className="w-7 h-7 text-success/60" />
            </div>
            <p className="text-sm font-semibold text-foreground/70 mb-1">No events yet</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Plan something with the crew</p>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} className="h-11 gap-1.5 text-xs rounded-xl">
              <Plus className="w-3.5 h-3.5" /> Create Event
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
