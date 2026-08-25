import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Crown, Link2, Play, LogOut, X, Settings2, Clock, Loader2,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useReadshiftGame } from '@/hooks/useReadshift';
import { useReadshiftRound } from '@/hooks/useReadshiftRound';
import { ShiftPhase } from '@/components/readshift/ShiftPhase';
import { ReadPhase } from '@/components/readshift/ReadPhase';
import { RevealPhase } from '@/components/readshift/RevealPhase';
import { FinalResults } from '@/components/readshift/FinalResults';
import { CommissionerControls } from '@/components/readshift/CommissionerControls';
import { RoundHistory } from '@/components/readshift/RoundHistory';
import { StatusPill } from '@/components/ui/status-pill';
import { cn } from '@/lib/utils';
import * as api from '@/lib/readshift/api';
import { MIN_PLAYERS, HARD_MAX_PLAYERS } from '@/lib/readshift/constants';

function initials(name?: string | null) {
  return (name || '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export default function ReadshiftGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { club, isClubAdmin, isAppAdmin } = useClub();
  const { game, participants, loading, error, refresh } = useReadshiftGame(gameId);
  const rs = useReadshiftRound(game);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refreshAll = () => { void rs.refresh(); void refresh(); };

  const activeParts = participants.filter((p) => p.active);
  const isHost = !!game && game.created_by === user?.id;
  const canManage = isHost || isClubAdmin || isAppAdmin;
  const isParticipant = activeParts.some((p) => p.user_id === user?.id);
  const canStart = isHost && game?.phase === 'lobby' && activeParts.length >= MIN_PLAYERS;

  const run = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.success(okMsg); await refresh(); }
    catch (e: any) { toast.error(e?.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Invite link copied'); }
    catch { toast.error('Could not copy link'); }
  };

  if (loading) {
    return (
      <div>
        <div className="glass-card p-6"><div className="h-5 w-1/2 rounded skeleton-shimmer mb-3" /><div className="h-3 w-2/3 rounded skeleton-shimmer" /></div>
        {error && (
          <button onClick={() => void refresh()} className="mt-4 mx-auto block text-[12px] font-bold text-primary">Retry</button>
        )}
      </div>
    );
  }
  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground mb-3">Game not found or you don't have access.</p>
        <Link to="/readshift" className="text-[13px] font-bold text-primary">Back to READSHIFT</Link>
      </div>
    );
  }

  const isLobby = game.phase === 'lobby';
  const deadline = game.phase_deadline ? new Date(game.phase_deadline) : null;

  const roundFallback = (
    <div className="glass-card p-5 text-center space-y-3">
      {rs.loading ? (
        <div className="h-4 w-2/3 rounded skeleton-shimmer mx-auto" />
      ) : (
        <>
          <p className="text-sm font-bold">Round data did not load.</p>
          <p className="text-[12px] text-muted-foreground/70 leading-snug">
            {rs.error || 'This game may be waiting on the backend to create or advance the round.'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => void rs.refresh()} className="flex-1 h-10 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-[12px] font-bold btn-press">
              Retry
            </button>
            {canManage && (
              <button onClick={() => run(() => api.triggerPhase(game.id, 'advance'), 'Checked phase')} disabled={busy} className="flex-1 h-10 rounded-lg bg-primary/15 text-primary hover:bg-primary/20 transition-colors text-[12px] font-bold btn-press disabled:opacity-50">
                Check phase
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <Link to="/readshift" className="rs-back" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[18px] font-black tracking-tight leading-none truncate">{game.name}</h1>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {isLobby ? `Lobby · ${game.total_rounds} rounds` : `Round ${game.current_round} of ${game.total_rounds}`}
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Player list */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
            <h2 className="font-bold text-[13px]">Players</h2>
            <span className="ml-auto text-[11px] font-bold tabular-nums text-muted-foreground/70">
              {activeParts.length}{isLobby ? ` / ${HARD_MAX_PLAYERS}` : ''}
            </span>
          </div>
          <div className="divide-y divide-border/10">
            {activeParts.map((p) => {
              const host = p.user_id === game.created_by;
              const me = p.user_id === user?.id;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                    style={{ background: 'hsl(var(--primary) / 0.16)', color: 'hsl(var(--primary))' }}>
                    {initials(p.profiles?.display_name)}
                  </div>
                  <span className="text-[13px] font-semibold truncate flex-1">
                    {p.profiles?.display_name || 'Player'}{me && <span className="text-muted-foreground/60 font-normal"> (you)</span>}
                  </span>
                  {host && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--gold) / 0.14)', color: 'hsl(var(--gold))' }}><Crown className="w-2.5 h-2.5" /> Host</span>}
                  {isLobby && canManage && !host && (
                    <button onClick={() => run(() => api.removeParticipant(game.id, p.user_id), 'Removed')} disabled={busy}
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive transition-colors" aria-label="Remove player">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {isLobby ? (
          <>
            {/* Min-player requirement + invite */}
            <div className="glass-card p-4 space-y-3">
              <p className="text-[12px] text-muted-foreground/85 leading-snug">
                {activeParts.length < MIN_PLAYERS
                  ? `Need at least ${MIN_PLAYERS} players to start — ${MIN_PLAYERS - activeParts.length} more to go.`
                  : 'Ready when you are. New players can still join until the game starts.'}
              </p>
              <button onClick={copyInvite} className="w-full h-10 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-[13px] font-bold flex items-center justify-center gap-2 btn-press">
                <Link2 className="w-4 h-4" /> Copy invite link
              </button>
            </div>

            {/* Primary actions */}
            <div className="space-y-2">
              {!isParticipant && user && (
                <button onClick={() => run(() => api.joinGame(game.id, club!.id, user.id), 'Joined!')} disabled={busy || activeParts.length >= HARD_MAX_PLAYERS}
                  className="rs-cta w-full h-12 rounded-xl btn-press">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  {activeParts.length >= HARD_MAX_PLAYERS ? 'Game full' : 'Join Game'}
                </button>
              )}
              {isHost && (
                <button onClick={() => run(() => api.triggerPhase(game.id, 'start'), 'Game started!')} disabled={busy || !canStart}
                  className="rs-cta w-full h-12 rounded-xl btn-press">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {canStart ? 'Start Game' : `Waiting for ${Math.max(0, MIN_PLAYERS - activeParts.length)} more`}
                </button>
              )}
              {isParticipant && !isHost && (
                <button onClick={() => run(async () => { await api.leaveGame(game.id, user!.id); }, 'Left the game')} disabled={busy}
                  className="w-full h-10 rounded-lg text-[13px] font-bold text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Leave Game
                </button>
              )}
              {canManage && (
                <button onClick={() => run(() => api.triggerPhase(game.id, 'cancel'), 'Game cancelled')} disabled={busy}
                  className="w-full h-10 rounded-lg text-[12px] font-semibold text-muted-foreground/70 hover:text-destructive transition-colors">
                  Cancel game
                </button>
              )}
              {canManage && (
                confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.deleteGame(game.id);
                          toast.success('Game deleted');
                          navigate('/readshift');
                        } catch (e: any) {
                          toast.error(e?.message || 'Could not delete game');
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                      className="flex-1 h-10 rounded-lg text-[12px] font-bold bg-destructive/10 text-destructive hover:bg-destructive/15 transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Confirm delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                      className="flex-1 h-10 rounded-lg text-[12px] font-bold bg-muted/50 hover:bg-muted transition-colors btn-press"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                    className="w-full h-10 rounded-lg text-[12px] font-semibold text-muted-foreground/60 hover:text-destructive transition-colors"
                  >
                    Delete game permanently
                  </button>
                )
              )}
            </div>
          </>
        ) : game.phase === 'shift' && user && club ? (
          rs.round ? (
            <ShiftPhase game={game} round={rs.round} assignment={rs.assignment} myAnswer={rs.myAnswer}
              participants={activeParts} progress={rs.progress} userId={user.id} clubId={club.id} onSaved={refreshAll} />
          ) : roundFallback
        ) : game.phase === 'read' && user && club ? (
          rs.round ? (
            <ReadPhase game={game} round={rs.round} readCards={rs.readCards} authorPool={rs.authorPool}
              myGuesses={rs.myGuesses} myAnswer={rs.myAnswer} participants={activeParts} progress={rs.progress}
              userId={user.id} clubId={club.id} onSaved={refreshAll} />
          ) : roundFallback
        ) : game.phase === 'reveal' && user && club ? (
          rs.round ? (
            <>
              <div className="glass-card px-4 py-2.5 flex items-center justify-center gap-2">
                <StatusPill variant="success" size="sm">Reveal · Round {game.current_round}</StatusPill>
                {deadline && (
                  <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {deadline.getTime() > Date.now() ? `${formatDistanceToNowStrict(deadline)} until next round` : 'Advancing…'}
                  </span>
                )}
              </div>
              <RevealPhase game={game} round={rs.round} result={rs.result} awards={rs.awards}
                comments={rs.comments} participants={activeParts} userId={user.id} clubId={club.id} onChanged={refreshAll} />
            </>
          ) : roundFallback
        ) : game.phase === 'completed' ? (
          <FinalResults game={game} participants={activeParts} />
        ) : (
          /* Paused / cancelled */
          <div className="glass-card p-5 text-center">
            <StatusPill variant={game.phase === 'cancelled' ? 'danger' : 'neutral'} size="sm">
              {game.phase === 'paused' ? 'Paused' : 'Cancelled'}
            </StatusPill>
            <p className="text-[11px] text-muted-foreground/60 mt-4 leading-snug">
              {game.phase === 'paused' ? 'The host paused this game. It resumes when they pick it back up.' : 'This game was cancelled.'}
            </p>
          </div>
        )}

        {/* Round history (all completed rounds so far) */}
        {!isLobby && game.phase !== 'cancelled' && (
          <RoundHistory
            game={game}
            participants={activeParts}
            excludeRoundId={game.phase === 'reveal' ? rs.round?.id ?? null : null}
            refreshKey={`${game.phase}:${game.current_round}`}
          />
        )}

        {/* Commissioner controls (in-flight games only) */}
        {canManage && ['shift', 'read', 'reveal', 'paused'].includes(game.phase) && (
          <CommissionerControls game={game} onChanged={refreshAll} />
        )}

        {/* Settings summary */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground/60" />
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/60">Settings</h3>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <span className="text-muted-foreground/70">Rounds</span><span className="font-semibold text-right">{game.total_rounds}</span>
            <span className="text-muted-foreground/70">Shift window</span><span className="font-semibold text-right">{game.shift_hours}h</span>
            <span className="text-muted-foreground/70">Read window</span><span className="font-semibold text-right">{game.read_hours}h</span>
            <span className="text-muted-foreground/70">Prompt mode</span><span className="font-semibold text-right capitalize">{game.prompt_mode}</span>
            <span className="text-muted-foreground/70">Early advance</span><span className="font-semibold text-right">{game.early_advance ? 'On' : 'Off'}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
