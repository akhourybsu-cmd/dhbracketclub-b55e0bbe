import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, FileSignature, SkipForward } from 'lucide-react';
import { getDialogueScene } from '@/lib/deepClaim/tutorial/dialogue';
import { DeepClaimTutorialDialogue } from '../tutorial/DeepClaimTutorialDialogue';
import { DeepClaimPortrait } from '../tutorial/DeepClaimPortrait';
import { DeepClaimMenuBackdrop } from './DeepClaimMenuBackdrop';
import './prologue.css';

interface Draft { name: string; line: number; stage: 'story' | 'name' | 'review' }
function draft(key: string): Draft {
  try { const value = JSON.parse(localStorage.getItem(key) ?? 'null'); return { name: typeof value?.name === 'string' ? value.name.slice(0, 40) : '', line: Number.isSafeInteger(value?.line) ? Math.max(0, value.line) : 0, stage: ['name', 'review'].includes(value?.stage) ? value.stage : 'story' }; }
  catch { return { name: '', line: 0, stage: 'story' }; }
}
export function DeepClaimPrologue({ identity, clubName, reducedMotion, reducedGraphics, busy, blocked, error, onBack, onFound, onInteraction }: {
  identity: string; clubName: string; reducedMotion: boolean; reducedGraphics: boolean; busy: boolean; blocked: boolean;
  error?: string | null; onBack: () => void; onFound: (name: string) => Promise<void>; onInteraction: () => void;
}) {
  const key = `dh:deep-claim:deed-draft:v1:${identity}`;
  const [value, setValue] = useState(() => draft(key));
  const [failure, setFailure] = useState('');
  const scene = useMemo(() => getDialogueScene('opening.deed')!, []);
  function change(patch: Partial<Draft>) { setValue(before => { const next = { ...before, ...patch }; try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Optional draft storage never blocks founding. */ } return next; }); }
  const valid = value.name.trim().length >= 2 && value.name.trim().length <= 40;
  async function found() {
    if (!valid || busy || blocked) return;
    setFailure(''); onInteraction();
    try { await onFound(value.name.trim()); try { localStorage.removeItem(key); } catch { /* The real company is already persisted. */ } }
    catch (issue) { setFailure(issue instanceof Error ? issue.message : 'The deed could not be confirmed. Retry the saved action.'); }
  }
  return <section className="dcm-prologue" data-stage={value.stage} aria-label="Chapter One — Stake Your Claim" data-reduced-motion={reducedMotion}>
    <DeepClaimMenuBackdrop variant="founding" active={!busy} reducedMotion={reducedMotion} reducedGraphics={reducedGraphics} />
    <header><button type="button" className="dct-button" onClick={onBack} disabled={busy}><ArrowLeft size={17} aria-hidden="true" />Main menu</button><span>CHAPTER ONE · STAKE YOUR CLAIM</span>{value.stage === 'story' && <button type="button" className="dct-button" onClick={() => change({ stage: 'name' })}><SkipForward size={16} aria-hidden="true" />Skip introduction</button>}</header>
    {value.stage === 'story' ? <div className="dcm-prologue-story"><DeepClaimTutorialDialogue scene={scene} lineIndex={Math.min(value.line, scene.lines.length - 1)} history={scene.lines.slice(0, value.line)} reducedMotion={reducedMotion}
      onAdvance={() => { onInteraction(); if (value.line >= scene.lines.length - 1) change({ stage: 'name' }); else change({ line: value.line + 1 }); }}
      onBack={value.line > 0 ? () => change({ line: value.line - 1 }) : undefined} onSkip={() => change({ stage: 'name' })} /></div>
      : <div className="dcm-deed"><div className="dcm-deed-gus"><DeepClaimPortrait speaker="gus" expression={value.stage === 'review' ? 'skeptical' : 'amused'} decorative /></div><form onSubmit={event => { event.preventDefault(); if (value.stage === 'name') { if (valid) change({ stage: 'review' }); } else void found(); }}>
        <span className="dct-kicker">GUS “GRAVEL” CALLOWAY · RETIRING PROSPECTOR</span><h1>{value.stage === 'name' ? 'A name for the next chapter.' : 'The claim is ready to change hands.'}</h1>
        <p>{value.stage === 'name' ? '“Forty-two years on this ground. The sign could use fresh paint. What shall we put on it?”' : '“Read before you sign. Good habit in mining. Saves on both lawsuits and surprises.”'}</p>
        {value.stage === 'name' ? <><label htmlFor="deep-claim-company-name">Company name</label><input id="deep-claim-company-name" data-dc-tutorial="company-name" autoComplete="organization" placeholder="Your frontier company" maxLength={40} minLength={2} value={value.name} disabled={busy || blocked} onChange={event => change({ name: event.target.value })} /><button type="submit" className="dct-button is-primary" disabled={!valid || busy || blocked}>Review deed<ArrowRight size={17} aria-hidden="true" /></button></>
          : <><dl><div><dt>Company</dt><dd>{value.name.trim()}</dd></div><div><dt>Home club</dt><dd>{clubName}</dd></div></dl><p>Your real company, three starting employees and persistent mine will be established together. This is your one company save in this club.</p><p>The first induction shift takes 30 seconds. Ordinary shifts keep their real elapsed time.</p><div className="dcm-deed-actions"><button type="button" className="dct-button" disabled={busy} onClick={() => change({ stage: 'name' })}>Edit name</button><button data-dc-tutorial="company-found" type="submit" className="dct-button is-primary" disabled={!valid || busy || blocked} aria-busy={busy || undefined}><FileSignature size={17} aria-hidden="true" />{busy ? 'Signing the deed…' : 'Found company'}</button></div></>}
        {(failure || error) && <p className="dct-error" role="alert">{failure || error}</p>}
      </form></div>}
  </section>;
}
