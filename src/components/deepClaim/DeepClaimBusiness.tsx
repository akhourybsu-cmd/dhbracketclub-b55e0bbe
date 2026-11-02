import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock3, Coins, GraduationCap, Package, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { RESOURCE_BY_ID, STAT_INFO, resourceQuantity } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_BUSINESS_METRICS, DEEP_CLAIM_RESEARCH_BRANCHES, type DeepClaimBuildingId, type DeepClaimBusinessMetric, type DeepClaimResearchBranch, type DeepClaimResources, type DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimBusinessIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter, ClaimState } from './DeepClaimPrimitives';
import { claimTimeLeft } from './display';
import { TutorialHelp, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';
import { DeepClaimPortrait } from './tutorial/DeepClaimPortrait';

export type ClaimBusinessView = 'company' | 'research' | 'contracts' | 'records' | 'club';
export interface DeepClaimBusinessActions {
  startResearch: (key: string, revision?: number) => Promise<DeepClaimSnapshot>;
  fulfillContract: (key: string, revision?: number) => Promise<DeepClaimSnapshot>;
  claimMilestone: (key: string, revision?: number) => Promise<DeepClaimSnapshot>;
}
const BRANCH_NAMES: Record<DeepClaimResearchBranch, string> = { excavation: 'Excavation', geology: 'Geology', processing: 'Processing', logistics: 'Logistics', workforce: 'Workforce', safety: 'Safety', deep_operations: 'Deep operations' };
const METRIC_NAMES: Record<DeepClaimBusinessMetric, string> = { completed_mining_expeditions: 'Mining shifts completed', completed_surveys: 'Surveys completed', total_surveyed_tiles: 'Tiles surveyed', installed_infrastructure: 'Projects installed', max_completed_mining_depth: 'Deepest mining shift', collected_production_batches: 'Production batches collected', collected_processed_units: 'Processed units collected', completed_research: 'Research completed', completed_contracts: 'Contracts delivered', total_contract_credits: 'Contract credits earned', kept_discoveries: 'Specimens kept' };
type Review = { kind: 'research' | 'contract' | 'milestone'; key: string; revision: number };

export function DeepClaimBusiness({ snapshot, view, onView, onClose, onBuild, onHire, onStores, actions, onConfirmed, now, onRefresh, busy, readOnly, clubContent, initialResearchKey }: {
  snapshot: DeepClaimSnapshot; view: ClaimBusinessView; onView: (view: ClaimBusinessView) => void; onClose: () => void;
  onBuild: (key: DeepClaimBuildingId) => void; onHire: () => void; onStores: () => void; actions: DeepClaimBusinessActions;
  onConfirmed: (title: string, description: string, snapshot: DeepClaimSnapshot) => void;
  now: number; onRefresh: () => void; busy: boolean; readOnly: boolean; clubContent?: ReactNode; initialResearchKey?: string;
}) {
  const tutorial = useDeepClaimTutorialEvents();
  useTutorialView('tab_opened', { tab: 'office', view }, `office:${view}`);
  const [branch, setBranch] = useState<DeepClaimResearchBranch>(() => snapshot.business_catalog?.research.find(item => item.key === initialResearchKey)?.branch ?? 'excavation');
  const [contractPage, setContractPage] = useState(0);
  const [milestonePage, setMilestonePage] = useState(0);
  const [records, setRecords] = useState<'milestones' | 'operations'>('milestones');
  const [storedReview, setReview] = useState<Review | null>(() => initialResearchKey && snapshot.business_catalog?.research.some(item => item.key === initialResearchKey) ? { kind: 'research', key: initialResearchKey, revision: snapshot.revision } : null);
  const [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const openerLabel = useRef<string | null>(null);
  const previousReview = useRef<string | null>(null);
  const previousView = useRef(view);
  const internalView = useRef<ClaimBusinessView | null>(null);
  const review = previousView.current === view || internalView.current === view ? storedReview : null;
  const reviewIdentity = review ? `${review.kind}:${review.key}` : null;
  useLayoutEffect(() => {
    if (internalView.current === view) {
      previousView.current = view; internalView.current = null;
      return;
    }
    if (previousView.current === view) return;
    previousView.current = view; internalView.current = null;
    setReview(null); setError('');
  }, [view]);
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
    if (reviewIdentity) reviewHeading.current?.focus({ preventScroll: true });
    else if (previousReview.current && openerLabel.current) [...(body.current?.querySelectorAll<HTMLButtonElement>('button[aria-label]') ?? [])].find(button => button.getAttribute('aria-label') === openerLabel.current)?.focus({ preventScroll: true });
    previousReview.current = reviewIdentity;
  }, [view, reviewIdentity]);
  const catalog = snapshot.business_catalog, business = snapshot.business;
  const company = snapshot.company;
  const researchBuilding = snapshot.buildings.find(item => item.key === 'research_office');
  const tradingBuilding = snapshot.buildings.find(item => item.key === 'trading_post');
  const active = business?.research.find(item => item.status === 'active');
  const deep = snapshot.schema_version === 5 ? snapshot.deep_catalog : undefined;
  const shaft = snapshot.buildings.find(item => item.key === 'mine_shaft');
  const completedResearch = new Set(business?.research.filter(item => item.status === 'completed').map(item => item.key));
  const completedContracts = new Set(business?.contracts.filter(item => item.status === 'completed').map(item => item.key));
  const research = review?.kind === 'research' ? catalog?.research.find(item => item.key === review.key) : undefined;
  const contract = review?.kind === 'contract' ? catalog?.contracts.find(item => item.key === review.key) : undefined;
  const milestone = review?.kind === 'milestone' ? catalog?.milestones.find(item => item.key === review.key) : undefined;
  useTutorialView(research ? 'research_inspected' : contract ? 'contract_inspected' : 'milestone_inspected',
    research || contract || milestone ? { record_id: research?.key ?? contract?.key ?? milestone?.key, view } : null,
    `office-review:${reviewIdentity}`);
  const milestoneState = business?.milestones.find(item => item.key === milestone?.key);
  const eligible = catalog?.milestones.filter(item => { const state = business?.milestones.find(value => value.key === item.key); return state && !state.claimed_at && state.progress >= item.target; }) ?? [];
  const stale = !!review && review.revision < snapshot.revision;
  const reasons: string[] = [];
  if (research) {
    if (completedResearch.has(research.key)) reasons.push('This research is already complete.');
    if (active) reasons.push('One research project can run at a time.');
    if ((researchBuilding?.level ?? 0) < research.required_building_level) reasons.push(`Research Office level ${research.required_building_level} is required.`);
    for (const key of research.requires) if (!completedResearch.has(key)) reasons.push(`Complete ${catalog?.research.find(item => item.key === key)?.name ?? key} first.`);
    if ((company?.cash ?? 0) < research.cash_cost + 2) reasons.push('The research fee must leave 2 credits for operating reserve.');
    for (const [key, count] of Object.entries(research.inputs)) if (resourceQuantity(snapshot.resources, key as keyof DeepClaimResources) < (count ?? 0)) reasons.push(`Need ${count} ${RESOURCE_BY_ID[key as keyof DeepClaimResources].name} in collected stock.`);
  }
  if (contract) {
    if (completedContracts.has(contract.key)) reasons.push('This order has already been delivered.');
    if ((tradingBuilding?.level ?? 0) < contract.tier) reasons.push(`Trading Post level ${contract.tier} is required.`);
    for (const key of contract.requires_contracts) if (!completedContracts.has(key)) reasons.push(`Deliver ${catalog?.contracts.find(item => item.key === key)?.name ?? key} first.`);
    for (const key of contract.required_research) if (!completedResearch.has(key)) reasons.push(`Complete ${catalog?.research.find(item => item.key === key)?.name ?? key} first.`);
    for (const [key, count] of Object.entries(contract.inputs)) if (resourceQuantity(snapshot.resources, key as keyof DeepClaimResources) < (count ?? 0)) reasons.push(`Need ${count} ${RESOURCE_BY_ID[key as keyof DeepClaimResources].name}; ${resourceQuantity(snapshot.resources, key as keyof DeepClaimResources)} collected.`);
  }
  if (milestone && (!milestoneState || milestoneState.claimed_at || milestoneState.progress < milestone.target)) reasons.push(milestoneState?.claimed_at ? 'This company milestone was already claimed.' : 'The recorded company progress has not reached this milestone.');
  function inspect(kind: Review['kind'], key: string) { openerLabel.current = document.activeElement?.getAttribute('aria-label') ?? null; setReview({ kind, key, revision: snapshot.revision }); setError(''); }
  function changeView(next: ClaimBusinessView) { internalView.current = next; setReview(null); setError(''); onView(next); }
  async function confirm() {
    if (!review || stale || reasons.length || readOnly || busy) return;
    setError('');
    try {
      if (research) { const updated = await actions.startResearch(research.key, review.revision); onConfirmed('Research underway.', `${research.name} is funded. Its benefit begins after the project completes.`, updated); }
      else if (contract) { const updated = await actions.fulfillContract(contract.key, review.revision); onConfirmed('Order delivered.', `${contract.name} · ${contract.reward} company credits. The collected inputs were delivered once.`, updated); }
      else if (milestone) { const updated = await actions.claimMilestone(milestone.key, review.revision); onConfirmed('Company milestone secured.', `${milestone.name} · ${milestone.reward} company credits.`, updated); }
      setReview(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The office could not confirm this action. Check the saved action before retrying.'); }
  }
  const contracts = catalog?.contracts ?? [];
  const currentContractPage = Math.min(contractPage, Math.max(0, Math.ceil(contracts.length / 4) - 1));
  const milestones = catalog?.milestones ?? [];
  const currentMilestonePage = Math.min(milestonePage, Math.max(0, Math.ceil(milestones.length / 4) - 1));
  const activeDefinition = catalog?.research.find(item => item.key === active?.key);
  return <ClaimDialog open onClose={onClose} busy={busy} title="Company Office" description={company ? `${company.name} · build a lasting operation` : 'Your company’s development desk.'} className={`dcl-business-dialog ${clubContent ? 'has-club' : ''}`} headerActions={tutorial.available ? <div className="dct-adviser-actions"><TutorialHelp lessonId={view === 'research' ? 'business.research' : view === 'contracts' ? 'business.contracts' : view === 'records' ? 'business.milestones' : view === 'club' ? 'club.projects' : 'business.office'} label="Company Office" /><ClaimButton className="is-small dct-ask-gus" data-dc-tutorial="ask-gus" aria-label="Ask Gus" onClick={tutorial.askGus}><span className="dct-adviser-portrait" aria-hidden="true"><DeepClaimPortrait speaker="gus" expression="amused" decorative /></span><span className="dct-adviser-label">Ask Gus</span></ClaimButton></div> : undefined}>
    <div className="dcl-business-views" role="group" aria-label="Company office views">{(clubContent ? ['company', 'research', 'contracts', 'records', 'club'] as const : ['company', 'research', 'contracts', 'records'] as const).map(key => <button type="button" key={key} data-dc-tutorial={key === 'club' || key === 'company' ? undefined : `office-${key}`} aria-pressed={view === key} disabled={busy} onClick={() => changeView(key)}>{key === 'company' ? 'Company' : key === 'research' ? 'Research' : key === 'contracts' ? 'Contracts' : key === 'records' ? 'Records' : 'Club'}{key === 'records' && eligible.length > 0 && <b>{eligible.length}</b>}</button>)}</div>
    <div ref={body} className={`dcl-business-body ${view === 'club' ? 'is-club-view' : ''}`}>
      {view === 'club' && clubContent ? clubContent : !catalog || !business || !company ? <ClaimState title="The office needs a fresh report" onRetry={onRefresh}>Refresh the company before managing development.</ClaimState> : review ? <>
        <div className="dcl-business-detail-heading" data-dc-tutorial={research ? 'research-review' : contract ? 'contract-review' : 'milestone-review'}><DeepClaimBusinessIcon kind={research ? 'research' : contract ? 'contract' : 'milestone'} decorative /><div><ClaimBadge>{research ? `Tier ${research.tier} research` : contract ? `Tier ${contract.tier} delivery` : 'Company milestone'}</ClaimBadge><h3 ref={reviewHeading} tabIndex={-1}>{research?.name ?? contract?.name ?? milestone?.name}</h3></div></div>
        <p className="dcl-note">{research?.description ?? contract?.description ?? milestone?.description}</p>
        {research && <>
          <div className="dcl-business-effect"><h4>Permanent benefit for future work</h4><ResearchEffect bonuses={research.stat_bonuses} processing={research.processing_speed_percent} />{research.unlocks_recipes.length > 0 && <p>New recipes: {research.unlocks_recipes.map(key => snapshot.recipes?.find(item => item.key === key)?.name ?? catalog.recipes.find(item => item.key === key)?.name ?? key).join(', ')}.</p>}</div>
          <div className="dcl-business-prerequisites"><h4>Required research</h4>{research.requires.length ? research.requires.map(key => <p key={key} data-complete={completedResearch.has(key)}>{completedResearch.has(key) ? <Check size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}{catalog.research.find(item => item.key === key)?.name ?? key}</p>) : <p>No prior research required.</p>}</div>
          {deep?.shaft.required_research.includes(research.key) && <p className="dcl-note">Also required for Mine Shaft level {deep.shaft.max_level}: access to {deep.shaft.max_depth}m and the powered shaft lift. The shaft extension is a separate paid upgrade.</p>}{deep && deep.recipes.some(recipe => recipe.required_research?.includes(research.key)) && <p className="dcl-note">Used by deep industry: {deep.recipes.filter(recipe => recipe.required_research?.includes(research.key)).map(recipe => recipe.name).join(', ')}. Each recipe also requires its other listed research and station level.</p>}<BusinessMaterials resources={research.inputs} stock={snapshot.resources} />
          <div className="dcl-trade-summary"><span>Paid once now<small>{Math.round(research.duration_seconds / 60)} minutes · completes automatically after server confirmation</small></span><strong>{research.cash_cost} cr</strong></div><p className="dcl-note">Keep 2 credits in reserve. Existing shifts and queued production keep their frozen plans. There is no cancellation or refund.</p>
          {(researchBuilding?.level ?? 0) < research.required_building_level && <ClaimButton onClick={() => onBuild('research_office')}>{researchBuilding?.level ? 'Upgrade' : 'Build'} Research Office</ClaimButton>}
        </>}
        {contract && <>
          <BusinessMaterials resources={contract.inputs} stock={snapshot.resources} />
          <div className="dcl-trade-summary"><span>Company credit payout<small>Deliver the whole order once</small></span><strong>{contract.reward} cr</strong></div>
          <p className="dcl-note">This order does not expire. Only collected warehouse stock can be delivered. The complete listed quantity leaves storage together; staged hauls and unfinished production are unavailable.</p>
          {contract.requires_contracts.length > 0 && <div className="dcl-business-prerequisites"><h4>Previous deliveries</h4>{contract.requires_contracts.map(key => <p key={key} data-complete={completedContracts.has(key)}>{completedContracts.has(key) ? <Check size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}{catalog.contracts.find(item => item.key === key)?.name ?? key}</p>)}</div>}
          {contract.required_research.length > 0 && <p className="dcl-note">Research: {contract.required_research.map(key => catalog.research.find(item => item.key === key)?.name ?? key).join(', ')}.</p>}
          {(tradingBuilding?.level ?? 0) < contract.tier && <ClaimButton onClick={() => onBuild('trading_post')}>{tradingBuilding?.level ? 'Upgrade' : 'Build'} Trading Post</ClaimButton>}<ClaimButton onClick={onStores}><Package size={15} aria-hidden="true" />View collected stock</ClaimButton>
        </>}
        {milestone && <><div className="dcl-trade-summary"><span>{METRIC_NAMES[milestone.metric]}<small>{milestoneState?.progress ?? 0} / {milestone.target} recorded</small></span><strong>{milestone.reward} cr</strong></div><ClaimMeter value={Math.min(milestone.target, milestoneState?.progress ?? 0)} max={milestone.target} label={`${milestone.name} recorded progress`} /><p className="dcl-note">A once-only company credit award for recorded work. Past qualifying activity counts; it is never paid again.</p></>}
        {reasons.length > 0 && <ul className="dcl-blocked-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}{stale && <p className="dcl-note">Your company changed. Review the current report before confirming.</p>}{readOnly && <p className="dcl-note">Reconnect or confirm the saved action before making another office decision.</p>}{error && <p className="dcl-error" role="alert">{error}</p>}
      </> : view === 'company' ? <>
        <div className="dcl-business-company" data-dc-tutorial="office-company"><DeepClaimBusinessIcon kind="office" decorative /><div><span className="dcl-eyebrow">YOUR FRONTIER COMPANY</span><h3>{company.name}</h3><p>One claim. Permanent progress.</p></div></div>
        <div className="dcl-business-kpis"><span><Coins size={15} aria-hidden="true" /><strong>{company.cash.toLocaleString()}</strong><small>Company credits</small></span><span><GraduationCap size={15} aria-hidden="true" /><strong>{business.stats.completed_research}/{catalog.research.length}</strong><small>Research complete</small></span><span><Package size={15} aria-hidden="true" /><strong>{business.stats.completed_contracts}/{contracts.length}</strong><small>Orders delivered</small></span></div>
        {active && <ActiveResearch order={active} name={activeDefinition?.name ?? active.key} now={now} onRefresh={onRefresh} />}
        {eligible.length > 0 && <ClaimButton primary onClick={() => { changeView('records'); setRecords('milestones'); inspect('milestone', eligible[0].key); }}><ShieldCheck size={16} aria-hidden="true" />Review milestone · {eligible.length} ready</ClaimButton>}
        <div className="dcl-office-shortcuts"><ClaimButton onClick={() => changeView('research')}><GraduationCap size={16} aria-hidden="true" />Research</ClaimButton><ClaimButton onClick={() => changeView('contracts')}><Package size={16} aria-hidden="true" />Delivery orders</ClaimButton><ClaimButton onClick={onHire}><Users size={16} aria-hidden="true" />Hire staff</ClaimButton></div>
        {(Object.keys(business.research_bonuses).length > 0 || business.processing_speed_percent > 0) && <section className="dcl-business-effect"><h4>Research currently in effect</h4><ResearchEffect bonuses={business.research_bonuses} processing={business.processing_speed_percent} /><p>Employee profiles already include these skill bonuses, capped at 100. New production uses the displayed current recipe time.</p></section>}
        {deep && <section className="dcl-deep-frontier" aria-label="Ancient Deep progression"><header><DeepClaimBusinessIcon kind="research" decorative /><div><h4>{deep.name}</h4><small>{deep.regions[0]?.min_depth}–{deep.shaft.max_depth}m · {shaft?.level === deep.shaft.max_level ? 'Shaft ready' : `Shaft level ${deep.shaft.max_level}`}</small></div></header><p>{shaft?.level === deep.shaft.max_level ? 'The lift reduces travel only on the known constructed shaft. Prepare hot worksites with Engineering, ventilation and working crew heat shields.' : `Complete ${deep.shaft.required_research.map(key => catalog.research.find(item => item.key === key)?.name ?? key).join(', ')} and review the final shaft extension. Existing research opens this region.`}</p><div><ClaimButton className="is-small" onClick={() => onBuild('mine_shaft')}>Review mine shaft</ClaimButton><ClaimButton className="is-small" onClick={() => { changeView('research'); setBranch('deep_operations'); }}>Deep operations research</ClaimButton></div></section>}
        <p className="dcl-note">Research and delivery orders develop this private company. Company credits stay within Deep Claim.</p>
      </> : view === 'research' ? <>
        <div className="dcl-section-heading"><div><h3>Applied knowledge</h3><p>Seven branches. Two permanent advances each.</p></div><ClaimBadge>{business.stats.completed_research}/14</ClaimBadge></div>
        {active && <ActiveResearch order={active} name={activeDefinition?.name ?? active.key} now={now} onRefresh={onRefresh} />}
        {!researchBuilding?.level && <section className="dcl-card dcl-capacity-callout"><div><strong>Build the Research Office</strong><p>Its level opens the corresponding research tier.</p></div><ClaimButton disabled={busy} onClick={() => onBuild('research_office')}>Build Research Office</ClaimButton></section>}
        <div className="dcl-research-branches" role="group" aria-label="Research branches">{DEEP_CLAIM_RESEARCH_BRANCHES.map(key => <button type="button" key={key} aria-pressed={branch === key} onClick={() => setBranch(key)}>{BRANCH_NAMES[key]}<small>{catalog.research.filter(item => item.branch === key && completedResearch.has(item.key)).length}/2</small></button>)}</div>
        <div className="dcl-research-tree" aria-label={`${BRANCH_NAMES[branch]} research path`}>{catalog.research.filter(item => item.branch === branch).map((item, index) => <section className="dcl-research-node" key={item.key} data-complete={completedResearch.has(item.key)}>{index > 0 && <ArrowRight className="dcl-research-connector" size={18} aria-hidden="true" />}<header><DeepClaimBusinessIcon kind="research" decorative /><div><h4>{item.name}</h4><ClaimBadge tone={completedResearch.has(item.key) ? 'green' : active?.key === item.key ? 'blue' : 'brass'}>{completedResearch.has(item.key) ? 'Complete' : active?.key === item.key ? 'In progress' : `Tier ${item.tier}`}</ClaimBadge></div></header><ResearchEffect bonuses={item.stat_bonuses} processing={item.processing_speed_percent} /><small>{item.cash_cost} cr · {Math.round(item.duration_seconds / 60)} min · {item.requires.length} {item.requires.length === 1 ? 'prerequisite' : 'prerequisites'}</small><ClaimButton className="is-small" onClick={() => inspect('research', item.key)} aria-label={`Review ${item.name}`}>View research<ArrowRight size={13} aria-hidden="true" /></ClaimButton></section>)}</div>
      </> : view === 'contracts' ? <>
        <div className="dcl-section-heading"><div><h3>Frontier orders</h3><p>Twelve finite orders. No expiry. Whole deliveries.</p></div><ClaimBadge>{business.stats.completed_contracts}/12</ClaimBadge></div>
        {!tradingBuilding?.level && <section className="dcl-card dcl-capacity-callout"><div><strong>Build the Trading Post</strong><p>Its level opens delivery tiers 1, 2 and 3.</p></div><ClaimButton disabled={busy} onClick={() => onBuild('trading_post')}>Build Trading Post</ClaimButton></section>}
        <div className="dcl-contract-list">{contracts.slice(currentContractPage * 4, currentContractPage * 4 + 4).map(item => <section className="dcl-card dcl-contract-card" key={item.key}><header><DeepClaimBusinessIcon kind="contract" decorative /><div><h4>{item.name}</h4><p>Tier {item.tier} · {item.reward} cr</p></div><ClaimBadge tone={completedContracts.has(item.key) ? 'green' : 'brass'}>{completedContracts.has(item.key) ? 'Delivered' : 'Order'}</ClaimBadge></header><BusinessMaterials resources={item.inputs} stock={snapshot.resources} compact /><ClaimButton className="is-small" onClick={() => inspect('contract', item.key)} aria-label={`Review order ${item.name}`}>Review order<ArrowRight size={13} aria-hidden="true" /></ClaimButton></section>)}</div><OfficePagination page={currentContractPage} total={contracts.length} size={4} label="orders" onPage={setContractPage} />
      </> : <>
        <div className="dcl-segment" role="group" aria-label="Company records"><button type="button" aria-pressed={records === 'milestones'} onClick={() => setRecords('milestones')}>Milestones</button><button type="button" aria-pressed={records === 'operations'} onClick={() => { setRecords('operations'); tutorial.emit('tab_opened', { tab: 'office', view: 'operations' }); }}>Operations</button></div>
        {records === 'milestones' ? <><div className="dcl-milestone-list">{milestones.slice(currentMilestonePage * 4, currentMilestonePage * 4 + 4).map(item => { const state = business.milestones.find(value => value.key === item.key); const progress = state?.progress ?? 0; return <section className="dcl-card dcl-milestone-card" key={item.key}><header><DeepClaimBusinessIcon kind="milestone" decorative /><div><h4>{item.name}</h4><p>{item.description}</p></div><ClaimBadge tone={state?.claimed_at ? 'green' : progress >= item.target ? 'brass' : 'muted'}>{state?.claimed_at ? 'Claimed' : progress >= item.target ? 'Ready' : `${progress}/${item.target}`}</ClaimBadge></header><ClaimMeter value={Math.min(item.target, progress)} max={item.target} label={`${item.name} recorded progress`} /><ClaimButton className="is-small" onClick={() => inspect('milestone', item.key)} aria-label={`Review milestone ${item.name}`}>{state?.claimed_at ? 'View record' : `Review · ${item.reward} cr`}</ClaimButton></section>; })}</div><OfficePagination page={currentMilestonePage} total={milestones.length} size={4} label="milestones" onPage={setMilestonePage} /><p className="dcl-note">Progress comes from recorded company work, including qualifying activity before this office opened. Awards require one explicit claim.</p><Link className="dcl-button" to="/feats?goal=deep_claim_shifts">View DH Feats</Link></> : <><div className="dcl-business-stat-grid">{DEEP_CLAIM_BUSINESS_METRICS.map(key => <span key={key}><strong>{business.stats[key].toLocaleString()}{key === 'max_completed_mining_depth' ? 'm' : ''}</strong><small>{METRIC_NAMES[key]}</small></span>)}</div><p className="dcl-note">Lifetime totals from completed work and collected production. Staged output and uncompleted jobs are excluded.</p></>}
      </>}
    </div>
    {view !== 'club' && <div className="dcl-business-footer dcl-dialog-actions">{review ? <><ClaimButton disabled={busy} onClick={() => { setReview(null); setError(''); }}><ArrowLeft size={14} aria-hidden="true" />Back</ClaimButton>{stale ? <ClaimButton primary disabled={busy} onClick={() => { setReview({ ...review, revision: snapshot.revision }); setError(''); }}>Review current report</ClaimButton> : <ClaimButton primary pending={busy} disabled={readOnly || reasons.length > 0 || !catalog || !business} onClick={() => void confirm()}>{research ? 'Start research' : contract ? 'Deliver whole order' : 'Claim company credits'}</ClaimButton>}</> : <ClaimButton onClick={onClose} disabled={busy}>Back to camp</ClaimButton>}</div>}
  </ClaimDialog>;
}

function BusinessMaterials({ resources, stock, compact = false }: { resources: DeepClaimResources; stock: DeepClaimResources; compact?: boolean }) {
  return <div className={`dcl-business-materials ${compact ? 'is-compact' : ''}`}>{Object.entries(resources).map(([key, count]) => { const held = resourceQuantity(stock, key as keyof DeepClaimResources); return <span key={key} data-short={held < (count ?? 0)}><DeepClaimResourceIcon resourceId={key as keyof DeepClaimResources} decorative /><b>{count} {RESOURCE_BY_ID[key as keyof DeepClaimResources].name}</b><small>{held} collected{held < (count ?? 0) ? ` · need ${(count ?? 0) - held} more` : ' · ready'}</small></span>; })}</div>;
}
function ResearchEffect({ bonuses, processing }: { bonuses: NonNullable<DeepClaimSnapshot['business']>['research_bonuses']; processing: number }) {
  return <p className="dcl-research-effect">{Object.entries(bonuses).map(([key, count]) => <span key={key}>+{count} {STAT_INFO[key as keyof typeof STAT_INFO].name}</span>)}{processing > 0 && <span>{processing}% shorter future production time</span>}</p>;
}
function ActiveResearch({ order, name, now, onRefresh }: { order: NonNullable<DeepClaimSnapshot['business']>['research'][number]; name: string; now: number; onRefresh: () => void }) {
  const due = now >= Date.parse(order.completes_at);
  return <section className="dcl-card dcl-active-research"><header><Clock3 size={17} aria-hidden="true" /><div><strong>{name}</strong><small>{due ? 'Awaiting completion report' : `Completes in ${claimTimeLeft(order.completes_at, now)}`}</small></div><ClaimBadge tone="blue">Researching</ClaimBadge></header><ClaimMeter value={Math.min(100, Math.max(0, 100 * (now - Date.parse(order.started_at)) / (Date.parse(order.completes_at) - Date.parse(order.started_at))))} max={100} label="Research elapsed time" tone="blue" />{due && <ClaimButton className="is-small" onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />Check research completion</ClaimButton>}</section>;
}
function OfficePagination({ page, total, size, label, onPage }: { page: number; total: number; size: number; label: string; onPage: (page: number) => void }) {
  if (total <= size) return null;
  return <div className="dcl-field-pagination" role="group" aria-label={`${label} pages`}><ClaimButton className="is-small" aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</ClaimButton><span aria-live="polite">{page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}</span><ClaimButton className="is-small" aria-label={`Next ${label} page`} disabled={(page + 1) * size >= total} onClick={() => onPage(page + 1)}>Next</ClaimButton></div>;
}
