import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Gem, LoaderCircle, RotateCcw, RotateCw, SkipForward, WifiOff } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { replayActions } from '@/lib/showdown/prism/engine';
import { PRISM_MAX_ACTIONS, type PrismAction, type PrismPuzzle } from '@/lib/showdown/prism/types';
import { PrismBoard } from './PrismBoard';
import './prismBreak.css';

export interface PrismBreakGameProps {
  attemptKey: string;
  puzzle: PrismPuzzle;
  roundNumber: 1 | 2 | 3;
  opponent: { displayName: string; avatarUrl?: string | null };
  actions: PrismAction[];
  onActionsChange: (actions: PrismAction[]) => void;
  onSubmit: (actions: PrismAction[], outcome: 'solved' | 'skipped') => Promise<void>;
  saveState?: 'saved' | 'saving' | 'offline';
  error?: string | null;
  onRetrySave?: () => void;
  disabled?: boolean;
  onLeave?: () => void;
  /** A sum of already validated own-round receipts, never a client estimate. */
  bankedScore?: number;
}

export function PrismBreakGame(props: PrismBreakGameProps) {
  return <PrismRoundSession key={`${props.attemptKey}:${props.roundNumber}:${props.puzzle.id}:${props.puzzle.version}`} {...props} />;
}

