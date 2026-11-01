import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Delete, Flag, LoaderCircle, LockKeyhole, RotateCcw, Send, ShieldCheck, WifiOff } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CIPHER_COLOR_IDS, CIPHER_MAX_GUESSES, type CipherCode, type CipherColorId, type CipherGuess, type CipherView } from '@/lib/showdown/cipher/types';
import { CipherPeg } from './CipherPeg';
import { CipherCodeMaker } from './CipherCodeMaker';
import { CipherHelp } from './CipherHelp';
import './cipherGame.css';

export interface CipherGameProps {
  attemptKey: string;
  view: CipherView;
  opponent: { displayName: string; avatarUrl?: string | null };
  draft: (CipherColorId | null)[];
  onDraftChange: (draft: (CipherColorId | null)[]) => void;
  onLockCode: (code: CipherCode) => Promise<void>;
  onSubmitGuess: () => Promise<void>;
  onSurrender: () => Promise<void>;
  onDecline?: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onLeave: () => void;
  saveState?: 'saved' | 'saving' | 'offline';
  error?: string | null;
  disabled?: boolean;
  onRetry?: () => Promise<void> | void;
  tutorialPreferenceKey?: string;
  pendingCode?: CipherCode | null;
}
export interface CipherGuessHistoryProps { guesses: CipherGuess[]; activeSequence?: number; readOnly?: boolean }

function OfficialClues({ exact, colorOnly }: { exact: number; colorOnly: number }) {
  return <div className="cipher-official-clues" role="img" aria-label={`${exact} exact ${exact === 1 ? 'match' : 'matches'}, ${colorOnly} ${colorOnly === 1 ? 'color match' : 'color matches'} in different positions`}><div>{Array.from({ length: 4 }, (_, index) => <i key={index} className={`cipher-clue${index < exact ? ' is-exact' : index < exact + colorOnly ? ' is-color' : ''}`} />)}</div></div>;
}

/** Locked receipts only: the client never derives feedback from a secret. */
export function CipherGuessHistory({ guesses, activeSequence, readOnly = false }: CipherGuessHistoryProps) {
  return <div className={`cipher-history-board${readOnly ? ' is-readonly' : ''}`} data-testid="cipher-history"><div className="cipher-history-labels" aria-hidden="true"><span>{readOnly ? 'FINAL COMBINATIONS' : 'YOUR COMBINATIONS'}</span><span>CLUES</span></div>{Array.from({ length: CIPHER_MAX_GUESSES }, (_, index) => {
    const guess = guesses.find(entry => entry.sequence === index + 1);
    return <div key={index} className={`cipher-history-row${guess ? ' is-sealed' : ''}${guess?.exact === 4 ? ' is-solved' : ''}${!guess && activeSequence === index + 1 ? ' is-next' : ''}`} data-cipher-guess-row={index + 1} data-cipher-active={!guess && activeSequence === index + 1 ? 'true' : undefined} aria-label={`Guess ${index + 1}${guess ? ', submitted' : ', not submitted'}`}>
      <span className="cipher-guess-number">{String(index + 1).padStart(2, '0')}</span><div className="cipher-history-pegs">{Array.from({ length: 4 }, (_, cell) => <span className="cipher-history-socket" key={cell} role={guess ? 'img' : undefined} aria-label={guess ? `Position ${cell + 1}: ${guess.colors[cell]}` : undefined}><CipherPeg color={guess?.colors[cell]} decorative /></span>)}</div>{guess ? <OfficialClues exact={guess.exact} colorOnly={guess.color_only} /> : <div className="cipher-official-clues is-empty" aria-hidden="true"><div>{[0, 1, 2, 3].map(cell => <i className="cipher-clue" key={cell} />)}</div></div>}
    </div>;
  })}</div>;
}

export function CipherGame(props: CipherGameProps) {
  return <CipherAttemptGame key={props.attemptKey} {...props} />;
}

