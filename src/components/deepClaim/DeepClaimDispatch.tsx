import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Coins, Clock3, HardHat, Pickaxe, Radar, ShieldCheck, Users, Zap } from 'lucide-react';
import { DURATION_OPTIONS, RESOURCE_BY_ID, SPECIALTY_INFO } from '@/lib/deepClaim/catalog';
import type { DeepClaimDispatchInput, DeepClaimDuration, DeepClaimMode, DeepClaimPoint, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimInfrastructureIcon, DeepClaimPortrait, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter } from './DeepClaimPrimitives';
import { claimIntroAvailable, claimTargets } from './display';
import { TutorialHelp, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';
import { DeepClaimWorksitePicker } from './DeepClaimWorksitePicker';
import { worksiteBranch, worksiteName } from './worksiteLabels';
import type { DeepClaimDispatchDraft } from '@/lib/deepClaim/nextShiftPlan';

import { CLAIM_OPERATION_NAMES, CLAIM_PROJECT_NAMES } from './fieldLabels';
type InfrastructureKey = keyof typeof CLAIM_PROJECT_NAMES;
const OPERATION_ICONS = { explore: Pickaxe, extract: Pickaxe, survey: Radar, infrastructure: HardHat };

export function DeepClaimDispatch({ snapshot, initialTarget, initialMode, initialPlan, readOnly, busy, onClose, preview, dispatch }: {
  snapshot: DeepClaimSnapshot; initialTarget: DeepClaimPoint | null; initialMode: DeepClaimMode; readOnly: boolean; busy: boolean;
  initialPlan?: DeepClaimDispatchDraft;
  onClose: () => void; preview: (input: DeepClaimDispatchInput) => Promise<DeepClaimPreview>;
  dispatch: (input: DeepClaimDispatchInput, revision?: number) => Promise<DeepClaimSnapshot>;
}) {
  const tutorialEvents = useDeepClaimTutorialEvents();
  const field = snapshot.schema_version >= 3;
  const [mode, setMode] = useState(initialMode);
  const [target, setTarget] = useState<DeepClaimPoint | null>(() => initialTarget ?? claimTargets(snapshot, initialMode)[0] ?? null);
  const initialMinutes = DURATION_OPTIONS.some(option => option.minutes === initialPlan?.durationMinutes) ? initialPlan!.durationMinutes : 20;
  const [workers, setWorkers] = useState(() => {
    if (!initialPlan) return snapshot.workers.filter(worker => !worker.assigned_job_id && worker.energy > 0).slice(0, 3).map(worker => worker.id);
    const energy = DURATION_OPTIONS.find(option => option.minutes === initialMinutes)!.energy;
    const eligible = new Set(snapshot.workers.filter(worker => !worker.assigned_job_id && worker.energy >= energy).map(worker => worker.id));
    return [...new Set(initialPlan.workerIds)].filter(id => eligible.has(id)).slice(0, 3);
  });
  const [crewOpen, setCrewOpen] = useState(!field);
  const [crewPage, setCrewPage] = useState(0);
  const [minutes, setMinutes] = useState<DeepClaimDuration>(initialMinutes);
  const [project, setProject] = useState<InfrastructureKey>('supports');
  const [tutorial, setTutorial] = useState(!initialPlan?.ordinary && !snapshot.company?.tutorial_used && initialMode === 'extract' && initialTarget?.x === 47 && initialTarget?.y === 1);
  const [quote, setQuote] = useState<DeepClaimPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const actionInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [error, setError] = useState('');
  const targets = useMemo(() => claimTargets({ world: snapshot.world, infrastructure: snapshot.infrastructure }, mode), [snapshot.world, snapshot.infrastructure, mode]);
  const revealed = useMemo(() => new Map(snapshot.world?.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]) ?? []), [snapshot.world]);
  const sites = useMemo(() => target && !targets.some(point => point.x === target.x && point.y === target.y) ? [target, ...targets] : targets, [target, targets]);
  const frozen = readOnly || busy || checking || sending;
  const input: DeepClaimDispatchInput | null = target ? { worker_ids: [...workers].sort(), mode, target_x: target.x, target_y: target.y, duration_minutes: minutes, tutorial, ...(field ? { infrastructure_key: mode === 'infrastructure' ? project : null } : {}) } : null;
  const stale = !!quote && quote.company_revision < snapshot.revision;
  const introAvailable = claimIntroAvailable(snapshot);
  const reviewed = field && !!quote?.allowed && !stale;
  const auxiliary = mode === 'survey' || mode === 'infrastructure';
  const selected = snapshot.workers.filter(worker => workers.includes(worker.id));
  const energyNeeded = tutorial ? 1 : DURATION_OPTIONS.find(option => option.minutes === minutes)!.energy;
  const missingCrew = selected.length !== workers.length;
  const assignedWorker = selected.find(worker => worker.assigned_job_id);
  const tiredWorker = selected.find(worker => worker.energy < energyNeeded);
  const crewIssue = missingCrew ? 'A selected employee is no longer available.'
    : assignedWorker ? `${assignedWorker.name} is already on a shift.`
    : tiredWorker ? `${tiredWorker.name} needs ${energyNeeded} energy for this shift.` : '';
  useTutorialView('dispatch_opened', { mode }, `dispatch:${mode}`);
  useTutorialView('quote_reviewed', quote ? { mode, allowed: quote.allowed, company_revision: quote.company_revision } : null,
    `quote:${quote?.server_now}:${quote?.company_revision}:${quote?.allowed}`);
  const pages = Math.max(1, Math.ceil(snapshot.workers.length / 6));
  const currentPage = Math.min(crewPage, pages - 1);
  const change = (callback: () => void) => { callback(); setQuote(null); setError(''); setConditionsOpen(false); };
  async function review() {
    if (!input || !workers.length || crewIssue || frozen || actionInFlight.current) return;
    actionInFlight.current = true;
    setChecking(true); setError('');
    try { const estimate = await preview(input); if (mounted.current) { setQuote(estimate); setCrewOpen(false); } }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'The foreman could not verify this shift. Try again.'); }
    finally { actionInFlight.current = false; if (mounted.current) setChecking(false); }
  }
  async function confirm() {
    if (!input || !quote?.allowed || stale || crewIssue || frozen || actionInFlight.current) return;
    actionInFlight.current = true;
    setSending(true); setError('');
    try { await dispatch(input, quote.company_revision); if (mounted.current) onClose(); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Dispatch could not be confirmed. Check the saved action before trying again.'); }
    finally { actionInFlight.current = false; if (mounted.current) setSending(false); }
  }
  const title = CLAIM_OPERATION_NAMES[mode];
  return <ClaimDialog open onClose={onClose} busy={checking || sending || busy} title={title} description="" className={`dcl-dispatch-dialog ${field ? 'is-field-operation' : ''}`} headerActions={<TutorialHelp lessonId={mode === 'survey' ? 'field.survey' : mode === 'infrastructure' ? 'field.infrastructure' : 'beginner.plan'} label="Dispatch" />}>
    <div className="dcl-dispatch-body" data-dc-tutorial="dispatch-plan">
      {!reviewed && <>
        <div className={`dcl-segment ${field ? 'dcl-operation-picker' : ''}`} data-dc-tutorial="dispatch-mode" role="group" aria-label="Expedition type">{(field ? ['explore', 'extract', 'survey', 'infrastructure'] as const : ['explore', 'extract'] as const).map(value => { const Icon = OPERATION_ICONS[value]; return <button type="button" key={value} aria-pressed={mode === value} disabled={frozen} onClick={() => { if (mode === value) return; change(() => { setMode(value); setTutorial(false); const choices = claimTargets(snapshot, value); setTarget(current => current && choices.some(site => site.x === current.x && site.y === current.y) ? current : choices[0] ?? null); }); }}>{field && <Icon size={16} aria-hidden="true" />}{CLAIM_OPERATION_NAMES[value]}</button>; })}</div>
        <DeepClaimWorksitePicker key={mode} world={snapshot.world} sites={sites} selected={target} mode={mode} disabled={frozen} onSelect={point => change(() => { setTarget(point); tutorialEvents.emit('worksite_inspected', { mode, record_id: `${point.x}:${point.y}`, view: 'dispatch' }); if (point.x !== 47 || point.y !== 1) setTutorial(false); })} />
        {mode === 'infrastructure' && <section data-dc-tutorial="field-infrastructure" role="group" aria-label="Infrastructure project"><h3>Project</h3><div className="dcl-choice-grid">{Object.entries(CLAIM_PROJECT_NAMES).map(([key, name]) => <button type="button" className="dcl-choice" key={key} data-dc-project={key} aria-pressed={project === key} disabled={frozen} onClick={() => change(() => setProject(key as InfrastructureKey))}><span className="dcl-choice-art"><DeepClaimInfrastructureIcon infrastructureKey={key as InfrastructureKey} decorative /></span><span className="dcl-choice-copy"><strong>{name}</strong><small>{key === 'rail' ? 'Faster hauling' : key === 'pump' ? 'Water protection' : key === 'ventilation' ? 'Gas and heat protection' : 'Rockfall protection'}</small></span></button>)}</div></section>}
        {field && <div className="dcl-selected-crew" data-dc-tutorial="dispatch-crew" role="group" aria-label="Selected crew"><div>{selected.length ? selected.map(worker => <span key={worker.id}><DeepClaimPortrait worker={worker} /><b>{worker.name}</b></span>) : <p>No crew selected</p>}</div><ClaimButton className="is-small" disabled={frozen} onClick={() => { if (crewOpen && workers.length) tutorialEvents.emit('crew_selected', { mode, quantity: workers.length }); setCrewOpen(value => !value); }} aria-expanded={crewOpen}><Users size={14} aria-hidden="true" />{crewOpen ? 'Done' : 'Change crew'}</ClaimButton></div>}
        {(crewOpen || !workers.length) && <fieldset className={`dcl-worker-picker ${field ? 'is-paged' : ''}`} data-dc-tutorial={field ? undefined : 'dispatch-crew'}><legend>Your crew <small>{workers.length}/3 selected</small></legend>{snapshot.workers.slice(currentPage * 6, currentPage * 6 + 6).map(worker => <label className="dcl-worker-choice" key={worker.id} data-selected={workers.includes(worker.id)}><input type="checkbox" aria-label={`Send ${worker.name}`} checked={workers.includes(worker.id)} disabled={frozen || !workers.includes(worker.id) && (!!worker.assigned_job_id || workers.length >= 3 || worker.energy < energyNeeded)} onChange={() => change(() => { const next = workers.includes(worker.id) ? workers.filter(id => id !== worker.id) : [...workers, worker.id]; setWorkers(next); tutorialEvents.emit('crew_selected', { worker_id: worker.id, quantity: next.length, mode }); })} /><DeepClaimPortrait worker={worker} /><span><strong>{worker.name}</strong><small>{SPECIALTY_INFO[worker.specialty].name} · {worker.assigned_job_id ? 'On a shift' : `${worker.energy}/6 energy`}</small><ClaimMeter value={worker.energy} max={6} label={`${worker.name} energy`} tone="green" /></span></label>)}{pages > 1 && <div className="dcl-crew-pagination"><ClaimButton className="is-small" aria-label="Previous crew page" disabled={frozen || currentPage === 0} onClick={() => setCrewPage(value => Math.max(0, value - 1))}><ArrowLeft size={15} aria-hidden="true" /></ClaimButton><span aria-live="polite">Crew {currentPage + 1}/{pages}</span><ClaimButton className="is-small" aria-label="Next crew page" disabled={frozen || currentPage === pages - 1} onClick={() => setCrewPage(value => Math.min(pages - 1, value + 1))}><ArrowRight size={15} aria-hidden="true" /></ClaimButton></div>}</fieldset>}
        <div className="dcl-duration-picker" data-dc-tutorial="dispatch-duration" role="group" aria-label="Shift duration">{DURATION_OPTIONS.map((option, index) => <button type="button" key={option.minutes} aria-pressed={!tutorial && minutes === option.minutes} disabled={frozen} onClick={() => change(() => { setMinutes(option.minutes); setTutorial(false); })}><b>{option.label}</b><span>{option.minutes} min{auxiliary ? ` · grade ${index + 1}` : ''}</span><small><Zap size={10} aria-hidden="true" />{option.energy} each</small></button>)}</div>
        {auxiliary && <p className="dcl-note">{mode === 'survey' ? 'Reveal ground, not cargo. Geology improves coverage; the report arrives on return.' : 'Build on connected ground. Engineering improves coverage; active when the crew returns.'}</p>}
        {introAvailable && !initialPlan?.ordinary && !auxiliary && <label className="dcl-intro-shift" data-dc-tutorial="dispatch-induction"><input type="checkbox" checked={tutorial} disabled={frozen} onChange={event => change(() => { setTutorial(event.target.checked); if (event.target.checked) { setMinutes(20); setMode('extract'); setTarget({ x: 47, y: 1 }); } })} /><span><strong>First shift · 30 seconds</strong><small>1m starter seam · once per company · 1 energy each</small></span></label>}
      </>}
      {reviewed && <div className="dcl-reviewed-operation"><ClaimBadge>{target ? `${worksiteName(target, mode, revealed)} · ${target.y}m · ${worksiteBranch(target)}` : CLAIM_OPERATION_NAMES[mode]}</ClaimBadge><div>{selected.map(worker => <DeepClaimPortrait key={worker.id} worker={worker} />)}<span>{selected.length} crew · {tutorial ? 'Introduction' : `${minutes} min preset`}</span></div></div>}
      {quote && <section className="dcl-dispatch-quote" data-dc-tutorial="dispatch-quote" aria-label="Verified dispatch estimate"><header><ShieldCheck size={16} aria-hidden="true" /><strong>Foreman’s estimate</strong><ClaimBadge tone={quote.risk_level === 'high' ? 'red' : quote.risk_level === 'moderate' ? 'brass' : 'green'}>{quote.risk_level} risk</ClaimBadge></header><dl><div><dt><Coins size={12} aria-hidden="true" />Wages now</dt><dd>{quote.wages.toLocaleString()} cr</dd></div><div><dt><Zap size={12} aria-hidden="true" />Crew energy</dt><dd>{quote.energy_per_worker} each</dd></div><div><dt><Clock3 size={12} aria-hidden="true" />{field ? 'Base shift' : 'Shift length'}</dt><dd>{quote.duration_seconds < 60 ? `${quote.duration_seconds}s` : `${Math.round(quote.duration_seconds / 60)} min`}</dd></div>{!auxiliary && <><div><dt>Estimated haul</dt><dd>{quote.estimated_yield.min}–{quote.estimated_yield.max}</dd></div><div><dt>Cargo capacity</dt><dd>{quote.cargo_capacity} units</dd></div></>}<div><dt>Supported depth</dt><dd>{quote.accessible_depth}m</dd></div>{quote.operation_cost != null && <div><dt>Project fee now</dt><dd>{quote.operation_cost} cr</dd></div>}{quote.survey && <><div><dt>Survey radius</dt><dd>{quote.survey.radius} tiles</dd></div><div><dt>Reveal limit</dt><dd>Up to {quote.survey.tile_limit} tiles</dd></div></>}</dl>
        {quote.installation && <div className="dcl-installation-quote"><DeepClaimInfrastructureIcon infrastructureKey={quote.installation.key} grade={quote.installation.grade} decorative /><div><strong>{CLAIM_PROJECT_NAMES[quote.installation.key]} · grade {quote.installation.grade}</strong><p>{quote.installation.radius}-tile radius · {quote.installation.strength}{quote.installation.key === 'rail' ? '% on covered route' : ' percentage points protection'}</p></div></div>}
        {!!Object.keys(quote.materials_cost ?? {}).length && <div className="dcl-material-costs" aria-label="Project materials consumed now">{Object.entries(quote.materials_cost ?? {}).map(([key, count]) => <span key={key}><DeepClaimResourceIcon resourceId={key as keyof NonNullable<DeepClaimPreview['materials_cost']>} decorative /><b>{count}</b>{RESOURCE_BY_ID[key as keyof NonNullable<DeepClaimPreview['materials_cost']>].name}</span>)}</div>}
        {quote.expected_resources.length > 0 && !auxiliary && <div className="dcl-expected-resources">{quote.expected_resources.map(resource => <span key={resource}><DeepClaimResourceIcon resourceId={resource} decorative />{RESOURCE_BY_ID[resource].name}</span>)}</div>}
        {quote.deep_modifiers && <section className={quote.deep_modifiers.lift_discount_percent > 0 || quote.deep_modifiers.thermal_load_percent > 0 ? "dcl-deep-modifiers" : "dcl-compact-facts"} aria-label="Heat and lift modifiers">{quote.deep_modifiers.lift_discount_percent === 0 && quote.deep_modifiers.thermal_load_percent === 0 ? <><span><Clock3 size={14} aria-hidden="true" />Standard travel</span><span><ShieldCheck size={14} aria-hidden="true" />No heat penalty</span></> : <><div><span>Powered lift</span><strong>{quote.deep_modifiers.lift_discount_percent}% route saving</strong><small>Known, constructed shaft travel only.</small></div><div><span>Heat</span><strong>{quote.deep_modifiers.heat_penalty_percent}% work penalty</strong><small>Reduced output. No cargo or crew is lost.</small></div>{quote.deep_modifiers.thermal_load_percent > 0 && <p>Productive work: {quote.deep_modifiers.effective_work_seconds}s of {quote.deep_modifiers.raw_work_seconds}s. Same elapsed work stage.</p>}</>}</section>}
        {quote.conditions ? <><div className="dcl-condition-summary" data-dc-tutorial="dispatch-conditions"><strong>{quote.conditions.incident_chance_percent}% delay chance</strong><span>{quote.conditions.max_delay_seconds ? `Up to ${quote.conditions.max_delay_seconds}s extra` : 'No incident delay'}</span><button type="button" aria-expanded={conditionsOpen} onClick={() => { if (!conditionsOpen) tutorialEvents.emit('quote_reviewed', { mode, allowed: quote.allowed, view: 'conditions', company_revision: quote.company_revision }); setConditionsOpen(value => !value); }}>Conditions<ChevronDown size={13} aria-hidden="true" /></button></div>{conditionsOpen && <div className="dcl-condition-details"><dl><div><dt>Instability</dt><dd>{quote.conditions.instability}/3</dd></div><div><dt>Gas</dt><dd>{quote.conditions.gas}/3</dd></div><div><dt>Water</dt><dd>{quote.conditions.water}/3</dd></div><div><dt>Route transport bonus</dt><dd>{quote.conditions.transport_bonus_percent}% bonus</dd></div></dl>{quote.deep_modifiers && quote.deep_modifiers.thermal_load_percent > 0 && <><h4>Heat protection</h4><dl><div><dt>Heat load</dt><dd>{quote.deep_modifiers.thermal_load_percent}%</dd></div><div><dt>Crew Engineering</dt><dd>−{quote.deep_modifiers.engineering_mitigation_percent}%</dd></div><div><dt>Installed ventilation</dt><dd>−{quote.deep_modifiers.ventilation_mitigation_percent}%</dd></div><div><dt>Working heat shields</dt><dd>−{quote.deep_modifiers.gear_mitigation_percent}%</dd></div></dl><p>Protection is fixed at dispatch; only working gear on this crew counts. Survey and installation crews do not lose work to heat.</p></>}<p>Crew safety and installed protection included. Incidents delay setup; no workers, tunnels or resources are lost.</p><p>{quote.conditions.infrastructure_ids.length} installed {quote.conditions.infrastructure_ids.length === 1 ? 'project applies' : 'projects apply'}. Later changes affect future shifts.</p></div>}</> : <p>Yield varies. Estimate includes crew, safety and cargo capacity.</p>}
        {field && <p className="dcl-reserve-note">Cash committed now: {quote.wages + (quote.operation_cost ?? 0)} cr. Listed materials are consumed. Keep 2 cr operating reserve.</p>}
        {quote.reasons.length > 0 && <ul className="dcl-blocked-reasons">{quote.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      </section>}
      {stale && <p className="dcl-note">Your camp changed. Review this shift again before confirming.</p>}
      {crewIssue && <div className="dcl-note" role="status"><p>{crewIssue}</p>{missingCrew && <ClaimButton className="is-small" disabled={frozen} onClick={() => change(() => { setWorkers(selected.map(worker => worker.id)); setCrewOpen(true); })}>Remove unavailable crew</ClaimButton>}</div>}
      {readOnly && <p className="dcl-note">Reconnect or confirm the saved action before dispatching.</p>}
      {error && <p className="dcl-error" role="alert">{error}</p>}
    </div>
    <div className="dcl-dialog-actions dcl-dispatch-footer"><ClaimButton onClick={() => { if (reviewed) setQuote(null); else onClose(); }} disabled={checking || sending || busy}>{reviewed ? 'Edit plan' : 'Back'}</ClaimButton>{quote?.allowed && !stale ? <ClaimButton primary pending={sending} disabled={readOnly || busy || !!crewIssue} data-dc-tutorial="dispatch-confirm" onClick={() => void confirm()}>Dispatch crew<ArrowRight size={15} aria-hidden="true" /></ClaimButton> : <ClaimButton primary pending={checking} disabled={readOnly || busy || !input || !workers.length || !!crewIssue} data-dc-tutorial="dispatch-review" onClick={() => void review()}>Review dispatch</ClaimButton>}</div>
  </ClaimDialog>;
}