function PrismRoundSession({ puzzle, roundNumber, opponent, actions, onActionsChange, onSubmit, saveState = 'saved', error, onRetrySave, disabled = false, onLeave, bankedScore }: PrismBreakGameProps) {
  const reducedMotion = useReducedMotion();
  const replay = useMemo(() => { try { return { value: replayActions(puzzle, actions), error: null }; } catch { return { value: null, error: 'These saved moves could not be verified. Refresh the match to recover its saved round.' }; } }, [puzzle, actions]);
  const mirrors = useMemo(() => puzzle.tiles.flatMap((tile, cell) => tile.kind === 'mirror' && tile.rotatable ? [cell] : []), [puzzle]);
  const [selectedCell, setSelectedCell] = useState(mirrors[0] ?? -1);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [submissionError, setSubmissionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const active = useRef(true);
  const sending = useRef(false);
  const intent = useRef<{ actions: PrismAction[]; outcome: 'solved' | 'skipped' } | null>(null);
  const latest = useRef({ actions, onSubmit });
  latest.current = { actions, onSubmit };
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const submit = useCallback(async (outcome: 'solved' | 'skipped', retry = false) => {
    if (sending.current || (intent.current && !retry)) return;
    if (!intent.current) intent.current = { actions: latest.current.actions.map(action => ({ ...action })), outcome };
    sending.current = true;
    setPhase('sending'); setSubmissionError(''); setSkipConfirm(false);
    try {
      await latest.current.onSubmit(intent.current.actions, intent.current.outcome);
      if (active.current) setPhase('sent');
    } catch (failure) {
      if (active.current) { setPhase('error'); setSubmissionError(failure instanceof Error ? failure.message : 'The result could not be saved. Your round is kept for retry.'); }
    } finally { sending.current = false; }
  }, []);

  useEffect(() => {
    if (!replay.value?.solved || disabled || phase !== 'idle') return;
    const timeout = window.setTimeout(() => void submit('solved'), reducedMotion ? 120 : 450);
    return () => window.clearTimeout(timeout);
  }, [replay.value?.solved, disabled, phase, reducedMotion, submit]);
  useEffect(() => { if (!feedback) return; const timeout = window.setTimeout(() => setFeedback(''), 1800); return () => window.clearTimeout(timeout); }, [feedback]);

  const locked = disabled || phase !== 'idle' || !!replay.value?.solved || !!replay.error;
  const actionLimit = actions.length >= PRISM_MAX_ACTIONS;
  const append = (action: PrismAction) => {
    if (locked || actionLimit || skipConfirm) return;
    onActionsChange([...actions, action]);
    if (action.type === 'reset') setFeedback('Board reset. Every rotation still counts.');
  };
  const selectMirror = (step: number) => {
    if (locked || !mirrors.length) return;
    const current = Math.max(0, mirrors.indexOf(selectedCell));
    setSelectedCell(mirrors[(current + step + mirrors.length) % mirrors.length]);
  };
  const selectedNumber = mirrors.indexOf(selectedCell) + 1;
  const solved = replay.value?.solved ?? false;
  const guidance = puzzle.tiles.some(tile => tile.kind === 'splitter') ? 'Prisms split light. Match every receiver.' : puzzle.tiles.some(tile => tile.kind === 'filter') ? 'Filters recolor beams. Light every receiver.' : 'Tap mirrors. Light every matching receiver.';
  const name = opponent.displayName || 'Your opponent';
  const status = phase === 'sending' ? 'Verifying round…' : phase === 'sent' ? 'Round saved. Opening the next board…' : phase === 'error' ? 'Result needs a retry' : saveState === 'saving' ? 'Saving moves…' : saveState === 'offline' ? 'Moves kept on this device' : 'Moves saved';
  return <section className="pb-game" data-testid="prism-game" data-prism-round={roundNumber} data-prism-phase={phase} aria-label={`Prism Break, round ${roundNumber} of 3`}>
    <header className="pb-game-header">
      <button className="pb-icon-button" type="button" aria-label="Leave puzzle and return to Showdown" onClick={onLeave ?? (() => { window.location.assign('/showdown'); })}><ChevronLeft size={20} aria-hidden="true" /></button>
      <div className="pb-game-brand"><Gem size={21} aria-hidden="true" /><div><span>DH SHOWDOWN</span><h1>Prism Break</h1></div></div>
      <div className="pb-opponent">{opponent.avatarUrl ? <img src={opponent.avatarUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} /> : <span className="pb-opponent-mark" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>}<span><small>vs</small><strong>{name}</strong></span></div>
    </header>

    <div className="pb-play-progress">
      <div className="pb-round-progress" aria-label={`Round ${roundNumber} of 3`}><span>ROUND {roundNumber}<small> / 3</small></span><div aria-hidden="true">{[1, 2, 3].map(round => <i key={round} className={round < roundNumber ? 'is-done' : round === roundNumber ? 'is-current' : ''} />)}</div></div>
      <div className="pb-play-counters"><span className={solved ? 'is-lit' : ''}><Gem size={15} aria-hidden="true" /><b>{replay.value?.trace.activatedReceivers.length ?? 0}/{replay.value?.trace.requiredReceivers.length ?? 0}</b><small>lit</small></span><span><RotateCw size={15} aria-hidden="true" /><b data-testid="prism-rotations">{replay.value?.rotations ?? 0}</b><small>turns</small></span>{typeof bankedScore === 'number' && <span className="pb-banked-score"><b key={bankedScore}>{bankedScore}</b><small>banked</small></span>}</div>
    </div>

    <div className="pb-play-board-space">
      {replay.value ? <PrismBoard puzzle={puzzle} actions={actions} selectedCell={selectedCell} onSelectCell={setSelectedCell} disabled={locked || actionLimit || skipConfirm} onRotate={cell => append({ type: 'rotate', cell })} fit /> : <div className="pb-data-error"><Gem size={32} aria-hidden="true" /><h2>Recovering this round</h2><p>{replay.error}</p>{onRetrySave && <button className="pb-secondary-button" type="button" onClick={onRetrySave}>Refresh saved round</button>}</div>}
      {solved && <div className="pb-solved-message" role="status"><span><Check size={24} aria-hidden="true" /></span><strong>Prism aligned</strong><small>{phase === 'error' ? 'Your solution is kept.' : 'Every receiver is lit.'}</small></div>}
    </div>

    <footer className="pb-play-footer">
      <div className="pb-play-guidance"><p>{feedback || (actionLimit ? 'Move limit reached. Skip to keep the match moving.' : guidance)}</p><span aria-live="polite" className={saveState === 'offline' || phase === 'error' ? 'is-offline' : ''}>{phase === 'sending' ? <LoaderCircle size={11} className="pb-spin" aria-hidden="true" /> : saveState === 'offline' ? <WifiOff size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}{status}</span></div>
      {submissionError ? <div className="pb-submission-retry" role="alert"><p>{submissionError}</p><button className="pb-primary-button" type="button" disabled={sending.current} onClick={() => void submit(intent.current?.outcome ?? 'solved', true)}>Retry round submission</button></div>
        : error ? <div className="pb-save-error" role="status"><p>{error}</p>{onRetrySave && <button type="button" className="pb-secondary-button" disabled={phase !== 'idle'} onClick={onRetrySave}>Retry saving moves</button>}</div> : null}
      {skipConfirm ? <div className="pb-skip-confirm" role="group" aria-label="Confirm puzzle skip"><p>Skip this puzzle for <strong>0 points</strong>?</p><div><button className="pb-secondary-button" type="button" onClick={() => setSkipConfirm(false)}>Keep playing</button><button className="pb-primary-button" type="button" onClick={() => void submit('skipped')}>Skip for 0 points</button></div></div> : <>
        <div className="pb-mirror-controls" aria-label="Selected mirror controls">
          <button type="button" className="pb-icon-button" aria-label="Select previous mirror" disabled={locked || !mirrors.length} onClick={() => selectMirror(-1)}><ArrowLeft size={17} aria-hidden="true" /></button>
          <button type="button" className="pb-selected-mirror" disabled={locked || actionLimit || !mirrors.length} onClick={() => append({ type: 'rotate', cell: selectedCell })}><RotateCw size={17} aria-hidden="true" /><span>Rotate mirror {selectedNumber || '—'}<small>Row {Math.floor(selectedCell / puzzle.width) + 1} · Col {selectedCell % puzzle.width + 1}</small></span></button>
          <button type="button" className="pb-icon-button" aria-label="Select next mirror" disabled={locked || !mirrors.length} onClick={() => selectMirror(1)}><ArrowRight size={17} aria-hidden="true" /></button>
        </div>
        <div className="pb-round-actions"><button type="button" className="pb-secondary-button" aria-label="Reset board" title="Restore the original mirrors. All rotations still count." disabled={locked || actionLimit} onClick={() => append({ type: 'reset' })}><RotateCcw size={16} aria-hidden="true" />Reset</button><button type="button" className="pb-secondary-button" aria-label="Skip puzzle" disabled={locked} onClick={() => setSkipConfirm(true)}><SkipForward size={16} aria-hidden="true" />Skip <small>0 pts</small></button></div>
      </>}
    </footer>
  </section>;
}
