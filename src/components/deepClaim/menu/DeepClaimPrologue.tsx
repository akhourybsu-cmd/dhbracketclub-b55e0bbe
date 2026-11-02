import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, FileSignature, Pickaxe, ShieldCheck, Timer, Users } from 'lucide-react';
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
    <header><button type="button" className="dct-button" onClick={onBack} disabled={busy}><ArrowLeft size={17} aria-hidden="true" />Main menu</button><span><b>01</b>Stake your claim</span></header>
    {value.stage === 'story' ? <div className="dcm-prologue-story"><DeepClaimTutorialDialogue scene={scene} lineIndex={Math.min(value.line, scene.lines.length - 1)} history={scene.lines.slice(0, value.line)} reducedMotion={reducedMotion}
      onAdvance={() => { onInteraction(); if (value.line >= scene.lines.length - 1) change({ stage: 'name' }); else change({ line: value.line + 1 }); }}
      onBack={value.line > 0 ? () => change({ line: value.line - 1 }) : undefined} onSkip={() => change({ stage: 'name' })} skipLabel="Skip introduction" /></div>
      : <div className="dcm-deed"><div className="dcm-deed-gus"><DeepClaimPortrait speaker="gus" expression={value.stage === 'review' ? 'skeptical' : 'amused'} decorative /></div><form onSubmit={event => { event.preventDefault(); if (value.stage === 'name') { if (valid) change({ stage: 'review' }); } else void found(); }}>
        <span className="dct-kicker">GUS “GRAVEL” CALLOWAY</span><h1>{value.stage === 'name' ? 'Name your company.' : 'Sign the deed.'}</h1>
        <p className="dcm-gus-line">{value.stage === 'name' ? '“What goes on the sign?”' : '“A good claim deserves a proper signature.”'}</p>
        {value.stage === 'name' ? <><label htmlFor="deep-claim-company-name">Company name</label><input id="deep-claim-company-name" data-dc-tutorial="company-name" autoComplete="organization" placeholder="Your frontier company" maxLength={40} minLength={2} value={value.name} disabled={busy || blocked} onChange={event => change({ name: event.target.value })} /><button type="submit" className="dct-button is-primary" disabled={!valid || busy || blocked}>Review deed<ArrowRight size={17} aria-hidden="true" /></button></>
          : <><dl><div><dt>Company</dt><dd>{value.name.trim()}</dd></div><div><dt>Home club</dt><dd>{clubName}</dd></div></dl><div className="dcm-deed-facts" role="group" aria-label="Starting company"><span><Users size={18} aria-hidden="true" /><b>3 crew</b></span><span><Pickaxe size={18} aria-hidden="true" /><b>Persistent mine</b></span><span><Timer size={18} aria-hidden="true" /><b>30s first shift</b></span></div><p className="dcm-deed-protection"><ShieldCheck size={16} aria-hidden="true" /><span>One company per member, per club. Standard shifts run in real time.</span></p><div className="dcm-deed-actions"><button type="button" className="dct-button" disabled={busy} onClick={() => change({ stage: 'name' })}>Edit name</button><button data-dc-tutorial="company-found" type="submit" className="dct-button is-primary" disabled={!valid || busy || blocked} aria-busy={busy || undefined}><FileSignature size={17} aria-hidden="true" />{busy ? 'Signing the deed…' : 'Found company'}</button></div></>}
        {(failure || error) && <p className="dct-error" role="alert">{failure || error}</p>}
      </form></div>}
  </section>;
}
