import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Coins, Clock3, HardHat, Pickaxe, Radar, ShieldCheck, Users, Zap } from 'lucide-react';
import { DURATION_OPTIONS, RESOURCE_BY_ID, SPECIALTY_INFO } from '@/lib/deepClaim/catalog';
import type { DeepClaimDispatchInput, DeepClaimDuration, DeepClaimMode, DeepClaimPoint, DeepClaimPreview, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimInfrastructureIcon, DeepClaimPortrait, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter } from './DeepClaimPrimitives';
import { claimIntroAvailable, claimTargets } from './display';

import { CLAIM_OPERATION_NAMES, CLAIM_PROJECT_NAMES } from './fieldLabels';
type InfrastructureKey = keyof typeof CLAIM_PROJECT_NAMES;
const OPERATION_ICONS = { explore: Pickaxe, extract: Pickaxe, survey: Radar, infrastructure: HardHat };

export function DeepClaimDispatch({ snapshot, initialTarget, initialMode, readOnly, busy, onClose, preview, dispatch }: {
  snapshot: DeepClaimSnapshot; initialTarget: DeepClaimPoint | null; initialMode: DeepClaimMode; readOnly: boolean; busy: boolean;
  onClose: () => void; preview: (input: DeepClaimDispatchInput) => Promise<DeepClaimPreview>;
  dispatch: (input: DeepClaimDispatchInput, revision?: number) => Promise<DeepClaimSnapshot>;
}) {
  const field = snapshot.schema_version >= 3;
  const [mode, setMode] = useState(initialMode);
  const [target, setTarget] = useState<DeepClaimPoint | null>(() => initialTarget ?? claimTargets(snapshot, initialMode)[0] ?? null);
  const [workers, setWorkers] = useState(() => snapshot.workers.filter(worker => !worker.assigned_job_id && worker.energy > 0).slice(0, 3).map(worker => worker.id));
  const [crewOpen, setCrewOpen] = useState(!field);
  const [crewPage, setCrewPage] = useState(0);
  const [sitePage, setSitePage] = useState(0);
  const [siteSearch, setSiteSearch] = useState('');
  const [minutes, setMinutes] = useState<DeepClaimDuration>(20);
  const [project, setProject] = useState<InfrastructureKey>('supports');
  const [tutorial, setTutorial] = useState(!snapshot.company?.tutorial_used && initialMode === 'extract' && initialTarget?.x === 47 && initialTarget?.y === 1);
  const [quote, setQuote] = useState<DeepClaimPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [error, setError] = useState('');
  const targets = useMemo(() => claimTargets({ world: snapshot.world, infrastructure: snapshot.infrastructure }, mode), [snapshot.world, snapshot.infrastructure, mode]);
  const revealed = useMemo(() => new Map(snapshot.world?.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]) ?? []), [snapshot.world]);
  const sites = useMemo(() => target && !targets.some(point => point.x === target.x && point.y === target.y) ? [target, ...targets] : targets, [target, targets]);
  const pagedSites = sites.length > 64;
  const filteredSites = useMemo(() => {
    const words = siteSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!pagedSites || !words.length) return sites;
    return sites.filter(point => { const tile = revealed.get(`${point.x}:${point.y}`); const material = tile?.material ? RESOURCE_BY_ID[tile.material].name : ''; const text = `${point.x}:${point.y} x${point.x} ${point.y}m ${material} ${mode === 'survey' || mode === 'infrastructure' ? 'connected passage' : 'frontier edge'}`.toLocaleLowerCase(); return words.every(word => text.includes(word)); });
  }, [sites, pagedSites, siteSearch, revealed, mode]);
  const sitePages = Math.max(1, Math.ceil(filteredSites.length / 64));
  const currentSitePage = Math.min(sitePage, sitePages - 1);
  const visibleSites = pagedSites ? filteredSites.slice(currentSitePage * 64, currentSitePage * 64 + 64) : sites;
  const pinnedSite = target && !visibleSites.some(point => point.x === target.x && point.y === target.y) ? target : null;
  const displayedSites = pinnedSite ? [pinnedSite, ...visibleSites] : visibleSites;
  const frozen = readOnly || busy || checking || sending;
  const input: DeepClaimDispatchInput | null = target ? { worker_ids: [...workers].sort(), mode, target_x: target.x, target_y: target.y, duration_minutes: minutes, tutorial, ...(field ? { infrastructure_key: mode === 'infrastructure' ? project : null } : {}) } : null;
  const stale = !!quote && quote.company_revision < snapshot.revision;
  const introAvailable = claimIntroAvailable(snapshot);
  const reviewed = field && !!quote?.allowed && !stale;
  const auxiliary = mode === 'survey' || mode === 'infrastructure';
  const selected = snapshot.workers.filter(worker => workers.includes(worker.id));
  const pages = Math.max(1, Math.ceil(snapshot.workers.length / 6));
  const currentPage = Math.min(crewPage, pages - 1);
  const change = (callback: () => void) => { callback(); setQuote(null); setError(''); setConditionsOpen(false); };
  async function review() {
    if (!input || !workers.length || frozen) return;
    setChecking(true); setError('');
    try { setQuote(await preview(input)); setCrewOpen(false); }
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
  const title = mode === 'survey' ? 'Survey the mine' : mode === 'infrastructure' ? 'Improve the mine' : mode === 'extract' ? 'Work a seam' : field ? 'Explore the frontier' : 'Survey new ground';
  return <ClaimDialog open onClose={onClose} busy={checking || sending || busy} title={title} description={reviewed ? 'A verified plan. Confirm the real cost before the crew leaves.' : 'Choose your crew. Review before company cash, materials or energy are spent.'} className={`dcl-dispatch-dialog ${field ? 'is-field-operation' : ''}`}>
    <div className="dcl-dispatch-body">
      {!reviewed && <>
        <div className={`dcl-segment ${field ? 'dcl-operation-picker' : ''}`} role="group" aria-label="Expedition type">{(field ? ['explore', 'extract', 'survey', 'infrastructure'] as const : ['explore', 'extract'] as const).map(value => { const Icon = OPERATION_ICONS[value]; return <button type="button" key={value} aria-pressed={mode === value} disabled={frozen} onClick={() => change(() => { setMode(value); setSitePage(0); setSiteSearch(''); setTutorial(false); const choices = claimTargets(snapshot, value); setTarget(current => current && choices.some(site => site.x === current.x && site.y === current.y) ? current : choices[0] ?? null); })}>{field && <Icon size={16} aria-hidden="true" />}{CLAIM_OPERATION_NAMES[value]}</button>; })}</div>
        <label>Worksite<select aria-label="Expedition worksite" disabled={frozen || !sites.length} value={target ? `${target.x}:${target.y}` : ''} onChange={event => change(() => { const [x, y] = event.target.value.split(':').map(Number); setTarget({ x, y }); if (x !== 47 || y !== 1) setTutorial(false); })}>{!sites.length && <option value="">No known worksite</option>}{displayedSites.map(point => { const tile = revealed.get(`${point.x}:${point.y}`); return <option key={`${point.x}:${point.y}`} value={`${point.x}:${point.y}`}>{pinnedSite === point ? 'Selected · ' : ''}{auxiliary ? 'Connected passage' : tile?.material ? RESOURCE_BY_ID[tile.material].name : 'Frontier edge'} · {point.y}m · x{point.x}{!auxiliary && tile?.material ? ` · ${tile.remaining} left` : ''}</option>; })}</select></label>
        {pagedSites && <div className="dcl-site-browser"><label>Depth or material<input type="search" aria-label="Depth or material" placeholder="Depth, material or x:y" value={siteSearch} disabled={frozen} onChange={event => { setSiteSearch(event.target.value); setSitePage(0); }} /></label><div className="dcl-site-pagination" role="group" aria-label="Worksite pages"><ClaimButton className="is-small" aria-label="Previous worksite page" disabled={frozen || currentSitePage === 0} onClick={() => setSitePage(currentSitePage - 1)}>Previous</ClaimButton><span aria-live="polite">{filteredSites.length ? `${currentSitePage * 64 + 1}–${Math.min(filteredSites.length, currentSitePage * 64 + 64)} of ${filteredSites.length}` : 'No matching sites'}</span><ClaimButton className="is-small" aria-label="Next worksite page" disabled={frozen || currentSitePage >= sitePages - 1} onClick={() => setSitePage(currentSitePage + 1)}>Next</ClaimButton></div>{pinnedSite && <p>The selected worksite stays available while browsing.</p>}</div>}
        {!sites.length && <p className="dcl-note">{mode === 'extract' ? 'Explore first to locate a workable deposit.' : auxiliary ? 'Choose an excavated, revealed passage connected to the shaft.' : 'Select an edge of the revealed mine to explore.'}</p>}
        {mode === 'infrastructure' && <label>Infrastructure project<select aria-label="Infrastructure project" disabled={frozen} value={project} onChange={event => change(() => setProject(event.target.value as InfrastructureKey))}>{Object.entries(CLAIM_PROJECT_NAMES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
        {field && <div className="dcl-selected-crew" role="group" aria-label="Selected crew"><div>{selected.length ? selected.map(worker => <span key={worker.id}><DeepClaimPortrait worker={worker} /><b>{worker.name}</b></span>) : <p>No crew selected</p>}</div><ClaimButton className="is-small" disabled={frozen} onClick={() => setCrewOpen(value => !value)} aria-expanded={crewOpen}><Users size={14} aria-hidden="true" />{crewOpen ? 'Done' : 'Change crew'}</ClaimButton></div>}
        {(crewOpen || !workers.length) && <fieldset className={`dcl-worker-picker ${field ? 'is-paged' : ''}`}><legend>Your crew <small>{workers.length}/3 selected</small></legend>{snapshot.workers.slice(currentPage * 6, currentPage * 6 + 6).map(worker => <label className="dcl-worker-choice" key={worker.id} data-selected={workers.includes(worker.id)}><input type="checkbox" aria-label={`Send ${worker.name}`} checked={workers.includes(worker.id)} disabled={frozen || !workers.includes(worker.id) && (!!worker.assigned_job_id || workers.length >= 3 || worker.energy === 0)} onChange={() => change(() => setWorkers(current => current.includes(worker.id) ? current.filter(id => id !== worker.id) : [...current, worker.id]))} /><DeepClaimPortrait worker={worker} /><span><strong>{worker.name}</strong><small>{SPECIALTY_INFO[worker.specialty].name} · {worker.assigned_job_id ? 'On a shift' : `${worker.energy}/6 energy`}</small><ClaimMeter value={worker.energy} max={6} label={`${worker.name} energy`} tone="green" /></span></label>)}{pages > 1 && <div className="dcl-crew-pagination"><ClaimButton className="is-small" aria-label="Previous crew page" disabled={frozen || currentPage === 0} onClick={() => setCrewPage(value => Math.max(0, value - 1))}><ArrowLeft size={15} aria-hidden="true" /></ClaimButton><span aria-live="polite">Crew {currentPage + 1}/{pages}</span><ClaimButton className="is-small" aria-label="Next crew page" disabled={frozen || currentPage === pages - 1} onClick={() => setCrewPage(value => Math.min(pages - 1, value + 1))}><ArrowRight size={15} aria-hidden="true" /></ClaimButton></div>}</fieldset>}
        <div className="dcl-duration-picker" role="group" aria-label="Shift duration">{DURATION_OPTIONS.map((option, index) => <button type="button" key={option.minutes} aria-pressed={!tutorial && minutes === option.minutes} disabled={frozen} onClick={() => change(() => { setMinutes(option.minutes); setTutorial(false); })}><b>{option.label}</b><span>{option.minutes} min{auxiliary ? ` · grade ${index + 1}` : ''}</span><small><Zap size={10} aria-hidden="true" />{option.energy} each</small></button>)}</div>
        {auxiliary && <p className="dcl-note">{mode === 'survey' ? 'Reveal nearby unknown ground without mining it. Geology improves the survey. No resource cargo; the field report arrives when the crew returns.' : 'Build at a connected passage. Engineering improves coverage and strength. The installation becomes active only after the crew returns.'}</p>}
        {introAvailable && !auxiliary && <label className="dcl-intro-shift"><input type="checkbox" checked={tutorial} disabled={frozen} onChange={event => change(() => { setTutorial(event.target.checked); if (event.target.checked) { setMinutes(20); setMode('extract'); setSitePage(0); setSiteSearch(''); setTarget({ x: 47, y: 1 }); } })} /><span><strong>First shift · 30 seconds</strong><small>Starter extraction at 1m. One accelerated introduction and one energy per worker.</small></span></label>}
      </>}
      {reviewed && <div className="dcl-reviewed-operation"><ClaimBadge>{CLAIM_OPERATION_NAMES[mode]} · {target?.y}m · x{target?.x}</ClaimBadge><div>{selected.map(worker => <DeepClaimPortrait key={worker.id} worker={worker} />)}<span>{selected.length} crew · {tutorial ? 'Introduction' : `${minutes} min preset`}</span></div></div>}
      {quote && <section className="dcl-dispatch-quote" aria-label="Verified dispatch estimate"><header><ShieldCheck size={16} aria-hidden="true" /><strong>Foreman’s estimate</strong><ClaimBadge tone={quote.risk_level === 'high' ? 'red' : quote.risk_level === 'moderate' ? 'brass' : 'green'}>{quote.risk_level} risk</ClaimBadge></header><dl><div><dt><Coins size={12} aria-hidden="true" />Wages now</dt><dd>{quote.wages.toLocaleString()} cr</dd></div><div><dt><Zap size={12} aria-hidden="true" />Crew energy</dt><dd>{quote.energy_per_worker} each</dd></div><div><dt><Clock3 size={12} aria-hidden="true" />{field ? 'Base shift' : 'Shift length'}</dt><dd>{quote.duration_seconds < 60 ? `${quote.duration_seconds}s` : `${Math.round(quote.duration_seconds / 60)} min`}</dd></div>{!auxiliary && <><div><dt>Estimated haul</dt><dd>{quote.estimated_yield.min}–{quote.estimated_yield.max}</dd></div><div><dt>Cargo capacity</dt><dd>{quote.cargo_capacity} units</dd></div></>}<div><dt>Supported depth</dt><dd>{quote.accessible_depth}m</dd></div>{quote.operation_cost != null && <div><dt>Project fee now</dt><dd>{quote.operation_cost} cr</dd></div>}{quote.survey && <><div><dt>Survey radius</dt><dd>{quote.survey.radius} tiles</dd></div><div><dt>Reveal limit</dt><dd>Up to {quote.survey.tile_limit} tiles</dd></div></>}</dl>
        {quote.installation && <div className="dcl-installation-quote"><DeepClaimInfrastructureIcon infrastructureKey={quote.installation.key} grade={quote.installation.grade} decorative /><div><strong>{CLAIM_PROJECT_NAMES[quote.installation.key]} · grade {quote.installation.grade}</strong><p>{quote.installation.radius}-tile radius · {quote.installation.strength}{quote.installation.key === 'rail' ? '% on covered route' : ' percentage points protection'}</p></div></div>}
        {!!Object.keys(quote.materials_cost ?? {}).length && <div className="dcl-material-costs" aria-label="Project materials consumed now">{Object.entries(quote.materials_cost ?? {}).map(([key, count]) => <span key={key}><DeepClaimResourceIcon resourceId={key as keyof NonNullable<DeepClaimPreview['materials_cost']>} decorative /><b>{count}</b>{RESOURCE_BY_ID[key as keyof NonNullable<DeepClaimPreview['materials_cost']>].name}</span>)}</div>}
        {quote.expected_resources.length > 0 && !auxiliary && <div className="dcl-expected-resources">{quote.expected_resources.map(resource => <span key={resource}><DeepClaimResourceIcon resourceId={resource} decorative />{RESOURCE_BY_ID[resource].name}</span>)}</div>}
        {quote.deep_modifiers && <section className="dcl-deep-modifiers" aria-label="Heat and lift modifiers"><div><span>Powered lift</span><strong>{quote.deep_modifiers.lift_discount_percent}% route saving</strong><small>Known, constructed shaft travel only.</small></div><div><span>Heat</span><strong>{quote.deep_modifiers.heat_penalty_percent}% work penalty</strong><small>Reduced output. No cargo or crew is lost.</small></div>{quote.deep_modifiers.thermal_load_percent > 0 && <p>Productive work: {quote.deep_modifiers.effective_work_seconds}s of {quote.deep_modifiers.raw_work_seconds}s. The work stage keeps its full elapsed time.</p>}</section>}
        {quote.conditions ? <><div className="dcl-condition-summary"><strong>{quote.conditions.incident_chance_percent}% delay chance</strong><span>{quote.conditions.max_delay_seconds ? `Up to ${quote.conditions.max_delay_seconds}s extra` : 'No incident delay'}</span><button type="button" aria-expanded={conditionsOpen} onClick={() => setConditionsOpen(value => !value)}>Conditions<ChevronDown size={13} aria-hidden="true" /></button></div>{conditionsOpen && <div className="dcl-condition-details"><dl><div><dt>Instability</dt><dd>{quote.conditions.instability}/3</dd></div><div><dt>Gas</dt><dd>{quote.conditions.gas}/3</dd></div><div><dt>Water</dt><dd>{quote.conditions.water}/3</dd></div><div><dt>Route transport bonus</dt><dd>{quote.conditions.transport_bonus_percent}% bonus</dd></div></dl>{quote.deep_modifiers && quote.deep_modifiers.thermal_load_percent > 0 && <><h4>Heat protection</h4><dl><div><dt>Heat load</dt><dd>{quote.deep_modifiers.thermal_load_percent}%</dd></div><div><dt>Crew Engineering</dt><dd>−{quote.deep_modifiers.engineering_mitigation_percent}%</dd></div><div><dt>Installed ventilation</dt><dd>−{quote.deep_modifiers.ventilation_mitigation_percent}%</dd></div><div><dt>Working heat shields</dt><dd>−{quote.deep_modifiers.gear_mitigation_percent}%</dd></div></dl><p>Protection is frozen for this shift. Only working gear assigned to the selected workers counts. Survey and installation crews do not lose work to heat.</p></>}<p>Includes crew safety and applicable installed protection. A possible incident adds a bounded setup delay. Workers, tunnels and resources are not lost.</p><p>{quote.conditions.infrastructure_ids.length} applicable installed {quote.conditions.infrastructure_ids.length === 1 ? 'project' : 'projects'}. Changes after dispatch apply to future shifts.</p></div>}</> : <p>Estimated returns can vary. Safety protects productive work; the estimate includes crew efficiency and haul capacity.</p>}
        {field && <p className="dcl-reserve-note">Cash committed now: {quote.wages + (quote.operation_cost ?? 0)} cr. Project materials, if listed, are also consumed. Keep 2 cr operating reserve.</p>}
        {quote.reasons.length > 0 && <ul className="dcl-blocked-reasons">{quote.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      </section>}
      {stale && <p className="dcl-note">Your camp changed. Review this shift again before confirming.</p>}
      {readOnly && <p className="dcl-note">Reconnect or confirm the saved action before dispatching.</p>}
      {error && <p className="dcl-error" role="alert">{error}</p>}
    </div>
    <div className="dcl-dialog-actions dcl-dispatch-footer"><ClaimButton onClick={() => { if (reviewed) setQuote(null); else onClose(); }} disabled={checking || sending || busy}>{reviewed ? 'Edit plan' : 'Back'}</ClaimButton>{quote?.allowed && !stale ? <ClaimButton primary pending={sending} disabled={readOnly || busy} onClick={() => void confirm()}>Dispatch crew<ArrowRight size={15} aria-hidden="true" /></ClaimButton> : <ClaimButton primary pending={checking} disabled={readOnly || busy || !input || !workers.length} onClick={() => void review()}>Review dispatch</ClaimButton>}</div>
  </ClaimDialog>;
}