function CipherAttemptGame({ view, opponent, draft, onDraftChange, onLockCode, onSubmitGuess, onSurrender, onDecline, onCancel, onLeave, saveState = 'saved', error, disabled = false, onRetry, tutorialPreferenceKey, pendingCode }: CipherGameProps) {
  const [selected, setSelected] = useState(() => Math.max(0, draft.findIndex(value => value == null)));
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [localError, setLocalError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'surrender' | 'cancel' | null>(null);
  const [ending, setEnding] = useState(false);
  const [endIntent, setEndIntent] = useState<'surrender' | 'cancel' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const active = useRef(true), submitting = useRef(false), endInFlight = useRef(false);
  const history = useRef<HTMLDivElement>(null);
  const count = view.own_guesses.length;
  const latestCount = useRef(count);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (count > latestCount.current) {
      setSubmitState('idle'); setLocalError(''); setSelected(0);
      const receipt = view.own_guesses[count - 1];
      setAnnouncement(receipt.exact === 4 ? `Code cracked in ${count} ${count === 1 ? 'guess' : 'guesses'}.` : `Guess ${count} saved. ${receipt.exact} exact matches and ${receipt.color_only} color matches in different positions.`);
    }
    latestCount.current = count;
    const host = history.current;
    const row = host?.querySelector<HTMLElement>(`[data-cipher-guess-row="${Math.min(10, Math.max(1, count + 1))}"]`);
    if (host && row) host.scrollTop = Math.max(0, row.offsetTop - host.offsetTop - host.clientHeight + row.offsetHeight + 10);
  }, [count, view.own_guesses]);

  if (view.phase === 'create_code') return <CipherCodeMaker opponent={opponent} onLock={onLockCode} onLeave={onLeave} busy={disabled} error={error} initialCode={draft} onDraftChange={onDraftChange} step="accept" onDecline={onDecline} tutorialPreferenceKey={tutorialPreferenceKey} pendingCode={pendingCode} />;
  const codebreaking = view.phase === 'codebreaking' && view.own_attempt.status === 'playing';
  const sealed = ['attempt_sealed', 'completed', 'closed'].includes(view.phase);
  const slots = Array.from({ length: 4 }, (_, index) => draft[index] ?? null);
  const complete = slots.every(color => color !== null && CIPHER_COLOR_IDS.includes(color));
  const frozen = disabled || !codebreaking || submitState !== 'idle' || ending || !!endIntent;
  const opponentName = opponent.displayName || 'Your rival';
  const attemptsLeft = CIPHER_MAX_GUESSES - count;
  function choose(color: CipherColorId) {
    if (frozen) return;
    const next = [...slots]; next[selected] = color; onDraftChange(next);
    const after = next.findIndex((value, index) => value === null && index > selected);
    setSelected(after >= 0 ? after : next.includes(null) ? next.indexOf(null) : (selected + 1) % 4);
  }
  async function submitGuess() {
    if (submitting.current || disabled || !codebreaking || !complete || ending || endIntent) return;
    submitting.current = true; setSubmitState('sending'); setLocalError('');
    try { await onSubmitGuess(); if (active.current) setSubmitState(latestCount.current > count ? 'idle' : 'sent'); }
    catch (reason) {
      if (active.current && latestCount.current === count) {
        setSubmitState('error'); setLocalError(reason instanceof Error ? reason.message : 'Your guess is kept unchanged. Retry to confirm it.');
      }
    }
    finally { submitting.current = false; }
  }
  async function finishAttempt(action: 'surrender' | 'cancel') {
    if (endInFlight.current || disabled || submitting.current) return;
    endInFlight.current = true; setEndIntent(action); setEnding(true); setConfirmAction(null); setLocalError('');
    try { await (action === 'surrender' ? onSurrender() : onCancel?.()); }
    catch (reason) { if (active.current) setLocalError(reason instanceof Error ? reason.message : 'The saved status could not be confirmed. Retry this action.'); }
    finally { endInFlight.current = false; if (active.current) setEnding(false); }
  }
  const ownReference = <div className="cipher-own-code" aria-label="Your locked secret code"><span><LockKeyhole size={12} aria-hidden="true" />YOUR CODE</span><div>{(view.own_code ?? []).map((color, index) => <span key={index} role="img" aria-label={`Your secret position ${index + 1}: ${color}`}><CipherPeg color={color} decorative /></span>)}</div><small>{view.opponent_code_locked ? 'Both codes locked' : 'Waiting for rival’s code'}</small></div>;
  return <section className="cipher-game" data-testid="cipher-game" data-cipher-phase={view.phase}>
    <header className="cipher-header"><button type="button" className="cipher-icon-button" aria-label="Leave Cipher Duel and return to Showdown" onClick={onLeave}><ChevronLeft size={20} aria-hidden="true" /></button><div className="cipher-brand"><LockKeyhole size={21} aria-hidden="true" /><div><small>DH SHOWDOWN</small><h1>Cipher Duel</h1></div></div><div className="cipher-rival"><span aria-hidden="true">vs</span><strong>{opponentName}</strong></div><CipherHelp preferenceKey={tutorialPreferenceKey} /></header>
    {ownReference}
    {view.phase === 'waiting_code' ? <div className="cipher-wait"><span className="cipher-wait-seal"><ShieldCheck size={42} strokeWidth={1.1} aria-hidden="true" /></span><p className="cipher-eyebrow">YOUR COMBINATION IS LOCKED</p><h2>The next move<br />belongs to {opponentName}.</h2><p>They’ll lock their secret, then your guessing board opens. You can leave and come back whenever you’re ready.</p><div><button type="button" className="cipher-primary" onClick={onLeave}>Back to Showdown</button>{onCancel && <button type="button" className="cipher-secondary" disabled={disabled || ending || !!endIntent} onClick={() => setConfirmAction('cancel')}>Cancel invitation</button>}</div></div> : <>
      <div className="cipher-board-topline"><span>{sealed ? view.own_attempt.solved ? 'CODE CRACKED' : view.own_attempt.status === 'surrendered' ? 'ATTEMPT SURRENDERED' : view.phase === 'closed' ? 'CHALLENGE CLOSED' : 'ATTEMPT SEALED' : 'CRACK THEIR COMBINATION'}</span><strong>{count}<small> / 10 guesses</small></strong></div>
      {sealed && <div className={`cipher-attempt-result${view.own_attempt.solved ? ' is-solved' : ''}`} data-testid="cipher-attempt-sealed"><span>{view.own_attempt.solved ? <Check size={20} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}</span><div><strong>{view.own_attempt.solved ? `Cracked in ${count} ${count === 1 ? 'guess' : 'guesses'}.` : view.own_attempt.status === 'surrendered' ? 'Your attempt is sealed.' : view.phase === 'closed' ? 'This challenge is closed.' : 'Ten guesses. Secret intact.'}</strong><p>{view.phase === 'completed' ? 'Both attempts are complete. Open the result to compare.' : view.phase === 'closed' ? 'This challenge does not count as a win or loss.' : 'Your rival can finish on their own schedule. Their code stays sealed until the result.'}</p></div></div>}
      <div className="cipher-history-scroll" ref={history} tabIndex={0} aria-label="Your ten guess rows. Scroll to inspect earlier guesses."><CipherGuessHistory guesses={view.own_guesses} activeSequence={codebreaking ? count + 1 : undefined} readOnly={sealed} /></div>
      {codebreaking && <footer className="cipher-composer" data-testid="cipher-composer"><div className="cipher-composer-label"><p>GUESS {Math.min(count + 1, 10)}<span>{attemptsLeft} left</span></p><span>{saveState === 'offline' ? <WifiOff size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}{saveState === 'offline' ? 'Draft on this device' : saveState === 'saving' ? 'Keeping draft…' : 'Draft kept'}</span></div><div className="cipher-guess-slots" role="group" aria-label="Your next guess">{slots.map((color, index) => <button className={`cipher-entry-slot${selected === index ? ' is-selected' : ''}`} key={index} type="button" data-cipher-guess-slot={index} aria-label={`Guess slot ${index + 1}: ${color ?? 'empty'}`} aria-pressed={selected === index} disabled={frozen} onClick={() => setSelected(index)}><CipherPeg color={color ?? undefined} decorative /><small>{index + 1}</small></button>)}</div><div className="cipher-palette" role="group" aria-label="Six guess colors">{CIPHER_COLOR_IDS.map(color => <button key={color} type="button" aria-label={`Choose ${color}`} data-cipher-color={color} disabled={frozen} onClick={() => choose(color)}><CipherPeg color={color} decorative /><span>{color.slice(0, 1).toUpperCase() + color.slice(1)}</span></button>)}</div><div className="cipher-guess-actions"><button className="cipher-icon-button" type="button" aria-label="Remove selected guess peg" disabled={frozen || !slots[selected]} onClick={() => { const next = [...slots]; next[selected] = null; onDraftChange(next); }}><Delete size={18} aria-hidden="true" /></button><button className="cipher-icon-button" type="button" aria-label="Reset current guess" disabled={frozen || !slots.some(Boolean)} onClick={() => { onDraftChange([null, null, null, null]); setSelected(0); }}><RotateCcw size={17} aria-hidden="true" /></button><button className="cipher-primary" type="button" disabled={frozen || !complete} onClick={() => void submitGuess()}>{submitState === 'sending' ? <LoaderCircle size={16} className="cipher-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{submitState === 'sending' ? 'Submitting…' : submitState === 'sent' ? 'Guess sealed' : 'Submit guess'}</button><button className="cipher-icon-button cipher-surrender" type="button" aria-label="Surrender this attempt" disabled={frozen} onClick={() => setConfirmAction('surrender')}><Flag size={17} aria-hidden="true" /></button></div></footer>}
      {sealed && <button type="button" className="cipher-secondary cipher-leave-sealed" onClick={onLeave}>Back to Showdown</button>}
    </>}
    {(localError || error) && <div className="cipher-game-error" role="alert"><p>{localError || error}</p>{submitState === 'error' ? <button className="cipher-secondary" type="button" disabled={disabled || submitting.current} onClick={() => void submitGuess()}>Retry this guess</button> : endIntent ? <button className="cipher-secondary" type="button" disabled={disabled || ending} onClick={() => void finishAttempt(endIntent)}>Retry saved action</button> : onRetry && <button className="cipher-secondary" type="button" disabled={disabled} onClick={() => void Promise.resolve(onRetry()).catch(reason => { if (active.current) setLocalError(reason instanceof Error ? reason.message : 'Reconnect and retry.'); })}>Retry saved progress</button>}</div>}
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <Dialog open={confirmAction !== null} onOpenChange={open => { if (!open && !endInFlight.current) setConfirmAction(null); }}><DialogContent className="cipher-confirm-dialog"><DialogHeader><DialogTitle>{confirmAction === 'surrender' ? 'Seal this attempt?' : 'Cancel invitation?'}</DialogTitle><DialogDescription className="cipher-dialog-description">{confirmAction === 'surrender' ? 'Surrender counts as an unsuccessful attempt. Your guesses will stay saved, and your rival’s secret stays hidden until both attempts finish.' : 'This closes the invitation without adding a win or loss.'}</DialogDescription></DialogHeader><div className="cipher-confirm-actions"><button type="button" className="cipher-secondary" onClick={() => setConfirmAction(null)}>Keep playing</button><button type="button" className="cipher-primary" disabled={disabled || ending} onClick={() => confirmAction && void finishAttempt(confirmAction)}>{confirmAction === 'surrender' ? 'Surrender attempt' : 'Cancel this invitation'}</button></div></DialogContent></Dialog>
  </section>;
}
