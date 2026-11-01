import { useMemo, useState } from 'react';
import { ArrowRight, Coins, Clock3, ShieldCheck, Zap } from 'lucide-react';
import { DURATION_OPTIONS, RESOURCE_BY_ID, SPECIALTY_INFO } from '@/lib/deepClaim/catalog';
import type { DeepClaimDispatchInput, DeepClaimDuration, DeepClaimMode, DeepClaimPoint, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimPortrait, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter } from './DeepClaimPrimitives';
import { claimIntroAvailable, claimTargets } from './display';


export function DeepClaimDispatch({ snapshot, initialTarget, initialMode, readOnly, busy, onClose, preview, dispatch }: {
  snapshot: DeepClaimSnapshot;
  initialTarget: DeepClaimPoint | null;
  initialMode: DeepClaimMode;
  readOnly: boolean;
  busy: boolean;
  onClose: () => void;
  preview: (input: DeepClaimDispatchInput) => Promise<DeepClaimPreview>;
  dispatch: (input: DeepClaimDispatchInput, revision?: number) => Promise<DeepClaimSnapshot>;
}) {
  const [mode, setMode] = useState(initialMode);
  const [target, setTarget] = useState<DeepClaimPoint | null>(() => initialTarget ?? claimTargets(snapshot, initialMode)[0] ?? null);
  const [workers, setWorkers] = useState(() => snapshot.workers.filter(worker => !worker.assigned_job_id && worker.energy > 0).slice(0, 3).map(worker => worker.id));
  const [minutes, setMinutes] = useState<DeepClaimDuration>(20);
  const [tutorial, setTutorial] = useState(!snapshot.company?.tutorial_used && initialMode === 'extract' && initialTarget?.x === 47 && initialTarget?.y === 1);
  const [quote, setQuote] = useState<DeepClaimPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const targets = useMemo(() => claimTargets(snapshot, mode), [snapshot, mode]);
  const revealed = useMemo(() => new Map(snapshot.world?.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]) ?? []), [snapshot.world]);
  const sites = target && !targets.some(point => point.x === target.x && point.y === target.y) ? [target, ...targets] : targets;
  const frozen = readOnly || busy || checking || sending;
  const input: DeepClaimDispatchInput | null = target ? { worker_ids: [...workers].sort(), mode, target_x: target.x, target_y: target.y, duration_minutes: minutes, tutorial } : null;
  const stale = !!quote && quote.company_revision < snapshot.revision;
  const introAvailable = claimIntroAvailable(snapshot);
  const change = (callback: () => void) => { callback(); setQuote(null); setError(''); };
  async function review() {
    if (!input || !workers.length || frozen) return;
    setChecking(true); setError('');
    try { setQuote(await preview(input)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The foreman could not verify this shift. Try again.'); }
    finally { setChecking(false); }
  }
  async function confirm() {
    if (!input || !quote?.allowed || stale || frozen) return;
    setSending(true); setError('');
    try { await dispatch(input, quote.company_revision); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Dispatch could not be confirmed. Check the saved action before trying again.'); }
    finally { setSending(false); }
  }
  return <ClaimDialog open onClose={onClose} busy={checking || sending || busy} title={mode === 'explore' ? 'Survey new ground' : 'Work a seam'} description="Choose your crew. Review the shift before wages or energy are spent." className="dcl-dispatch-dialog">
    <div className="dcl-segment" aria-label="Expedition type">{(['explore', 'extract'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} disabled={frozen} onClick={() => change(() => { setMode(value); setTutorial(false); setTarget(claimTargets(snapshot, value)[0] ?? null); })}>{value === 'explore' ? 'Exploration' : 'Extraction'}</button>)}</div>
    <label>Worksite<select aria-label="Expedition worksite" disabled={frozen || !sites.length} value={target ? `${target.x}:${target.y}` : ''} onChange={event => change(() => { const [x, y] = event.target.value.split(':').map(Number); setTarget({ x, y }); if (x !== 47 || y !== 1) setTutorial(false); })}>{!sites.length && <option value="">No known worksite</option>}{sites.map(point => { const tile = revealed.get(`${point.x}:${point.y}`); return <option key={`${point.x}:${point.y}`} value={`${point.x}:${point.y}`}>{tile?.material ? RESOURCE_BY_ID[tile.material].name : 'Frontier edge'} · {point.y}m · x{point.x}{tile?.material ? ` · ${tile.remaining} left` : ''}</option>; })}</select></label>
    {!sites.length && <p className="dcl-note">{mode === 'extract' ? 'Explore first to locate a workable deposit.' : 'Select an edge of the revealed mine to survey.'}</p>}
    <fieldset className="dcl-worker-picker"><legend>Your crew <small>{workers.length}/3 selected</small></legend>{snapshot.workers.map(worker => <label className="dcl-worker-choice" key={worker.id} data-selected={workers.includes(worker.id)}><input type="checkbox" aria-label={`Send ${worker.name}`} checked={workers.includes(worker.id)} disabled={frozen || !workers.includes(worker.id) && (!!worker.assigned_job_id || workers.length >= 3)} onChange={() => change(() => setWorkers(current => current.includes(worker.id) ? current.filter(id => id !== worker.id) : [...current, worker.id]))} /><DeepClaimPortrait worker={worker} /><span><strong>{worker.name}</strong><small>{SPECIALTY_INFO[worker.specialty].name} · {worker.assigned_job_id ? 'On a shift' : `${worker.energy}/6 energy`}</small><ClaimMeter value={worker.energy} max={6} label={`${worker.name} energy`} tone="green" /></span></label>)}</fieldset>
    <div className="dcl-duration-picker" aria-label="Shift duration">{DURATION_OPTIONS.map(option => <button type="button" key={option.minutes} aria-pressed={!tutorial && minutes === option.minutes} disabled={frozen} onClick={() => change(() => { setMinutes(option.minutes); setTutorial(false); })}><b>{option.label}</b><span>{option.minutes} min</span><small><Zap size={10} aria-hidden="true" />{option.energy} each</small></button>)}</div>
    {introAvailable && <label className="dcl-intro-shift"><input type="checkbox" checked={tutorial} disabled={frozen} onChange={event => change(() => { setTutorial(event.target.checked); if (event.target.checked) { setMinutes(20); setMode('extract'); setTarget({ x: 47, y: 1 }); } })} /><span><strong>First shift · 30 seconds</strong><small>Starter extraction at 1m. One accelerated introduction and one energy per worker.</small></span></label>}
    {quote && <section className="dcl-dispatch-quote" aria-label="Verified dispatch estimate"><header><ShieldCheck size={16} aria-hidden="true" /><strong>Foreman’s estimate</strong><ClaimBadge tone={quote.risk_level === 'high' ? 'red' : quote.risk_level === 'moderate' ? 'brass' : 'green'}>{quote.risk_level} risk</ClaimBadge></header><dl><div><dt><Coins size={12} aria-hidden="true" />Wages now</dt><dd>{quote.wages.toLocaleString()} cr</dd></div><div><dt><Zap size={12} aria-hidden="true" />Crew energy</dt><dd>{quote.energy_per_worker} each</dd></div><div><dt><Clock3 size={12} aria-hidden="true" />Shift length</dt><dd>{quote.duration_seconds < 60 ? `${quote.duration_seconds}s` : `${Math.round(quote.duration_seconds / 60)} min`}</dd></div><div><dt>Estimated haul</dt><dd>{quote.estimated_yield.min}–{quote.estimated_yield.max}</dd></div><div><dt>Cargo capacity</dt><dd>{quote.cargo_capacity} units</dd></div><div><dt>Supported depth</dt><dd>{quote.accessible_depth}m</dd></div></dl>{quote.expected_resources.length > 0 && <div className="dcl-expected-resources">{quote.expected_resources.map(resource => <span key={resource}><DeepClaimResourceIcon resourceId={resource} decorative />{RESOURCE_BY_ID[resource].name}</span>)}</div>}<p>Estimated returns can vary. Safety protects productive work; the estimate includes crew efficiency and haul capacity.</p>{quote.reasons.length > 0 && <ul className="dcl-blocked-reasons">{quote.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}</section>}
    {stale && <p className="dcl-note">Your camp changed. Review this shift again before confirming.</p>}
    {readOnly && <p className="dcl-note">Reconnect or confirm the saved action before dispatching.</p>}
    {error && <p className="dcl-error" role="alert">{error}</p>}
    <div className="dcl-dialog-actions"><ClaimButton onClick={onClose} disabled={checking || sending || busy}>Back</ClaimButton>{quote?.allowed && !stale ? <ClaimButton primary pending={sending} disabled={readOnly || busy} onClick={() => void confirm()}>Dispatch crew<ArrowRight size={15} aria-hidden="true" /></ClaimButton> : <ClaimButton primary pending={checking} disabled={readOnly || busy || !input || !workers.length} onClick={() => void review()}>Review dispatch</ClaimButton>}</div>
  </ClaimDialog>;
}
