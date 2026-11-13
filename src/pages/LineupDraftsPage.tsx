import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock3, Layers3, Loader2, Plus, RefreshCw, Swords, Trophy, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { useLineupDrafts, type LineupDraftSummary } from '@/hooks/useLineupDraft';
import { LINEUP_TEMPLATES } from '@/lib/draft/lineup';
import { LineupArtwork } from '@/components/draft/lineup/LineupArtwork';
import '@/components/draft/lineup/lineup.css';

type LineupFilter = 'all' | 'turn' | 'setup' | 'playing' | 'complete';
const FILTERS: Array<{ id: LineupFilter; label: string }> = [
  { id: 'all', label: 'All lineups' }, { id: 'turn', label: 'Your turn' },
  { id: 'setup', label: 'Lobbies' }, { id: 'playing', label: 'Playing' }, { id: 'complete', label: 'Finished' },
];

export default function LineupDraftsPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  if (authLoading || clubLoading) return <section className="da-lineup da-lineup-state" role="status"><Loader2 className="animate-spin" aria-hidden="true" /><p>Opening Lineup Drafts…</p></section>;
  if (!user || !club) return <section className="da-lineup da-lineup-state"><Layers3 aria-hidden="true" /><h1>Your club’s lineups</h1><p>Choose your club to find its drafts.</p><Link to="/drafts" className="da-cta">Back to Draft Arena</Link></section>;
  return <LineupHub key={`${user.id}:${club.id}`} userId={user.id} clubName={club.name} />;
}

function matchesFilter(row: LineupDraftSummary, filter: LineupFilter, userId: string) {
  if (filter === 'turn') return row.status === 'in_progress' && row.current_pick_user_id === userId;
  if (filter === 'playing') return row.status === 'in_progress';
  if (filter === 'complete') return row.status === 'complete';
  return filter === 'all' || row.status === filter;
}

function LineupHub({ userId, clubName }: { userId: string; clubName: string }) {
  const { drafts, loading, error, refresh, refreshing } = useLineupDrafts();
  const [filter, setFilter] = useState<LineupFilter>('all');
  const nextTurn = drafts.find(row => row.status === 'in_progress' && row.current_pick_user_id === userId);
  const visible = drafts.filter(row => matchesFilter(row, filter, userId));
  return <section className="da-lineup da-lineup-hub da-ledger-page" aria-labelledby="lineup-hub-title">
    <header className="da-lineup-hero">
      <div className="da-lineup-hero-copy"><p className="da-arena-eyebrow">DRAFT ARENA · LINEUP</p><h1 id="lineup-hub-title">Every pick<br />has a place.</h1><span className="da-lineup-club"><Users aria-hidden="true" />{clubName}</span><Link to="/drafts/lineup/create" className="da-lineup-create-link da-cta"><Plus aria-hidden="true" />Create lineup<ArrowRight aria-hidden="true" /></Link></div>
      <div className="da-lineup-hero-art" aria-hidden="true"><LineupArtwork template="football-skills" /><span><Check />Choose a role. Make your pick.</span></div>
    </header>
    {nextTurn && <Link className="da-lineup-turn-callout" to={`/drafts/lineup/${encodeURIComponent(nextTurn.id)}`}><span className="da-lineup-turn-mark"><Swords aria-hidden="true" /></span><span><small>Your turn</small><b>{nextTurn.topic}</b></span><ArrowRight aria-hidden="true" /></Link>}
    <div className="da-lineup-hub-body">
      <section className="da-lineup-room-section" aria-labelledby="lineup-rooms-title">
        <div className="da-lineup-section-heading"><h2 id="lineup-rooms-title">Your club’s lineups <span>{drafts.length}</span></h2><Button variant="ghost" type="button" className="da-lineup-refresh" aria-label={error ? 'Retry lineup drafts' : 'Refresh lineup drafts'} disabled={loading || refreshing} onClick={() => void refresh()}><RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : ''} /></Button></div>
        <div className="da-lineup-status-filters" role="group" aria-label="Lineup status">
          {FILTERS.map(item => <button type="button" key={item.id} aria-pressed={item.id === filter} onClick={() => setFilter(item.id)}>{item.label}<span>{drafts.filter(row => matchesFilter(row, item.id, userId)).length}</span></button>)}
        </div>
        {error && <div className="da-lineup-error" role="alert"><p>{error}</p>{drafts.length > 0 && <small>Showing the last loaded lineups.</small>}<Button variant="outline" type="button" className="min-h-11" onClick={() => void refresh()} disabled={loading || refreshing}>Try again</Button></div>}
        {loading && drafts.length === 0 ? <div className="da-lineup-state" role="status"><Loader2 className="animate-spin" aria-hidden="true" /><p>Finding your club’s lineups…</p></div>
          : visible.length > 0 ? <div className="da-lineup-room-grid">{visible.map(row => <LineupRoomCard key={row.id} room={row} userId={userId} />)}</div>
            : !error && <div className="da-lineup-state"><Layers3 aria-hidden="true" /><h3>{filter === 'turn' ? 'You’re all caught up.' : drafts.length === 0 ? 'Build the first lineup.' : 'No lineups in this view.'}</h3>{drafts.length === 0 ? <Link to="/drafts/lineup/create" className="da-cta"><Plus aria-hidden="true" />Create lineup</Link> : <Button type="button" variant="outline" className="min-h-11" onClick={() => setFilter('all')}>Show all lineups</Button>}</div>}
      </section>
      <aside className="da-lineup-template-shelf" aria-labelledby="lineup-ideas-title"><div className="da-lineup-section-heading"><h2 id="lineup-ideas-title">Pick a starting lineup</h2></div><div className="da-lineup-template-shelf-grid">{LINEUP_TEMPLATES.filter(item => item.id !== 'custom').map(item => <Link key={item.id} to={`/drafts/lineup/create?template=${encodeURIComponent(item.id)}`} className="da-lineup-template-mini"><LineupArtwork template={item.id} /><span><b>{item.name}</b><small>{item.slots.length} slots</small></span><ArrowRight aria-hidden="true" /></Link>)}</div></aside>
    </div>
  </section>;
}

