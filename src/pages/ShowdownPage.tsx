import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Clock3, History, Inbox, Loader2, Plus, RefreshCw, Swords, Trophy, Users, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useShowdownLobby } from '@/hooks/useShowdown';
import { getShowdownGame } from '@/lib/showdown/registry';
import type { ShowdownChallenge, ShowdownMember } from '@/lib/showdown/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showdownDate, showdownTimeLeft } from '@/components/showdown/showdownPresentation';
import { AfterimageMark } from '@/components/showdown/AfterimageMark';
import { PrismMark, ShowdownAvatar, ShowdownDataState, ShowdownFrame } from '@/components/showdown/ShowdownChrome';

const SECTIONS = [
  { id: 'inbox', label: 'Inbox', icon: Inbox }, { id: 'play', label: 'Play', icon: Zap },
  { id: 'waiting', label: 'Waiting', icon: Clock3 }, { id: 'history', label: 'History', icon: History },
  { id: 'standings', label: 'Ranks', icon: Trophy },
] as const;
type Section = typeof SECTIONS[number]['id'];
type Decision = { challenge: ShowdownChallenge; action: 'decline' | 'cancel' };

function isOpen(challenge: ShowdownChallenge) { return challenge.status === 'pending' || challenge.status === 'active'; }
function challengeLabel(challenge: ShowdownChallenge, viewerId: string) {
  if (challenge.status === 'completed') return challenge.outcome === 'draw' ? 'Draw' : challenge.winner_id === viewerId ? 'Victory' : 'Defeat';
  if (!isOpen(challenge)) return challenge.status[0].toUpperCase() + challenge.status.slice(1);
  const me = challenge.players.find(player => player.user_id === viewerId);
  return me?.finished_at ? 'Waiting for rival' : me?.started_at ? 'Your run' : 'New challenge';
}

export default function ShowdownPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  if (authLoading || clubLoading) return <ShowdownFrame><ShowdownDataState /></ShowdownFrame>;
  if (!user || !club) return <ShowdownFrame><div className="sd-data-state"><Users aria-hidden="true" /><h1>Find your rivals.</h1><p>Choose your club to challenge its members.</p><Link className="sd-button sd-primary" to="/club">Open your club</Link></div></ShowdownFrame>;
  return <ShowdownLobbySession key={`${user.id}:${club.id}`} viewerId={user.id} clubName={club.name} />;
}

