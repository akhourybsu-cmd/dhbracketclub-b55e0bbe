import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Hash, Loader2, Radio, RefreshCw, Swords, Ticket, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { useDraftListUpdates } from '@/hooks/useRealtimeSubscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchLiveRooms, normalizeLiveCode, resolveLiveRoom, LIVE_ROOM_UNAVAILABLE_MESSAGE,
  type LiveRoomSummary,
} from '@/lib/draft/liveRooms';

const FILTERS = [
  { id: 'all', label: 'All rooms' },
  { id: 'setup', label: 'Lobby' },
  { id: 'in_progress', label: 'Live now' },
  { id: 'complete', label: 'Finished' },
] as const;
type RoomFilter = (typeof FILTERS)[number]['id'];

export default function LiveDraftsPage() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const { enabled: hostingEnabled } = useFeatureFlag('live-draft');
  if (authLoading || clubLoading) return <div className="da-live-hub da-live-hub-pending" role="status"><Loader2 className="animate-spin" aria-hidden="true" /><p>Opening LIVE…</p></div>;
  if (!user || !club) return <div className="da-live-hub da-live-hub-empty"><Radio aria-hidden="true" /><h1>Your club’s live arena</h1><p>Choose your club to find its live events.</p></div>;
  const queryCode = normalizeLiveCode(new URLSearchParams(location.search).get('code') ?? '');
  return <LiveHubSession key={`${user.id}:${club.id}`} userId={user.id} clubId={club.id} clubName={club.name} hostingEnabled={hostingEnabled} queryCode={queryCode} />;
}