function LineupRoomCard({ room, userId }: { room: LineupDraftSummary; userId: string }) {
  const template = LINEUP_TEMPLATES.find(item => item.id === room.lineup_config.template_id);
  const isTurn = room.status === 'in_progress' && room.current_pick_user_id === userId;
  const finished = room.status === 'complete', cancelled = room.status === 'cancelled';
  const state = cancelled ? 'Cancelled' : finished ? 'Final' : isTurn ? 'Your turn' : room.status === 'setup' ? 'Lobby' : 'Playing';
  const action = cancelled ? 'View lineup' : finished ? 'View results' : isTurn ? 'Fill your next slot' : room.status === 'setup' ? room.joined ? 'Return to lobby' : 'Join lobby' : 'Open lineup';
  const StatusIcon = cancelled ? X : finished ? Trophy : isTurn ? Swords : room.status === 'setup' ? Users : Clock3;
  return <Link to={`/drafts/lineup/${encodeURIComponent(room.id)}${finished ? '?view=results' : ''}`} className="da-lineup-room-card" data-lineup-status={room.status} data-your-turn={isTurn || undefined} aria-label={`${action}: ${room.topic}`}>
    <div className="da-lineup-room-art"><LineupArtwork template={room.lineup_config.template_id} /><span className="da-lineup-room-state"><StatusIcon aria-hidden="true" />{state}</span></div>
    <div className="da-lineup-room-copy"><small className="da-arena-eyebrow">{template?.name ?? 'Custom lineup'}</small><h3>{room.topic}</h3><div className="da-lineup-room-meta"><span><Layers3 aria-hidden="true" />{room.lineup_config.slots.length} slots</span><span><Users aria-hidden="true" />{room.participant_count} {room.participant_count === 1 ? 'player' : 'players'}</span>{room.created_by === userId && <span>Your draft</span>}</div><div className="da-lineup-room-slot-preview" aria-hidden="true">{room.lineup_config.slots.slice(0, 4).map(slot => <span key={slot.id}>{slot.label}</span>)}{room.lineup_config.slots.length > 4 && <span>+{room.lineup_config.slots.length - 4}</span>}</div><span className="da-lineup-room-action">{action}<ArrowRight aria-hidden="true" /></span></div>
  </Link>;
}
