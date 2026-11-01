import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, Delete, LoaderCircle, LockKeyhole, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CIPHER_COLOR_IDS, type CipherCode, type CipherColorId } from '@/lib/showdown/cipher/types';
import { CipherPeg } from './CipherPeg';
import { CipherHelp } from './CipherHelp';
import './cipherGame.css';

export interface CipherCodeMakerProps {
  opponent: { displayName: string; avatarUrl?: string | null };
  onLock: (code: CipherCode) => Promise<void>;
  onLeave?: () => void;
  busy?: boolean;
  error?: string | null;
  initialCode?: (CipherColorId | null)[];
  onDraftChange?: (draft: (CipherColorId | null)[]) => void;
  step: 'challenge' | 'accept';
  tutorialPreferenceKey?: string;
  onDecline?: () => Promise<void> | void;
  /** Restores an unknown-outcome lock so a reload cannot edit or replace it. */
  pendingCode?: CipherCode | null;
}
const fill = (value?: (CipherColorId | null)[]) => Array.from({ length: 4 }, (_, index) => value?.[index] ?? null);
const colorLabel = (color: string) => color.slice(0, 1).toUpperCase() + color.slice(1);

export function CipherCodeMaker(props: CipherCodeMakerProps) {
  const { opponent, onLock, onLeave, busy = false, error, initialCode, onDraftChange, step, tutorialPreferenceKey, onDecline, pendingCode } = props;
  const [code, setCode] = useState<(CipherColorId | null)[]>(() => fill(pendingCode ?? initialCode));
  const [selected, setSelected] = useState(() => Math.max(0, fill(pendingCode ?? initialCode).indexOf(null)));
  const [confirming, setConfirming] = useState(false);
  const [declineConfirm, setDeclineConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [intent, setIntent] = useState<CipherCode | null>(pendingCode ?? null);
  const active = useRef(true), inFlight = useRef(false), edited = useRef(false);
  const initialKey = JSON.stringify(initialCode ?? []), pendingKey = JSON.stringify(pendingCode ?? null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (pendingCode) { setIntent([...pendingCode]); setCode([...pendingCode]); }
    else if (!edited.current && !intent) setCode(fill(initialCode));
  // Drafts can arrive after the first scoped server snapshot has hydrated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, pendingKey]);
  const frozen = busy || sending || !!intent || !!pendingCode;
  const complete = code.length === 4 && code.every(value => value !== null && CIPHER_COLOR_IDS.includes(value));
  const opponentName = opponent.displayName || 'Your rival';
  function change(next: (CipherColorId | null)[]) { if (frozen) return; edited.current = true; setCode(next); onDraftChange?.(next); setFailure(''); }
  function choose(color: CipherColorId) {
    if (frozen) return;
    const next = [...code]; next[selected] = color; change(next);
    const nextEmpty = next.findIndex((value, index) => value === null && index > selected);
    setSelected(nextEmpty >= 0 ? nextEmpty : next.includes(null) ? next.indexOf(null) : (selected + 1) % 4);
  }
  async function lock() {
    if (inFlight.current || busy || !complete) return;
    const locked = intent ?? [...code] as CipherCode;
    inFlight.current = true; setIntent(locked); setConfirming(false); setSending(true); setFailure('');
    try { await onLock([...locked]); if (active.current) setAcknowledged(true); }
    catch (reason) { if (active.current) setFailure(reason instanceof Error ? reason.message : 'The lock could not be confirmed. Retry this exact code.'); }
    finally { inFlight.current = false; if (active.current) setSending(false); }
  }
  async function decline() {
    if (inFlight.current || frozen || !onDecline) return;
    inFlight.current = true; setSending(true); setFailure('');
    try { await onDecline(); if (active.current) setDeclineConfirm(false); }
    catch (reason) { if (active.current) setFailure(reason instanceof Error ? reason.message : 'The invitation could not be declined. Try again.'); }
    finally { inFlight.current = false; if (active.current) setSending(false); }
  }
  return <section className="cipher-game cipher-maker" data-testid="cipher-code-maker" data-cipher-step={step}>
    <header className="cipher-header"><button type="button" className="cipher-icon-button" aria-label="Return to Showdown" onClick={onLeave ?? (() => window.location.assign('/showdown?game=cipher_duel'))}><ChevronLeft size={20} aria-hidden="true" /></button><div className="cipher-brand"><LockKeyhole size={21} aria-hidden="true" /><div><small>DH SHOWDOWN</small><h1>Cipher Duel</h1></div></div><CipherHelp preferenceKey={tutorialPreferenceKey} /></header>
    <div className="cipher-maker-body"><div className="cipher-maker-rival">{opponent.avatarUrl ? <img src={opponent.avatarUrl} alt="" /> : <span aria-hidden="true">{opponentName.slice(0, 1).toUpperCase()}</span>}<div><small>{step === 'challenge' ? 'CHALLENGE' : 'INVITATION FROM'}</small><strong>{opponentName}</strong></div></div><div className="cipher-maker-title"><p className="cipher-eyebrow">SET THE COMBINATION</p><h2>Make them<br /><em>think twice.</em></h2><p>Four pegs. Six colors. Repeats welcome.</p></div>
      <div className="cipher-code-vault"><div className="cipher-vault-edge"><LockKeyhole size={13} aria-hidden="true" /><span>YOUR SECRET</span><span>{code.filter(Boolean).length} / 4</span></div><div className="cipher-maker-slots" role="group" aria-label="Your secret code">{code.map((color, index) => <button key={index} type="button" className={`cipher-entry-slot${selected === index ? ' is-selected' : ''}`} data-cipher-code-slot={index} aria-label={`Secret slot ${index + 1}: ${color ?? 'empty'}`} aria-pressed={selected === index} disabled={frozen} onClick={() => setSelected(index)}><CipherPeg color={color ?? undefined} decorative /><small>{index + 1}</small></button>)}</div><p>{intent ? 'This exact combination is being locked.' : `Choose a color for space ${selected + 1}.`}</p></div>
    </div>
    <footer className="cipher-composer cipher-maker-controls"><div className="cipher-palette" role="group" aria-label="Six peg colors">{CIPHER_COLOR_IDS.map(color => <button key={color} type="button" aria-label={`Choose ${color}`} data-cipher-color={color} disabled={frozen} onClick={() => choose(color)}><CipherPeg color={color} decorative /><span>{colorLabel(color)}</span></button>)}</div><div className="cipher-maker-actions"><button className="cipher-icon-button" type="button" aria-label="Remove selected secret peg" disabled={frozen || !code[selected]} onClick={() => { const next = [...code]; next[selected] = null; change(next); }}><Delete size={18} aria-hidden="true" /></button><button className="cipher-icon-button" type="button" aria-label="Reset secret code" disabled={frozen || !code.some(Boolean)} onClick={() => { change(fill()); setSelected(0); }}><RotateCcw size={17} aria-hidden="true" /></button><button className="cipher-primary" type="button" disabled={busy || sending || !complete || acknowledged} onClick={() => intent ? void lock() : setConfirming(true)}>{sending || busy ? <LoaderCircle className="cipher-spin" size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}{sending ? 'Locking code…' : acknowledged ? 'Code locked' : intent ? 'Retry this code' : step === 'challenge' ? 'Lock & challenge' : 'Lock & accept'}<ArrowRight size={15} aria-hidden="true" /></button></div>{(failure || error) && <p className="cipher-inline-error" role="alert">{failure || error}{intent && <small>Your code is kept unchanged for a safe retry.</small>}</p>}{onDecline && <button type="button" className="cipher-text-button" disabled={frozen} onClick={() => setDeclineConfirm(true)}>Decline invitation</button>}<p className="cipher-maker-footnote">Your opponent sees your secret only after both attempts finish.</p></footer>
    <Dialog open={declineConfirm} onOpenChange={open => { if (!inFlight.current) setDeclineConfirm(open); }}><DialogContent className="cipher-confirm-dialog"><DialogHeader><DialogTitle>Decline this invitation?</DialogTitle><DialogDescription className="cipher-dialog-description">Neither player receives a win or loss.</DialogDescription></DialogHeader><div className="cipher-confirm-actions"><button type="button" className="cipher-secondary" disabled={sending} onClick={() => setDeclineConfirm(false)}>Keep invitation</button><button type="button" className="cipher-primary" disabled={sending || busy} onClick={() => void decline()}>Decline this challenge</button></div>{failure && <p className="cipher-inline-error" role="alert">{failure}</p>}</DialogContent></Dialog>
    <Dialog open={confirming} onOpenChange={open => { if (!inFlight.current) setConfirming(open); }}><DialogContent className="cipher-confirm-dialog"><DialogHeader><DialogTitle>Lock your code?</DialogTitle><DialogDescription className="cipher-dialog-description">Once locked, your code cannot be changed. Your opponent will try to crack this combination.</DialogDescription></DialogHeader><div className="cipher-confirm-code" role="img" aria-label={`Code to lock: ${code.join(', ')}`}>{code.map((color, index) => <CipherPeg key={index} color={color ?? undefined} decorative />)}</div><div className="cipher-confirm-actions"><button type="button" className="cipher-secondary" onClick={() => setConfirming(false)}>Keep editing</button><button type="button" className="cipher-primary" disabled={busy || sending} onClick={() => void lock()}><LockKeyhole size={15} aria-hidden="true" />Lock this code</button></div></DialogContent></Dialog>
  </section>;
}
