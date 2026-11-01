import { Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useShowdownMatch } from '@/hooks/useShowdown';
import { getShowdownGame } from '@/lib/showdown/registry';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showdownTimeLeft } from '@/components/showdown/showdownPresentation';
import { PrismMark, ShowdownAvatar, ShowdownDataState, ShowdownFrame } from '@/components/showdown/ShowdownChrome';

const CLOSED_COPY = {
  expired: { title: 'The light has faded.', detail: 'This challenge reached its 72-hour deadline. It does not count as a win or loss.' },
  declined: { title: 'Challenge declined.', detail: 'This invitation was declined. Both players’ records stay unchanged.' },
  cancelled: { title: 'Challenge closed.', detail: 'This challenge was cancelled or a player is no longer eligible. No win or loss was recorded.' },
} as const;

export default function ShowdownMatchPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  if (authLoading || clubLoading) return <ShowdownFrame backTo="/showdown"><ShowdownDataState title="Opening your boards" /></ShowdownFrame>;
  if (!user || !club || !challengeId) return <ShowdownFrame backTo="/showdown"><ShowdownDataState error="Open this challenge from your club’s Showdown board." /></ShowdownFrame>;
  return <MatchSession key={`${user.id}:${club.id}:${challengeId}`} challengeId={challengeId} viewerId={user.id} />;
}