function LiveHubSession({ userId, clubId, clubName, hostingEnabled, queryCode }: {
  userId: string; clubId: string; clubName: string; hostingEnabled: boolean; queryCode: string;
}) {
  const navigate = useNavigate();
  const formId = useId();
  const [rooms, setRooms] = useState<LiveRoomSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [code, setCode] = useState(queryCode);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const active = useRef(true);
  const requests = useRef({ fetch: 0, lookup: 0, lookupBusy: false }).current;
  const scroller = useRef<HTMLDivElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!active.current) return;
    const request = ++requests.fetch;
    setLoading(true);
    setLoadError('');
    try {
      const rows = await fetchLiveRooms(clubId);
      if (active.current && request === requests.fetch) {
        setRooms(rows);
        setHasLoaded(true);
      }
    } catch {
      if (active.current && request === requests.fetch) setLoadError('Live rooms could not be loaded. Try again.');
    } finally {
      if (active.current && request === requests.fetch) setLoading(false);
    }
  }, [clubId, requests]);

  useLayoutEffect(() => {
    active.current = true;
    void load();
    return () => {
      active.current = false;
      requests.fetch++;
      requests.lookup++;
    };
  }, [load, requests]);

  useLayoutEffect(() => {
    requests.lookup++;
    requests.lookupBusy = false;
    setJoining(false);
    setJoinError('');
    setCode(queryCode);
  }, [queryCode, requests]);

  useDraftListUpdates(load, true);
  useEffect(() => {
    const refreshOnReturn = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => document.removeEventListener('visibilitychange', refreshOnReturn);
  }, [load]);

  const findRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requests.lookupBusy) return;
    const normalized = normalizeLiveCode(code);
    if (normalized.length !== 5) {
      setJoinError('Enter the five-character code from your host.');
      codeInput.current?.focus();
      return;
    }
    requests.lookupBusy = true;
    const request = ++requests.lookup;
    setJoining(true);
    setJoinError('');
    setCode(normalized);
    try {
      const room = await resolveLiveRoom(normalized, clubId);
      if (active.current && request === requests.lookup) navigate(`/drafts/live/${encodeURIComponent(room.id)}`);
    } catch {
      if (active.current && request === requests.lookup) {
        setJoinError(LIVE_ROOM_UNAVAILABLE_MESSAGE);
        codeInput.current?.focus();
      }
    } finally {
      if (active.current && request === requests.lookup) {
        requests.lookupBusy = false;
        setJoining(false);
      }
    }
  };
  const visibleRooms = filter === 'all' ? rooms : rooms.filter((room) => room.status === filter);

  return (
    <section className="da-live-hub" aria-labelledby={`${formId}-title`}>
      <div className="da-live-hub-command">
        <header className="da-live-hub-hero">
          <div className="da-live-hub-stage" aria-hidden="true"><Radio /><i /><i /></div>
          <div className="da-live-hub-copy">
            <p className="da-arena-eyebrow"><span className="da-live-dot" aria-hidden="true" />DRAFT ARENA · LIVE</p>
            <h1 id={`${formId}-title`}>Draft night, live.</h1>
            <p>Find your room. Take your seat.</p>
            <span className="da-live-club" title={clubName}>{clubName}</span>
          </div>
          {hostingEnabled && <Link className="da-live-host-action da-cta" to="/drafts/live/create"><Swords aria-hidden="true" />Host live event<ArrowUpRight aria-hidden="true" /></Link>}
        </header>

        <form className="da-live-join" onSubmit={(event) => void findRoom(event)} aria-label="Find a live room" aria-busy={joining}>
          <div className="da-live-join-heading"><Ticket aria-hidden="true" /><label htmlFor={`${formId}-code`}>Room code</label><span>From your host</span></div>
          <div className="da-live-join-fields">
            <span className="da-live-code-input"><Hash aria-hidden="true" /><Input ref={codeInput} id={`${formId}-code`} value={code} maxLength={16} onChange={(event) => { if (!requests.lookupBusy) { setCode(event.target.value.toUpperCase()); setJoinError(''); } }} readOnly={joining} placeholder="ABCDE" autoComplete="off" autoCapitalize="characters" enterKeyHint="go" spellCheck={false} aria-invalid={!!joinError} aria-describedby={`${formId}-code-help${joinError ? ` ${formId}-code-error` : ''}`} /></span>
            <Button type="submit" className="da-live-find-action da-cta" disabled={joining || !code.trim()}>{joining ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}<span>{joining ? 'Finding room…' : 'Find live room'}</span></Button>
          </div>
          <p id={`${formId}-code-help`} className="da-live-join-help">Enter the five-character code to open your player room.</p>
          {joinError && <p id={`${formId}-code-error`} className="da-live-join-error" role="alert">{joinError}</p>}
        </form>
      </div>

      <Tabs value={filter} onValueChange={(value) => { setFilter(value as RoomFilter); if (scroller.current) scroller.current.scrollTop = 0; }} className="da-live-hub-workspace">
        <div className="da-live-rooms-heading">
          <div className="da-live-rooms-title"><h2>Recent rooms <span>{rooms.length}</span></h2><p className="da-live-room-sync" role="status" data-sync-state={hasLoaded && loadError ? 'error' : loading ? 'loading' : 'ready'}>{hasLoaded && loading ? 'Updating rooms…' : hasLoaded && loadError ? 'Update paused · showing saved rooms' : ''}</p></div>
          <Button type="button" variant="ghost" className="da-live-refresh h-11 w-11 shrink-0 p-0" aria-label={hasLoaded && loadError ? 'Retry room update' : 'Refresh live rooms'} title={hasLoaded && loadError ? 'Retry room update' : 'Refresh live rooms'} disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" /></Button>
        </div>
        <TabsList className="da-live-status-tabs h-auto min-h-11 justify-start overflow-x-auto" aria-label="Live room status">
          {FILTERS.map((item) => <TabsTrigger value={item.id} className="min-h-11 shrink-0" key={item.id}>{item.label}<span>{item.id === 'all' ? rooms.length : rooms.filter((room) => room.status === item.id).length}</span></TabsTrigger>)}
        </TabsList>
        <div className="da-live-room-scroll" ref={scroller} aria-busy={loading && !hasLoaded}>
          <TabsContent value={filter} className="da-live-room-panel">
            {!hasLoaded && loadError ? <div className="da-live-room-state" role="alert"><Radio aria-hidden="true" /><h3>Connection interrupted</h3><p>{loadError}</p><Button type="button" className="min-h-11" onClick={() => void load()}>Retry live rooms</Button></div>
              : loading && !hasLoaded ? <div className="da-live-room-state" role="status"><Loader2 className="animate-spin" aria-hidden="true" /><p>Finding your club’s rooms…</p></div>
                : visibleRooms.length === 0 ? <div className="da-live-room-state"><Radio aria-hidden="true" /><h3>{rooms.length === 0 ? 'The stage is clear.' : 'No rooms in this view.'}</h3><p>{rooms.length === 0 ? hostingEnabled ? 'Host an event or use a code to find your room.' : 'Use a room code to enter your club’s event.' : 'Choose another status to find your event.'}</p></div>
                  : <div className="da-live-room-grid">{visibleRooms.map((room) => <LiveRoomCard key={room.id} room={room} hosting={room.created_by === userId} />)}</div>}
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}

function LiveRoomCard({ room, hosting }: { room: LiveRoomSummary; hosting: boolean }) {
  const state = room.status === 'in_progress' ? 'Live now' : room.status === 'complete' ? 'Final' : room.status === 'setup' ? 'Lobby' : 'Room';
  const action = room.status === 'complete' ? 'View final' : room.status === 'setup' ? 'Enter lobby' : 'Open live room';
  const StatusIcon = room.status === 'complete' ? Trophy : room.status === 'setup' ? Ticket : Radio;
  return <Link to={`/drafts/live/${encodeURIComponent(room.id)}`} className="da-live-room-card" data-room-status={room.status} aria-label={`${action}: ${room.topic}`}>
    <div className="da-live-room-card-heading"><span className="da-live-room-status"><StatusIcon aria-hidden="true" />{state}</span>{hosting && <span className="da-live-owned">Your event</span>}</div>
    <h3>{room.topic}</h3>
    <div className="da-live-room-meta"><span>{room.num_rounds} {room.num_rounds === 1 ? 'round' : 'rounds'}</span>{room.kiosk_code && <code aria-label={`Room code ${room.kiosk_code}`}>{room.kiosk_code}</code>}</div>
    <footer><span>{action}</span><ArrowUpRight aria-hidden="true" /></footer>
  </Link>;
}
