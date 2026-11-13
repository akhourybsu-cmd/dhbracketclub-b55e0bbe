import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Copy, Crown, Layers3, Loader2, LogOut, Plus, RefreshCw, ShieldCheck, Sparkles, Trophy, Users, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useLineupDraft, type LineupParticipant, type LineupPick } from '@/hooks/useLineupDraft';
import { MakePickSheet } from '@/components/draft/MakePickSheet';
import { LineupRoster } from '@/components/draft/lineup/LineupRoster';
import { SlotPicker } from '@/components/draft/lineup/SlotPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';
import { draftInitials } from '@/lib/draft/presentation';
import '@/components/draft/lineup/lineup.css';
import '@/components/draft/lineup/lineupDetail.css';

const VIEWS = ['My lineup', 'All lineups', 'Pick log', 'Results'] as const;
type RoomView = (typeof VIEWS)[number];
const normalizePick = (text: string) => text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
const playerName = (player: LineupParticipant | undefined) => player?.profiles?.display_name?.trim() || 'Club member';

export default function LineupDraftDetailPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const { user } = useAuth();
  const { club } = useClub();
  return <LineupRoom key={`${user?.id ?? ''}:${club?.id ?? ''}:${draftId ?? ''}`} draftId={draftId} />;
}

function LineupRoom({ draftId }: { draftId: string | undefined }) {
  const { user, loading: authLoading } = useAuth();
  const { club, isClubAdmin, loading: clubLoading } = useClub();
  const { palette } = useDraftArenaPalette();
  const room = useLineupDraft(draftId);
  const id = useId();
  const [search] = useSearchParams();
  const [view, setView] = useState<RoomView>(() => search.get('view') === 'results' ? 'Results' : 'My lineup');
  const pickInput = useRef<HTMLInputElement>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [slotId, setSlotId] = useState('');
  const [pickText, setPickText] = useState('');
  const [composer, setComposer] = useState(false);
  const [help, setHelp] = useState(false);
  const [brief, setBrief] = useState(false);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [editingPick, setEditingPick] = useState<LineupPick | null>(null);
  const [editText, setEditText] = useState('');
  const [notice, setNotice] = useState('');
  const autoReport = useRef(false);
  const draft = room.draft;
  const participants = room.participants ?? [], picks = room.picks ?? [], results = room.results ?? [];
  const me = participants.find(player => player.user_id === user?.id);
  const host = !!draft && (draft.created_by === user?.id || isClubAdmin);
  const setup = draft?.status === 'setup';
  const active = draft?.status === 'in_progress';
  const complete = draft?.status === 'complete';
  const myTurn = active && draft?.current_pick_user_id === user?.id;
  const currentPlayer = participants.find(player => player.user_id === draft?.current_pick_user_id);
  const myPicks = picks.filter(pick => pick.user_id === user?.id);
  const openSlots = draft?.lineup_config.slots.filter(slot => !myPicks.some(pick => pick.lineup_slot_id === slot.id)) ?? [];
  const slotValid = openSlots.some(slot => slot.id === slotId);
  const duplicate = !!pickText.trim() && picks.some(pick => normalizePick(pick.pick_text) === normalizePick(pickText));
  const shownUser = selectedPlayer && participants.some(player => player.user_id === selectedPlayer)
    ? selectedPlayer : me?.user_id ?? participants[0]?.user_id ?? '';
  const shownPlayer = participants.find(player => player.user_id === shownUser);
  const shownResult = room.hasResults ? results.find(result => result.user_id === shownUser) : undefined;
  const ratings = shownResult ? new Map(shownResult.pick_ratings.map(rating => [rating.pick_id, rating])) : undefined;
  const totalExpected = participants.length * (draft?.lineup_config.slots.length ?? 0);
  const { loading, refreshing, hasResults, generateResults } = room;

  useEffect(() => {
    if (!loading && draft && complete && me && !hasResults && !refreshing && !autoReport.current) {
      autoReport.current = true;
      void generateResults();
    }
  }, [loading, refreshing, hasResults, generateResults, draft, complete, me]);
  useEffect(() => {
    if (composer && (!myTurn || !slotValid)) setComposer(false);
  }, [composer, myTurn, slotValid]);
  useEffect(() => {
    if (!room.loading && draft && !me && view === 'My lineup') setView('All lineups');
    if (draft && !complete && view === 'Results') setView(me ? 'My lineup' : 'All lineups');
  }, [me, view, room.loading, draft, complete]);
  const chooseSlot = (next: string) => {
    if (!myTurn || room.working || room.pending) return;
    setSlotId(next); setComposer(true); setNotice('');
  };
  const openComposer = () => {
    if (!myTurn || room.working || room.pending) return;
    setSlotId(previous => openSlots.some(slot => slot.id === previous) ? previous : openSlots[0]?.id ?? '');
    setComposer(true); setNotice('');
  };
  const submitPick = async () => {
    if (!myTurn || !slotValid || !pickText.trim() || duplicate || room.working) return;
    const result = await room.mutate('pick', { text: pickText.trim(), slot_id: slotId });
    if (result) { setComposer(false); setPickText(''); setNotice('Pick locked in.'); }
  };
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/drafts/lineup/${encodeURIComponent(draftId ?? '')}`); setNotice('Lineup link copied.'); }
    catch { setNotice('Copy the link from your browser to invite your club.'); }
  };
  const editPick = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPick || !editText.trim()) return;
    const result = await room.mutate('edit_pick', { pick_id: editingPick.id, text: editText.trim() });
    if (result) { setEditingPick(null); setNotice('Pick updated.'); }
  };

  if (room.loading || authLoading || clubLoading) return <section className="da-lineup da-lineup-page da-lineup-room" aria-busy="true"><div className="da-lineup-state" role="status"><Layers3 aria-hidden="true" /><h1>Opening your lineup…</h1><Button variant="outline" className="min-h-11" onClick={() => void room.refresh()}><RefreshCw aria-hidden="true" />Retry loading</Button></div></section>;
  if (!user || !club) return <section className="da-lineup da-lineup-page"><div className="da-lineup-state"><Layers3 aria-hidden="true" /><h1>Choose your club</h1><Link to="/drafts" className="da-lineup-text-link">Back to Draft Arena</Link></div></section>;
  if (!draft) return <section className="da-lineup da-lineup-page"><div className="da-lineup-state" role="alert"><Layers3 aria-hidden="true" /><h1>Lineup unavailable</h1><p>{room.error || 'This lineup is not available in your active club.'}</p><Button className="min-h-11" onClick={() => void room.refresh()}>Retry lineup</Button><Link to="/drafts/lineup" className="da-lineup-text-link">Back to Lineup Drafts</Link></div></section>;

  return <section className="da-lineup da-lineup-page da-lineup-room" data-lineup-status={draft.status}>
    <header className="da-lineup-room-header">
      <Link to="/drafts/lineup" className="da-lineup-icon-button" aria-label="Back to Lineup Drafts"><ArrowLeft aria-hidden="true" /></Link>
      <div><p className="dl-eyebrow">DRAFT ARENA · LINEUP</p><h1>{draft.topic}</h1></div>
      <Button type="button" variant="ghost" className="da-lineup-icon-button" onClick={() => setHelp(true)} aria-label="Lineup rules"><CircleHelp aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" className="da-lineup-icon-button" disabled={room.refreshing} onClick={() => void room.refresh()} aria-label="Refresh lineup"><RefreshCw className={room.refreshing ? 'animate-spin' : ''} aria-hidden="true" /></Button>
    </header>

    {room.error && <div className="da-lineup-alert" role="alert"><span>{room.error} Showing your last confirmed lineup.</span><Button variant="outline" className="min-h-11" onClick={() => void room.refresh()}>Retry</Button></div>}
    {room.pending && !room.working && <div className="da-lineup-alert" role="status"><span>{room.pending.action === 'pick' ? `Confirm your saved pick: ${String(room.pending.payload.text ?? '')}.` : 'A saved action needs confirmation.'}</span><Button className="min-h-11" onClick={async () => {
      const result = await room.retryPending();
      if (result) { setComposer(false); setPickText(''); setEditingPick(null); setNotice('Saved action confirmed.'); }
    }}>Retry saved action</Button></div>}
    {room.actionError && <p className="da-lineup-error" role="alert">{room.actionError}</p>}
    {notice && <p className="da-lineup-notice" role="status"><Check aria-hidden="true" />{notice}</p>}

    <div className="da-lineup-command" data-your-turn={myTurn}>
      <div className="da-lineup-command-mark" aria-hidden="true">{complete ? <Trophy /> : setup ? <Users /> : <Layers3 />}</div>
      <div className="da-lineup-command-copy">
        <p className="dl-eyebrow">{setup ? 'LOBBY' : complete ? 'LINEUPS LOCKED' : draft.status === 'cancelled' ? 'CANCELLED' : `ROUND ${draft.current_round} · PICK #${draft.current_pick_number}`}</p>
        <h2>{setup ? 'Build your crew.' : complete ? room.hasResults ? 'The verdict is in.' : 'Every slot is filled.' : draft.status === 'cancelled' ? 'This draft was cancelled.' : myTurn ? 'Your lineup. Your move.' : `${playerName(currentPlayer)} is choosing.`}</h2>
        <p>{setup ? `${participants.length} ${participants.length === 1 ? 'player' : 'players'} · ${draft.lineup_config.slots.length} slots each · snake order` : complete ? `${picks.length} picks locked in` : draft.status === 'cancelled' ? 'Your recorded picks remain visible.' : `${picks.length}/${totalExpected} picks · ${openSlots.length} of your slots open`}</p>
      </div>
      <div className="da-lineup-command-actions">
        {setup && !me && <Button disabled={room.working || !!room.pending} className="da-cta min-h-11" onClick={() => void room.mutate('join')}><Plus aria-hidden="true" />Join lineup</Button>}
        {setup && me && host && <Button disabled={room.working || !!room.pending || participants.length < 2} className="da-cta min-h-11" onClick={() => void room.mutate('start')}><Sparkles aria-hidden="true" />{room.working ? 'Starting…' : 'Start lineup'}</Button>}
        {setup && me && !host && <Button disabled={room.working || !!room.pending} variant="outline" className="min-h-11" onClick={() => void room.mutate('leave')}><LogOut aria-hidden="true" />Leave lineup</Button>}
        {setup && <Button variant="outline" className="min-h-11" onClick={() => void copyInvite()}><Copy aria-hidden="true" />Invite club</Button>}
        {myTurn && <Button className="da-cta min-h-11" disabled={room.working || !!room.pending} onClick={openComposer}><Plus aria-hidden="true" />Make selection<ArrowRight aria-hidden="true" /></Button>}
        {complete && !room.hasResults && (me || host) && <Button className="da-cta min-h-11" disabled={room.judging} onClick={() => void room.generateResults()}>{room.judging ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trophy aria-hidden="true" />}{room.judging ? 'Judging lineups…' : room.judgeError ? 'Retry judging' : 'Judge lineups'}</Button>}
      </div>
    </div>
    {room.judgeError && <p className="da-lineup-error" role="alert">{room.judgeError}</p>}
    {setup && host && participants.length < 2 && <p className="da-lineup-hint">Invite one more player to start.</p>}

    {(draft.competitions?.description || draft.ai_context) && <div className="da-lineup-brief">
      <button type="button" aria-expanded={brief} aria-controls={`${id}-brief`} onClick={() => setBrief(value => !value)}><ShieldCheck aria-hidden="true" /><span>Draft brief</span><ChevronDown aria-hidden="true" /></button>
      {brief && <div id={`${id}-brief`}>{draft.competitions?.description && <p>{draft.competitions.description}</p>}{draft.ai_context && <><h3>Judging notes</h3><p>{draft.ai_context}</p></>}</div>}
    </div>}

    {setup ? <>
      <div className="da-lineup-lobby-players" aria-label="Players in this lineup">{participants.map(player => <div key={player.user_id} className="da-lineup-lobby-player"><span aria-hidden="true">{draftInitials(playerName(player))}</span><strong>{playerName(player)}{player.user_id === user.id ? ' (you)' : ''}</strong>{player.user_id === draft.created_by && <Crown aria-label="Host" />}</div>)}</div>
      <p className="da-lineup-rating-rule"><ShieldCheck aria-hidden="true" />60% pick quality · 40% role fit</p>
      <LineupRoster config={draft.lineup_config} picks={[]} name="The lineup" artwork={room.artwork ?? new Map()} />
      {host && <Button variant="ghost" disabled={room.working || !!room.pending} className="da-lineup-cancel min-h-11" onClick={() => setCancelPrompt(true)}>Cancel lineup</Button>}
    </> : <>
      <div className="da-lineup-room-tabs" role="tablist" aria-label="Lineup views">{VIEWS.filter(item => (item !== 'My lineup' || !!me) && (item !== 'Results' || complete)).map(item => <button key={item} type="button" role="tab" aria-selected={view === item} aria-controls={`${id}-panel`} id={`${id}-${item.replace(/ /g, '-')}`} tabIndex={view === item ? 0 : -1} onClick={() => setView(item)} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const choices = VIEWS.filter(value => (value !== 'My lineup' || !!me) && (value !== 'Results' || complete));
        const current = choices.indexOf(view), index = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
        const next = choices[index]; setView(next); document.getElementById(`${id}-${next.replace(/ /g, '-')}`)?.focus();
      }}>{item}</button>)}</div>
      <div className="da-lineup-room-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${view.replace(/ /g, '-')}`}>
        {view === 'Pick log' ? <ol className="da-lineup-pick-log" aria-label="Lineup pick history">{picks.map(pick => <li key={pick.id}><span>#{pick.pick_number}</span><div><strong>{pick.pick_text}</strong><p>{draft.lineup_config.slots.find(slot => slot.id === pick.lineup_slot_id)?.label} · {playerName(participants.find(player => player.user_id === pick.user_id))}</p></div></li>)}</ol>
          : view === 'Results' ? <>
            {!room.hasResults ? <div className="da-lineup-state" role="status">{room.judging ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trophy aria-hidden="true" />}<h3>{room.judging ? 'Judging each role…' : 'The report is not ready yet.'}</h3><p>Your completed lineups are saved.</p>{(me || host) && <Button disabled={room.judging} className="min-h-11" onClick={() => void room.generateResults()}>Retry report</Button>}</div> : <>
              <p className="da-lineup-rating-rule"><ShieldCheck aria-hidden="true" />60% pick quality · 40% role fit</p><div className="da-lineup-results" aria-label="Final standings">{results.map(result => <button type="button" key={result.user_id} className="da-lineup-result" data-selected={shownUser === result.user_id} onClick={() => setSelectedPlayer(result.user_id)} aria-pressed={shownUser === result.user_id}><span className="da-lineup-result-rank">{result.rank === 1 ? <Trophy aria-label="Winner" /> : `#${result.rank}`}</span><strong>{playerName(participants.find(player => player.user_id === result.user_id))}</strong><span className="da-lineup-result-score">{Number(result.total_score).toFixed(1)}<small>/{draft.lineup_config.slots.length * 10}</small></span></button>)}</div>
              {shownResult?.summary && <p className="da-lineup-result-summary">{shownResult.summary}</p>}
              <LineupRoster config={draft.lineup_config} picks={picks.filter(pick => pick.user_id === shownUser)} name={playerName(shownPlayer)} artwork={room.artwork ?? new Map()} ratings={ratings} />
              <Link to={`/drafts/lineup/create?template=${encodeURIComponent(draft.lineup_config.template_id)}`} state={{ lineupConfig: draft.lineup_config, topic: draft.topic }} className="da-cta da-lineup-next-draft"><Plus aria-hidden="true" />Build another lineup<ArrowRight aria-hidden="true" /></Link>
            </>}
          </> : <>
            {view === 'All lineups' && <div className="da-lineup-player-switcher" role="group" aria-label="Choose a player lineup">{participants.map(player => <button type="button" key={player.user_id} aria-pressed={shownUser === player.user_id} onClick={() => setSelectedPlayer(player.user_id)}><span>{draftInitials(playerName(player))}</span><strong>{playerName(player)}</strong><small>{picks.filter(pick => pick.user_id === player.user_id).length}/{draft.lineup_config.slots.length}</small></button>)}</div>}
            <LineupRoster config={draft.lineup_config} picks={view === 'My lineup' ? myPicks : picks.filter(pick => pick.user_id === shownUser)} name={view === 'My lineup' ? 'Your' : playerName(shownPlayer)} artwork={room.artwork ?? new Map()} current={view === 'My lineup' && myTurn} canChoose={view === 'My lineup' && myTurn && !room.working && !room.pending} onChooseSlot={chooseSlot}
              onEditPick={active && (view === 'My lineup' || shownUser === user.id || host) && !room.pending ? pick => { setEditingPick(pick); setEditText(pick.pick_text); } : undefined} />
          </>}
      </div>
    </>}

    {active && host && <Button variant="ghost" disabled={room.working || !!room.pending} className="da-lineup-cancel min-h-11" onClick={() => setCancelPrompt(true)}>Cancel lineup</Button>}

    <MakePickSheet open={composer} onClose={() => setComposer(false)} currentRound={draft.current_round ?? 1} currentPickNumber={draft.current_pick_number ?? picks.length + 1} draftId={draft.id} userId={user.id} taken={new Set(picks.map(pick => pick.pick_text.trim().toLowerCase()))}
      inputRef={pickInput} readOnly={!!room.pending} pickText={pickText} onTextChange={setPickText} onSubmit={() => void submitPick()} submitting={room.working} localDuplicate={duplicate} suggestion={null} onApplyCorrection={setPickText} onDismissSuggestion={() => {}} topic={draft.topic} canSubmit={myTurn && slotValid && !room.pending}
      slotPicker={<><SlotPicker config={draft.lineup_config} picks={myPicks} selected={slotId} onSelect={next => { setSlotId(next); pickInput.current?.focus({ preventScroll: true }); }} disabled={room.working || !!room.pending} />
        {room.actionError && <p className="da-lineup-error" role="alert">{room.actionError}</p>}
        {room.pending && !room.working && <p className="da-lineup-hint">Confirm “{String(room.pending.payload.text ?? pickText)}” before editing.</p>}
        {room.pending && !room.working && <Button type="button" className="min-h-11 mb-3" onClick={async () => { const result = await room.retryPending(); if (result) { setComposer(false); setPickText(''); setNotice('Pick confirmed.'); } }}>Retry saved pick</Button>}
      </>} />

    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="da-appearance-panel da-lounge da-arena-dialog da-form-dialog da-lineup-help" data-da-palette={palette}><DialogHeader className="da-form-dialog-header"><DialogTitle>Build your best lineup</DialogTitle><DialogDescription>Same slots. Your choices.</DialogDescription></DialogHeader><div className="da-form-dialog-body"><ol><li><span>1</span><div><strong>Choose any open slot</strong><p>Everyone fills the same lineup. The slot order is up to you.</p></div></li><li><span>2</span><div><strong>Draft your pick</strong><p>One pick fills one slot. Taken picks are off the board for everyone.</p></div></li><li><span>3</span><div><strong>Make the team work</strong><p>Scores weigh pick quality at 60% and fit for the assigned role at 40%. The report also discusses the completed team.</p></div></li></ol><p className="da-lineup-hint">The draft snakes back each round. You can leave and return on your turn.</p></div><div className="da-form-dialog-actions"><Button onClick={() => setHelp(false)}>Got it</Button></div></DialogContent></Dialog>

    <Dialog open={!!editingPick} onOpenChange={open => { if (!open && !room.working) setEditingPick(null); }}><DialogContent className="da-appearance-panel da-lounge da-arena-dialog da-form-dialog" data-da-palette={palette}><DialogHeader className="da-form-dialog-header"><DialogTitle>Edit pick</DialogTitle><DialogDescription>{draft.lineup_config.slots.find(slot => slot.id === editingPick?.lineup_slot_id)?.label}</DialogDescription></DialogHeader><form className="da-form-dialog-form" onSubmit={event => void editPick(event)}><div className="da-form-dialog-body"><label className="da-lineup-edit-label">Pick name<Input value={editText} onChange={event => setEditText(event.target.value)} maxLength={100} className="min-h-11 text-base" disabled={room.working} readOnly={!!room.pending} /></label>{room.actionError && <p className="da-lineup-error" role="alert">{room.actionError}</p>}</div><div className="da-form-dialog-actions"><Button type="button" variant="outline" disabled={room.working} onClick={() => setEditingPick(null)}>Cancel</Button>{room.pending && !room.working ? <Button type="button" onClick={async () => { const result = await room.retryPending(); if (result) { setEditingPick(null); setNotice('Pick updated.'); } }}>Retry saved edit</Button> : <Button type="submit" disabled={room.working || !editText.trim()}>{room.working ? 'Saving…' : 'Save pick'}</Button>}</div></form></DialogContent></Dialog>

    <Dialog open={cancelPrompt} onOpenChange={setCancelPrompt}><DialogContent className="da-appearance-panel da-lounge da-arena-dialog da-form-dialog" data-da-palette={palette}><DialogHeader className="da-form-dialog-header"><DialogTitle>Cancel this lineup?</DialogTitle><DialogDescription>It will close this draft for everyone. Existing picks remain saved.</DialogDescription></DialogHeader><div className="da-form-dialog-actions"><Button variant="outline" onClick={() => setCancelPrompt(false)}>{room.pending ? 'Close' : 'Keep lineup'}</Button>{room.pending && !room.working ? <Button variant="destructive" onClick={async () => { const result = await room.retryPending(); if (result) setCancelPrompt(false); }}>Confirm saved cancellation</Button> : <Button variant="destructive" disabled={room.working} onClick={async () => { const result = await room.mutate('cancel'); if (result) setCancelPrompt(false); }}><X aria-hidden="true" />Cancel lineup</Button>}</div></DialogContent></Dialog>
  </section>;
}