function MatchSession({ challengeId, viewerId }: { challengeId: string; viewerId: string }) {
  const navigate = useNavigate();
  const match = useShowdownMatch(challengeId);
  const [rematchError, setRematchError] = useState('');
  const [rematching, setRematching] = useState(false);
  const [closing, setClosing] = useState<'decline' | 'cancel' | null>(null);
  const [closeError, setCloseError] = useState('');
  const active = useRef(true);
  const actionInFlight = useRef(false);
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const data = match.data;
  const challenge = data?.challenge;
  const game = challenge ? getShowdownGame(challenge.game_key, challenge.rules_version) : null;
  const me = challenge?.players.find(player => player.user_id === viewerId);
  const opponent = challenge?.players.find(player => player.user_id !== viewerId);
  const current = data?.rounds.find(round => round.round_number === data.current_round);

  async function rematch() {
    if (actionInFlight.current) return;
    actionInFlight.current = true; setRematching(true); setRematchError('');
    try {
      const next = await match.rematch();
      if (active.current) navigate(`/showdown/${next.challenge.id}`);
    } catch (error) { if (active.current) setRematchError(error instanceof Error ? error.message : 'The rematch could not be created. Try again.'); }
    finally { actionInFlight.current = false; if (active.current) setRematching(false); }
  }
  async function closeChallenge() {
    if (!closing || actionInFlight.current) return;
    actionInFlight.current = true; setCloseError('');
    try { await match.act(closing); if (active.current) setClosing(null); }
    catch (error) { if (active.current) setCloseError(error instanceof Error ? error.message : 'This challenge could not be updated.'); }
    finally { actionInFlight.current = false; }
  }

  if (!data) return <ShowdownFrame backTo="/showdown"><ShowdownDataState error={match.error} retry={() => void match.refresh()} title={match.error ? 'Challenge unavailable' : 'Opening your boards'} /></ShowdownFrame>;
  if (!game) return <ShowdownFrame backTo="/showdown"><div className="sd-data-state"><ShieldCheck aria-hidden="true" /><h1>Game update needed.</h1><p>This challenge uses a game version that cannot be opened on this device. Your saved attempt is safe.</p><Link className="sd-button" to="/showdown">Return to Showdown</Link></div></ShowdownFrame>;

  if (data.can_play && current?.puzzle && !current.me.submitted && opponent) {
    const Gameplay = game.Gameplay;
    const bankedScore = data.rounds.reduce((sum, round) => sum + (round.me.submitted ? round.me.score ?? 0 : 0), 0);
    return <Suspense fallback={<ShowdownFrame backTo="/showdown"><ShowdownDataState title="Preparing the light" /></ShowdownFrame>}>
      <Gameplay key={`${challengeId}:${current.round_number}`} attemptKey={`${challengeId}:${viewerId}`} puzzle={current.puzzle} roundNumber={current.round_number as 1 | 2 | 3} opponent={{ displayName: opponent.display_name, avatarUrl: opponent.avatar_url }} actions={match.actions} onActionsChange={match.onActionsChange} onSubmit={match.submit} saveState={match.saveState} error={match.saveError ?? match.error} onRetrySave={() => void match.retrySave()} disabled={match.submitting || match.busy} bankedScore={bankedScore} onLeave={() => { void match.checkpoint().catch(() => {}); navigate('/showdown'); }} />
    </Suspense>;
  }

  const closed = challenge && challenge.status in CLOSED_COPY ? CLOSED_COPY[challenge.status as keyof typeof CLOSED_COPY] : null;
  const Results = game.Results;
  return <ShowdownFrame backTo="/showdown" subtitle={game.name} action={<button type="button" className="sd-icon-button" aria-label="Refresh match" disabled={match.loading || match.busy} onClick={() => void match.refresh()}><RefreshCw size={17} aria-hidden="true" /></button>}>
    <div className="sd-content"><div className="sd-scroll">
      {match.error && <p className="sd-error" role="alert">{match.error} Your last saved match is still shown.</p>}
      {challenge?.status === 'completed' ? <Suspense fallback={<ShowdownDataState title="Revealing the result" />}><Results detail={data} viewerId={viewerId} rivalry={data.rivalry} onRematch={() => void rematch()} busy={rematching || match.busy} error={rematchError} /></Suspense> : <div className="sd-waiting" data-testid="showdown-waiting">
        <PrismMark />
        <p className="sd-eyebrow">{closed ? challenge?.status : 'ATTEMPT SEALED'}</p>
        <h1>{closed?.title ?? (me?.finished_at ? 'Your light is locked in.' : 'Your next board is safe.')}</h1>
        <p>{closed?.detail ?? (me?.finished_at ? `You’ve finished all three boards. ${opponent?.display_name ?? 'Your rival'} can finish on their own schedule. Their scores and solutions stay hidden until the reveal.` : 'Refresh this match to pick up your next board. Completed rounds cannot be replayed for a better score.')}</p>
        {!closed && me?.finished_at && <div className="sd-progress-summary"><CheckCircle2 size={21} aria-hidden="true" /><strong>{me.total_score ?? 0} / 1,500</strong><p>Your validated score · {me.solved_count ?? 0}/3 solved · {me.rotations ?? 0} rotations</p></div>}
        {!closed && opponent && <div className="sd-opponent-wait"><ShowdownAvatar name={opponent.display_name} url={opponent.avatar_url} /><div><strong>{opponent.display_name}</strong><p>{opponent.finished_at ? 'Attempt saved' : `${opponent.rounds_completed}/3 rounds saved`} · {showdownTimeLeft(challenge!.expires_at)}</p></div><Clock3 size={17} aria-hidden="true" /></div>}
        {rematchError && <p className="sd-error" role="alert">{rematchError}</p>}
        <div className="sd-waiting-actions">
          <Link className="sd-button" to="/showdown"><ArrowLeft size={16} aria-hidden="true" />Showdown board</Link>
          {!closed && !me?.finished_at && <button type="button" className="sd-button sd-primary" disabled={match.loading || match.busy} onClick={() => void match.refresh()}>Resume saved boards</button>}
          {closed && <Link className="sd-button sd-primary" to={`/showdown?${new URLSearchParams({ challenge: 'new', recipient: opponent?.user_id ?? '', game: challenge?.game_key ?? 'prism_break' })}`}>New challenge</Link>}
          {data.can_decline && <button type="button" className="sd-button sd-subtle" disabled={match.busy} onClick={() => { setClosing('decline'); setCloseError(''); }}>Decline challenge</button>}
          {data.can_cancel && <button type="button" className="sd-button sd-subtle" disabled={match.busy} onClick={() => { setClosing('cancel'); setCloseError(''); }}>Cancel invite</button>}
        </div>
        {!closed && <p className="sd-lobby-note">We’ll notify you when the result is ready. You can leave this screen.</p>}
      </div>}
    </div></div>
    <Dialog open={closing !== null} onOpenChange={open => { if (!open && !actionInFlight.current) setClosing(null); }}>
      <DialogContent className="sd-dialog"><DialogHeader><DialogTitle>{closing === 'decline' ? 'Decline challenge?' : 'Cancel invitation?'}</DialogTitle><DialogDescription>This closes the challenge without changing either player’s win/loss record.</DialogDescription></DialogHeader>{closeError && <p className="sd-error" role="alert">{closeError}</p>}<div className="sd-dialog-actions"><button type="button" className="sd-button" disabled={match.busy} onClick={() => setClosing(null)}>Keep challenge</button><button type="button" className="sd-button sd-danger" disabled={match.busy} onClick={() => void closeChallenge()}>{match.busy ? 'Updating…' : 'Close challenge'}</button></div></DialogContent>
    </Dialog>
  </ShowdownFrame>;
}