function ShowdownLobbySession({ viewerId, clubName }: { viewerId: string; clubName: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [gameKey, setGameKey] = useState(() => { const requestedGame = params.get('game'); return requestedGame && getShowdownGame(requestedGame)?.enabled ? requestedGame : 'prism_break'; });
  const lobby = useShowdownLobby(gameKey);
  const data = lobby.data;
  const [choosing, setChoosing] = useState(() => params.get('challenge') === 'new');
  const [chosenGame, setChosenGame] = useState(gameKey);
  const [recipientId, setRecipientId] = useState(() => params.get('recipient') ?? '');
  const [playNow, setPlayNow] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [notice, setNotice] = useState('');
  const mutation = useRef(false);
  const activeSession = useRef(true);
  useLayoutEffect(() => { activeSession.current = true; return () => { activeSession.current = false; }; }, []);
  const intent = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const scope = useRef(viewerId);
  scope.current = viewerId;
  const formId = useId();
  useLayoutEffect(() => {
    const requestedGame = params.get('game') ?? 'prism_break';
    if (getShowdownGame(requestedGame)?.enabled) setGameKey(requestedGame);
    if (params.get('challenge') === 'new') { setChoosing(true); setChosenGame(requestedGame); setRecipientId(params.get('recipient') ?? ''); }
  }, [params]);
  const availableGames = data?.games.filter(game => game.enabled && getShowdownGame(game.game_key)?.enabled) ?? [];
  const members = data?.members.filter(member => member.user_id !== viewerId) ?? [];
  const selectedMember = members.find(member => member.user_id === recipientId);
  const selectedGame = availableGames.find(game => game.game_key === chosenGame);
  const currentGame = data?.games.find(game => game.game_key === gameKey);
  const currentRegistration = getShowdownGame(gameKey);
  const selectedRegistration = getShowdownGame(chosenGame);
  const roundNoun = currentRegistration?.roundNoun ?? 'rounds';
  const gameName = currentGame?.name ?? currentRegistration?.name ?? 'Showdown';
  const afterimage = gameKey === 'afterimage';
  const Mark = afterimage ? AfterimageMark : PrismMark;
  const active = data?.challenges.filter(isOpen) ?? [];
  const incoming = active.filter(challenge => challenge.recipient_id === viewerId && !challenge.players.find(player => player.user_id === viewerId)?.started_at);
  const playable = active.filter(challenge => !challenge.players.find(player => player.user_id === viewerId)?.finished_at);
  const waiting = active.filter(challenge => Boolean(challenge.players.find(player => player.user_id === viewerId)?.finished_at));
  const historical = data?.challenges.filter(challenge => !isOpen(challenge)) ?? [];
  const requested = params.get('tab');
  const section: Section = SECTIONS.some(tab => tab.id === requested) ? requested as Section : incoming.length ? 'inbox' : 'play';
  const visible = section === 'inbox' ? incoming : section === 'play' ? playable : section === 'waiting' ? waiting : historical;
  const counts: Partial<Record<Section, number>> = { inbox: incoming.length, play: playable.length, waiting: waiting.length };
  const openChooser = () => { setChoosing(true); setChosenGame(gameKey); setRecipientId(''); setCreateError(''); setPlayNow(true); intent.current = null; };
  const closeChooser = () => {
    setChoosing(false); setCreateError('');
    if (params.has('challenge')) setParams(current => { const next = new URLSearchParams(current); next.delete('challenge'); next.delete('recipient'); next.set('game', gameKey); return next; }, { replace: true });
  };

  async function createChallenge() {
    if (mutation.current || !selectedMember || !selectedGame) return;
    const account = viewerId;
    const fingerprint = `${selectedGame.game_key}:${selectedMember.user_id}`;
    if (intent.current?.fingerprint !== fingerprint) intent.current = { fingerprint, requestId: crypto.randomUUID() };
    mutation.current = true; setCreating(true); setCreateError('');
    try {
      const match = await lobby.create({ recipientId: selectedMember.user_id, gameKey: selectedGame.game_key, requestId: intent.current.requestId });
      if (!activeSession.current || scope.current !== account) return;
      intent.current = null; closeChooser();
      if (playNow) navigate(`/showdown/${match.challenge.id}`);
      else { setGameKey(selectedGame.game_key); setParams({ game: selectedGame.game_key, tab: 'play' }, { replace: true }); setNotice(`Challenge sent to ${selectedMember.display_name}. Your three ${selectedRegistration?.roundNoun ?? 'rounds'} are ready.`); }
    } catch (error) { if (activeSession.current && scope.current === account) setCreateError(error instanceof Error ? error.message : 'The challenge could not be sent. Try again.'); }
    finally { mutation.current = false; if (activeSession.current && scope.current === account) setCreating(false); }
  }
  async function decide() {
    if (!decision || mutation.current) return;
    mutation.current = true; setDeciding(true); setDecisionError('');
    try {
      await lobby.act(decision.challenge.id, decision.action);
      if (!activeSession.current) return;
      setNotice(decision.action === 'decline' ? 'Challenge declined. Your record is unchanged.' : 'Challenge cancelled. Your record is unchanged.');
      setDecision(null);
    } catch (error) { if (activeSession.current) setDecisionError(error instanceof Error ? error.message : 'This challenge could not be updated. Try again.'); }
    finally { mutation.current = false; if (activeSession.current) setDeciding(false); }
  }

  return <ShowdownFrame gameKey={gameKey} subtitle={clubName} action={<button type="button" className="sd-icon-button" aria-label="Refresh challenges" disabled={lobby.loading || lobby.refreshing || creating || deciding} onClick={() => void lobby.refresh()}><RefreshCw size={17} className={lobby.refreshing ? 'sd-loading' : ''} aria-hidden="true" /></button>}>
    {!data ? <ShowdownDataState error={lobby.error} retry={() => void lobby.refresh()} /> : <div className="sd-content" data-testid="showdown-lobby">
      <section className="sd-hero">
        <div className="sd-hero-copy"><p className="sd-eyebrow"><Swords size={12} aria-hidden="true" />{gameName} · SHOWDOWN</p><h1>{afterimage ? <>Hold the moment.<br />Make it yours.</> : <>Your move.<br />Their moment.</>}</h1><p>{afterimage ? 'Remember the scene. Restore the details.' : 'Same puzzles. Separate schedules.'}<br />Three rounds decide it.</p></div>
        <Mark className="sd-hero-art" />
      </section>
      <button type="button" className="sd-button sd-primary sd-full" onClick={openChooser} disabled={!members.length || !availableGames.length}><Plus size={17} aria-hidden="true" />Challenge a member</button>
      {!members.length && <p className="sd-lobby-note">Another club member is needed for a showdown.</p>}
      <div className="sd-record" aria-label={`${gameName} record`}><div><b>{data.record.wins}</b><span>Wins</span></div><div><b>{data.record.losses}</b><span>Losses</span></div><div><b>{data.record.draws}</b><span>Draws</span></div></div>
      {data.games.filter(game => game.enabled && getShowdownGame(game.game_key)?.enabled).length > 1 && <label className="sd-game-filter">Game<select aria-label="Showdown game" value={gameKey} onChange={event => { const nextGame = event.target.value; setGameKey(nextGame); setNotice(''); setParams(current => { const next = new URLSearchParams(current); next.set('game', nextGame); return next; }, { replace: true }); }}>{availableGames.map(game => <option value={game.game_key} key={game.game_key}>{game.name}</option>)}</select></label>}
      <nav className="sd-tabs" role="tablist" aria-label="Showdown views" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = SECTIONS.findIndex(tab => tab.id === section);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? SECTIONS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + SECTIONS.length) % SECTIONS.length;
        setParams({ tab: SECTIONS[next].id, game: gameKey }, { replace: true }); setNotice('');
        document.getElementById(`${formId}-${SECTIONS[next].id}`)?.focus();
      }}>{SECTIONS.map(tab => <button type="button" role="tab" id={`${formId}-${tab.id}`} aria-controls={`${formId}-panel`} tabIndex={section === tab.id ? 0 : -1} aria-selected={section === tab.id} key={tab.id} onClick={() => { setParams({ tab: tab.id, game: gameKey }, { replace: true }); setNotice(''); }}><tab.icon size={14} aria-hidden="true" />{tab.label}{Boolean(counts[tab.id]) && <b>{counts[tab.id]}</b>}</button>)}</nav>
      <div className="sd-scroll" role="tabpanel" id={`${formId}-panel`} aria-labelledby={`${formId}-${section}`} tabIndex={0}>
        {notice && <p className="sd-notice" role="status">{notice}</p>}
        {lobby.error && <div className="sd-error" role="alert"><p>{lobby.error} Your last loaded challenges are still shown.</p><button type="button" className="sd-button" onClick={() => void lobby.refresh()}>Retry refresh</button></div>}
        {section === 'standings' ? <>
          <div className="sd-section-title"><div><h2>{gameName} standings</h2><p>3 points per win · 1 per draw. Completed matches only.</p></div><Trophy size={22} aria-hidden="true" /></div>
          {data.standings.length ? <div className="sd-standings" aria-label="Game standings">{data.standings.map((player, index) => <article className="sd-standing" key={player.user_id}><span>{index + 1}</span><ShowdownAvatar name={player.display_name} url={player.avatar_url} /><div><strong>{player.display_name}{player.user_id === viewerId ? ' · you' : ''}</strong><small>{player.wins}W · {player.losses}L · {player.draws}D</small></div><b>{player.points}<small>points</small></b></article>)}</div> : <EmptyState section="standings" onChallenge={openChooser} disabled={!members.length} />}
          <div className="sd-section-title"><div><h2>Your rivalries</h2><p>Career head-to-head records for this game.</p></div><Users size={21} aria-hidden="true" /></div>
          {data.rivalries.length ? data.rivalries.map(rival => <article className="sd-rivalry" key={rival.opponent_id}><div><ShowdownAvatar name={rival.display_name} url={rival.avatar_url} /><div><strong>{rival.display_name}</strong><p>{rival.played} completed {rival.played === 1 ? 'match' : 'matches'}</p></div></div><b>{rival.wins}–{rival.losses}–{rival.draws}</b></article>) : <p className="sd-lobby-note">Your first completed match starts a rivalry.</p>}
          <p className="sd-lobby-note">Standings never compare raw scores from different mini-games. Rivalry records read wins–losses–draws from your perspective.</p>
        </> : <>
          <div className="sd-section-title"><div><h2>{section === 'inbox' ? 'The invitation is yours.' : section === 'play' ? 'Make your mark.' : section === 'waiting' ? 'Your rival’s turn.' : 'The match archive.'}</h2><p>{section === 'inbox' ? 'Open an invitation to play. No acceptance step.' : section === 'play' ? 'Jump in or pick up exactly where you left off.' : section === 'waiting' ? `Your ${roundNoun} are locked. We’ll notify you when the result is ready.` : 'Completed and closed challenges stay here.'}</p></div>{section === 'history' ? <History size={22} aria-hidden="true" /> : <Swords size={22} aria-hidden="true" />}</div>
          {visible.length ? <div className="sd-card-list">{visible.map(challenge => <ChallengeCard key={challenge.id} challenge={challenge} viewerId={viewerId} gameName={data.games.find(game => game.game_key === challenge.game_key)?.name ?? getShowdownGame(challenge.game_key)?.name ?? 'Showdown'} disabled={creating || deciding} decide={action => { setDecision({ challenge, action }); setDecisionError(''); }} />)}</div> : <EmptyState section={section} onChallenge={openChooser} disabled={!members.length} />}
          {section === 'history' && lobby.hasMore && <button type="button" className="sd-button sd-full" disabled={lobby.loadingMore} onClick={() => void lobby.loadMore()}>{lobby.loadingMore ? <Loader2 size={16} className="sd-loading" aria-hidden="true" /> : <History size={16} aria-hidden="true" />}{lobby.loadingMore ? 'Loading matches…' : 'Load older matches'}</button>}
        </>}
      </div>
    </div>}
    <Dialog open={choosing} onOpenChange={open => { if (!creating && !mutation.current) { if (open) setChoosing(true); else closeChooser(); } }}>
      <DialogContent className={`sd-dialog ${chosenGame === 'afterimage' ? 'sd-afterimage' : ''}`} onEscapeKeyDown={event => { if (creating) event.preventDefault(); }} onPointerDownOutside={event => { if (creating) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>New showdown</DialogTitle><DialogDescription>Choose a game and a club rival. They have 72 hours to finish the same three rounds.</DialogDescription></DialogHeader>
        <div aria-label="Choose a game">{availableGames.map(game => <button type="button" className="sd-game-choice" key={game.game_key} aria-pressed={chosenGame === game.game_key} disabled={creating} onClick={() => { setChosenGame(game.game_key); setCreateError(''); }}>{game.game_key === 'afterimage' ? <AfterimageMark /> : <PrismMark />}<span><strong>{game.name}</strong><small>{game.description}</small></span>{chosenGame === game.game_key && <Check size={17} aria-hidden="true" />}</button>)}</div>
        <label htmlFor={`${formId}-member`}>Club member<select id={`${formId}-member`} value={recipientId} disabled={creating} onChange={event => { setRecipientId(event.target.value); setCreateError(''); }}><option value="">Choose your rival</option>{members.map(member => <option value={member.user_id} key={member.user_id}>{member.display_name}</option>)}</select></label>
        {selectedMember && <MemberSummary member={selectedMember} />}
        <label className="sd-play-now"><input type="checkbox" checked={playNow} disabled={creating} onChange={event => setPlayNow(event.target.checked)} />Play my {selectedRegistration?.roundNoun ?? 'rounds'} now</label>
        <p>About 1–2 minutes. You can leave between rounds and return later. Your rival’s score stays hidden until you both finish.</p>
        {selectedRegistration?.rulesSummary && <details className="sd-scoring-details"><summary>{selectedRegistration.name} rules</summary><p>{selectedRegistration.rulesSummary}</p></details>}
        {createError && <p className="sd-error" role="alert">{createError}</p>}
        <div className="sd-dialog-actions"><button type="button" className="sd-button" disabled={creating} onClick={closeChooser}>Cancel</button><button type="button" className="sd-button sd-primary" disabled={creating || !selectedMember || !selectedGame} onClick={() => void createChallenge()}>{creating ? <Loader2 size={16} className="sd-loading" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}{creating ? 'Sending…' : 'Send challenge'}</button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(decision)} onOpenChange={open => { if (!open && !deciding) setDecision(null); }}>
      <DialogContent className={`sd-dialog ${gameKey === 'afterimage' ? 'sd-afterimage' : ''}`} onEscapeKeyDown={event => { if (deciding) event.preventDefault(); }} onPointerDownOutside={event => { if (deciding) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{decision?.action === 'decline' ? 'Decline challenge?' : 'Cancel challenge?'}</DialogTitle><DialogDescription>This ends the invitation without recording a win or loss. A challenge already started by the recipient cannot be withdrawn.</DialogDescription></DialogHeader>
        {decisionError && <p className="sd-error" role="alert">{decisionError}</p>}
        <div className="sd-dialog-actions"><button type="button" className="sd-button" disabled={deciding} onClick={() => setDecision(null)}>Keep challenge</button><button type="button" className="sd-button sd-danger" disabled={deciding} onClick={() => void decide()}>{deciding ? 'Updating…' : decision?.action === 'decline' ? 'Decline challenge' : 'Cancel challenge'}</button></div>
      </DialogContent>
    </Dialog>
  </ShowdownFrame>;
}

function MemberSummary({ member }: { member: ShowdownMember }) {
  return <div className="sd-choose-summary"><ShowdownAvatar name={member.display_name} url={member.avatar_url} /><div><strong>{member.display_name}</strong><span>Same club · same rounds · your own schedule</span></div></div>;
}
function ChallengeCard({ challenge, viewerId, gameName, disabled, decide }: { challenge: ShowdownChallenge; viewerId: string; gameName: string; disabled: boolean; decide: (action: 'decline' | 'cancel') => void }) {
  const me = challenge.players.find(player => player.user_id === viewerId);
  const opponent = challenge.players.find(player => player.user_id !== viewerId);
  const open = isOpen(challenge);
  const label = challengeLabel(challenge, viewerId);
  const waiting = Boolean(me?.finished_at) && open;
  const maximum = getShowdownGame(challenge.game_key, challenge.rules_version)?.matchMaxScore;
  const primary = challenge.status === 'completed' ? 'Open result' : !open ? 'View challenge' : waiting ? 'View progress' : me?.started_at ? challenge.game_key === 'afterimage' ? 'Continue scene' : 'Continue puzzle' : 'Play challenge';
  return <article className="sd-match-card" data-testid="showdown-challenge-card">
    <header><div className="sd-match-player"><ShowdownAvatar name={opponent?.display_name ?? 'Club rival'} url={opponent?.avatar_url} /><div><strong>{opponent?.display_name ?? 'Club rival'}</strong><small>{gameName}{challenge.rematch_of ? ' · Rematch' : ''}</small></div></div><span className="sd-badge" data-tone={challenge.status === 'completed' ? 'gold' : !open ? 'muted' : undefined}>{label}</span></header>
    <p>{open ? `${showdownTimeLeft(challenge.expires_at)} · ${waiting ? 'Your score is sealed until the result.' : me?.started_at && opponent?.started_at ? 'Both players have started.' : 'Play whenever you’re ready.'}` : `${showdownDate(challenge.completed_at ?? challenge.created_at)} · ${challenge.status === 'completed' ? `Your score: ${me?.total_score ?? 0}${maximum ? ` / ${maximum.toLocaleString()}` : ''}` : 'No win or loss recorded.'}`}</p>
    {open && <div className="sd-match-progress" aria-label={`${me?.rounds_completed ?? 0} of 3 rounds saved`}>{[1, 2, 3].map(round => <i key={round} data-complete={(me?.rounds_completed ?? 0) >= round} />)}<span>{me?.rounds_completed ?? 0}/3 saved</span></div>}
    <footer><Link className={`sd-button ${open && !waiting ? 'sd-primary' : ''}`} to={`/showdown/${challenge.id}`}>{primary}<ArrowRight size={14} aria-hidden="true" /></Link>{open && challenge.recipient_id === viewerId && !me?.started_at && <button type="button" className="sd-button sd-subtle" disabled={disabled} onClick={() => decide('decline')}>Decline</button>}{open && challenge.challenger_id === viewerId && !opponent?.started_at && <button type="button" className="sd-button sd-subtle" disabled={disabled} onClick={() => decide('cancel')}>Cancel invite</button>}</footer>
  </article>;
}
function EmptyState({ section, onChallenge, disabled }: { section: Section; onChallenge: () => void; disabled: boolean }) {
  const messages: Record<Section, [string, string]> = { inbox: ['No incoming challenges.', 'Your next rival can challenge you whenever they’re ready.'], play: ['A clean slate.', 'Challenge a club member and make the opening move.'], waiting: ['Nothing on hold.', 'Finish your three rounds and we’ll hold your score for the reveal.'], history: ['Your story starts here.', 'Completed, declined, cancelled and expired challenges will stay in your history.'], standings: ['The first rivalry is open.', 'Finish a showdown to establish the club standings.'] };
  return <div className="sd-empty"><Swords aria-hidden="true" /><h2>{messages[section][0]}</h2><p>{messages[section][1]}</p>{section !== 'inbox' && section !== 'waiting' && <button type="button" className="sd-button" disabled={disabled} onClick={onChallenge}>Start a showdown</button>}</div>;
}
