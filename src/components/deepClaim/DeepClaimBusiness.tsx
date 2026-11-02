import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock3, Coins, GraduationCap, LockKeyhole, Package, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { RESOURCE_BY_ID, STAT_INFO, resourceQuantity } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_BUSINESS_METRICS, DEEP_CLAIM_RESEARCH_BRANCHES, type DeepClaimBuildingId, type DeepClaimBusinessMetric, type DeepClaimResearchBranch, type DeepClaimResources, type DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimBusinessIcon, DeepClaimEquipmentIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter, ClaimState } from './DeepClaimPrimitives';
import { claimTimeLeft } from './display';
import { TutorialHelp, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';
import { DeepClaimPortrait } from './tutorial/DeepClaimPortrait';
import './businessMenu.css';

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
  const researchCount = catalog?.research.filter(item => completedResearch.has(item.key)).length ?? 0;
  const researchMaxed = !!catalog?.research.length && researchCount === catalog.research.length;
  const completedContracts = new Set(business?.contracts.filter(item => item.status === 'completed').map(item => item.key));
  const research = review?.kind === 'research' ? catalog?.research.find(item => item.key === review.key) : undefined;
  const researchComplete = !!research && completedResearch.has(research.key);
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
    if (!review || stale || reasons.length || readOnly || busy || researchComplete) return;
    setError('');
    try {
      if (research) { const updated = await actions.startResearch(research.key, review.revision); onConfirmed('Research underway.', `${research.name} is funded. Its benefit begins after the project completes.`, updated); }
      else if (contract) { const updated = await actions.fulfillContract(contract.key, review.revision); onConfirmed('Order delivered.', `${contract.name} · ${contract.reward} company credits.`, updated); }
      else if (milestone) { const updated = await actions.claimMilestone(milestone.key, review.revision); onConfirmed('Company milestone secured.', `${milestone.name} · ${milestone.reward} company credits.`, updated); }
      setReview(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The office could not confirm this action. Check the saved action before retrying.'); }
  }
  const contracts = catalog?.contracts ?? [];
  const currentContractPage = Math.min(contractPage, Math.max(0, Math.ceil(contracts.length / 4) - 1));
  const milestones = catalog?.milestones ?? [];
  const currentMilestonePage = Math.min(milestonePage, Math.max(0, Math.ceil(milestones.length / 4) - 1));
  const activeDefinition = catalog?.research.find(item => item.key === active?.key);
  return <ClaimDialog open onClose={onClose} busy={busy} title="Company Office" description="" className={`dcl-business-dialog ${clubContent ? 'has-club' : ''}`} headerActions={tutorial.available ? <div className="dct-adviser-actions"><TutorialHelp lessonId={view === 'research' ? 'business.research' : view === 'contracts' ? 'business.contracts' : view === 'records' ? 'business.milestones' : view === 'club' ? 'club.projects' : 'business.office'} label="Company Office" /><ClaimButton className="is-small dct-ask-gus" data-dc-tutorial="ask-gus" aria-label="Ask Gus" onClick={tutorial.askGus}><span className="dct-adviser-portrait" aria-hidden="true"><DeepClaimPortrait speaker="gus" expression="amused" decorative /></span><span className="dct-adviser-label">Ask Gus</span></ClaimButton></div> : undefined}>
    <div className="dcl-business-views" role="group" aria-label="Company office views">{(clubContent ? ['company', 'research', 'contracts', 'records', 'club'] as const : ['company', 'research', 'contracts', 'records'] as const).map(key => <button type="button" key={key} data-dc-tutorial={key === 'club' || key === 'company' ? undefined : `office-${key}`} aria-pressed={view === key} disabled={busy} onClick={() => changeView(key)}><DeepClaimBusinessIcon kind={key === 'company' || key === 'club' ? 'office' : key === 'research' ? 'research' : key === 'contracts' ? 'contract' : 'milestone'} decorative /><span>{key === 'company' ? 'Company' : key === 'research' ? 'Research' : key === 'contracts' ? 'Contracts' : key === 'records' ? 'Records' : 'Club'}</span>{key === 'records' && eligible.length > 0 && <b>{eligible.length}</b>}</button>)}</div>
    <div ref={body} className={`dcl-business-body ${view === 'club' ? 'is-club-view' : ''}`}>
      {view === 'club' && clubContent ? clubContent : !catalog || !business || !company ? <ClaimState title="The office needs a fresh report" onRetry={onRefresh}>Refresh the company before managing development.</ClaimState> : review ? <>
        <div className="dcl-business-detail-heading" data-dc-tutorial={research ? 'research-review' : contract ? 'contract-review' : 'milestone-review'}>{research ? <ResearchBranchArt branch={research.branch} /> : <DeepClaimBusinessIcon kind={contract ? 'contract' : 'milestone'} decorative />}<div><ClaimBadge>{research ? researchComplete ? 'Complete' : `Tier ${research.tier} research` : contract ? `Tier ${contract.tier} delivery` : 'Company milestone'}</ClaimBadge><h3 ref={reviewHeading} tabIndex={-1}>{research?.name ?? contract?.name ?? milestone?.name}</h3></div></div>
        {!research && <p className="dcl-note">{contract?.description ?? milestone?.description}</p>}
        {research && <>
          {active?.key === research.key && <ActiveResearch order={active} name={research.name} now={now} onRefresh={onRefresh} />}
          <div className="dcl-business-effect"><h4>Effects</h4><ResearchEffect bonuses={research.stat_bonuses} processing={research.processing_speed_percent} /><ResearchUnlocks keys={research.unlocks_recipes} snapshot={snapshot} /></div>
          {!researchComplete && <div className="dcl-business-prerequisites"><h4>Required research</h4>{research.requires.length ? research.requires.map(key => <p key={key} data-complete={completedResearch.has(key)}>{completedResearch.has(key) ? <Check size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}{catalog.research.find(item => item.key === key)?.name ?? key}</p>) : <p>No prior research required.</p>}</div>}
          {deep?.shaft.required_research.includes(research.key) && <p className="dcl-note">Also required for Mine Shaft level {deep.shaft.max_level}: access to {deep.shaft.max_depth}m and the powered shaft lift. The shaft extension is a separate paid upgrade.</p>}{deep && deep.recipes.some(recipe => recipe.required_research?.includes(research.key)) && <p className="dcl-note">Used by deep industry: {deep.recipes.filter(recipe => recipe.required_research?.includes(research.key)).map(recipe => recipe.name).join(', ')}. Each recipe also requires its other listed research and station level.</p>}{!researchComplete && <BusinessMaterials resources={research.inputs} stock={snapshot.resources} />}
          {!researchComplete && <><div className="dcl-trade-summary"><span>Research cost<small>{Math.round(research.duration_seconds / 60)} min · automatic completion</small></span><strong>{research.cash_cost} cr</strong></div><p className="dcl-note">2 cr reserve required. Research cannot be cancelled or refunded.</p></>}
          {!researchComplete && (researchBuilding?.level ?? 0) < research.required_building_level && <ClaimButton onClick={() => onBuild('research_office')}>{researchBuilding?.level ? 'Upgrade' : 'Build'} Research Office</ClaimButton>}
        </>}
        {contract && <>
          <BusinessMaterials resources={contract.inputs} stock={snapshot.resources} />{!completedContracts.has(contract.key) && <OrderMaterialsProgress name={contract.name} resources={contract.inputs} stock={snapshot.resources} />}
          <div className="dcl-trade-summary"><span>Reward<small>Full delivery</small></span><strong>{contract.reward} cr</strong></div>
          <p className="dcl-note">This order does not expire. Deliver all listed collected stock together. Staged cargo and unfinished goods do not count.</p>
          {contract.requires_contracts.length > 0 && <div className="dcl-business-prerequisites"><h4>Previous deliveries</h4>{contract.requires_contracts.map(key => <p key={key} data-complete={completedContracts.has(key)}>{completedContracts.has(key) ? <Check size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}{catalog.contracts.find(item => item.key === key)?.name ?? key}</p>)}</div>}
          {contract.required_research.length > 0 && <p className="dcl-note">Research: {contract.required_research.map(key => catalog.research.find(item => item.key === key)?.name ?? key).join(', ')}.</p>}
          {(tradingBuilding?.level ?? 0) < contract.tier && <ClaimButton onClick={() => onBuild('trading_post')}>{tradingBuilding?.level ? 'Upgrade' : 'Build'} Trading Post</ClaimButton>}<ClaimButton onClick={onStores}><Package size={15} aria-hidden="true" />View collected stock</ClaimButton>
        </>}
        {milestone && <><div className="dcl-trade-summary"><span>{METRIC_NAMES[milestone.metric]}<small>{milestoneState?.progress ?? 0} / {milestone.target} recorded</small></span><strong>{milestone.reward} cr</strong></div><ClaimMeter value={Math.min(milestone.target, milestoneState?.progress ?? 0)} max={milestone.target} label={`${milestone.name} recorded progress`} /></>}
        {!researchComplete && reasons.length > 0 && <ul className="dcl-blocked-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}{stale && <p className="dcl-note">Your company changed. Review the current report before confirming.</p>}{readOnly && <p className="dcl-note">Reconnect or confirm the saved action before making another office decision.</p>}{error && <p className="dcl-error" role="alert">{error}</p>}
      </> : view === 'company' ? <>
        <div className="dcl-business-company" data-dc-tutorial="office-company"><DeepClaimBusinessIcon kind="office" decorative /><div><h3>{company.name}</h3></div></div>
        <div className="dcl-business-kpis"><span><Coins size={15} aria-hidden="true" /><strong>{company.cash.toLocaleString()}</strong><small>Company credits</small></span><span><GraduationCap size={15} aria-hidden="true" /><strong>{researchCount}/{catalog.research.length}</strong><small>Research complete</small></span><span><Package size={15} aria-hidden="true" /><strong>{business.stats.completed_contracts}/{contracts.length}</strong><small>Orders delivered</small></span></div>
        {active && <ActiveResearch order={active} name={activeDefinition?.name ?? active.key} now={now} onRefresh={onRefresh} />}
        {eligible.length > 0 && <ClaimButton primary onClick={() => { changeView('records'); setRecords('milestones'); inspect('milestone', eligible[0].key); }}><ShieldCheck size={16} aria-hidden="true" />Review milestone · {eligible.length} ready</ClaimButton>}
        <div className="dcl-office-shortcuts"><ClaimButton onClick={() => changeView('research')}><GraduationCap size={16} aria-hidden="true" />Research</ClaimButton><ClaimButton onClick={() => changeView('contracts')}><Package size={16} aria-hidden="true" />Delivery orders</ClaimButton><ClaimButton onClick={onHire}><Users size={16} aria-hidden="true" />Hire staff</ClaimButton></div>
        {(Object.keys(business.research_bonuses).length > 0 || business.processing_speed_percent > 0) && <section className="dcl-business-effect"><h4>Active bonuses</h4><ResearchEffect bonuses={business.research_bonuses} processing={business.processing_speed_percent} /></section>}
        {deep && <section className="dcl-deep-frontier" aria-label="Ancient Deep progression"><header><DeepClaimBusinessIcon kind="research" decorative /><div><h4>{deep.name}</h4><small>{deep.regions[0]?.min_depth}–{deep.shaft.max_depth}m · {shaft?.level === deep.shaft.max_level ? 'Shaft ready' : `Shaft level ${deep.shaft.max_level}`}</small></div></header><p>{shaft?.level === deep.shaft.max_level ? 'Powered lift on known shaft routes. Prepare for heat with Engineering, ventilation and working shields.' : `Requires ${deep.shaft.required_research.map(key => catalog.research.find(item => item.key === key)?.name ?? key).join(', ')}. The shaft extension is a separate purchase.`}</p><div><ClaimButton className="is-small" onClick={() => onBuild('mine_shaft')}>Review mine shaft</ClaimButton><ClaimButton className="is-small" onClick={() => { changeView('research'); setBranch('deep_operations'); }}>Deep operations research</ClaimButton></div></section>}

      </> : view === 'research' ? <>
        <div className="dcl-research-overview"><div className="dcl-section-heading"><h3>Research</h3><ClaimBadge tone={researchMaxed ? 'green' : 'brass'}>{researchMaxed ? <><Check size={13} aria-hidden="true" />Maxed</> : `${researchCount}/${catalog.research.length}`}</ClaimBadge></div><ClaimMeter value={researchCount} max={catalog.research.length} valueText={`${researchCount} of ${catalog.research.length} complete`} label="Company research completed" tone="green" /></div>
        {active && <ActiveResearch order={active} name={activeDefinition?.name ?? active.key} now={now} onRefresh={onRefresh} />}
        {!researchBuilding?.level && <section className="dcl-card dcl-capacity-callout"><div><strong>Research Office required</strong></div><ClaimButton disabled={busy} onClick={() => onBuild('research_office')}>Build Research Office</ClaimButton></section>}
        <div className="dcl-research-branches" role="group" aria-label="Research branches">{DEEP_CLAIM_RESEARCH_BRANCHES.map(key => {
          const items = catalog.research.filter(item => item.branch === key), count = items.filter(item => completedResearch.has(item.key)).length;
          const maxed = items.length > 0 && count === items.length;
          return <button type="button" key={key} aria-pressed={branch === key} aria-label={`${BRANCH_NAMES[key]}: ${count} of ${items.length} complete${maxed ? ' · Maxed' : ''}`} data-complete={maxed} disabled={!items.length} onClick={() => setBranch(key)}><ResearchBranchArt branch={key} /><span>{BRANCH_NAMES[key]}</span><small>{maxed ? <><Check size={11} aria-hidden="true" />Maxed</> : `${count}/${items.length}`}</small><span className="dcl-branch-progress" aria-hidden="true"><i style={{ width: `${items.length ? count / items.length * 100 : 0}%` }} /></span></button>;
        })}</div>
        <div className="dcl-research-tree" aria-label={`${BRANCH_NAMES[branch]} research path`}>{catalog.research.filter(item => item.branch === branch).map((item, index) => {
          const complete = completedResearch.has(item.key), running = active?.key === item.key;
          const prerequisites = item.requires.filter(key => completedResearch.has(key)).length;
          const locked = prerequisites < item.requires.length || (researchBuilding?.level ?? 0) < item.required_building_level;
          return <section className="dcl-research-node" key={item.key} data-complete={complete} data-research-state={complete ? 'complete' : running ? 'active' : locked ? 'locked' : 'available'}>{index > 0 && <ArrowRight className="dcl-research-connector" size={18} aria-hidden="true" />}<header><ResearchBranchArt branch={item.branch} /><div><small className="dcl-research-tier">Tier {item.tier}</small><h4>{item.name}</h4><ClaimBadge tone={complete ? 'green' : running ? 'blue' : locked ? 'muted' : 'brass'}>{complete ? <><Check size={11} aria-hidden="true" />Complete</> : running ? 'In progress' : locked ? <><LockKeyhole size={11} aria-hidden="true" />Locked</> : 'Available'}</ClaimBadge></div></header><ResearchEffect bonuses={item.stat_bonuses} processing={item.processing_speed_percent} /><ResearchUnlocks keys={item.unlocks_recipes} snapshot={snapshot} />{!complete && <div className="dcl-research-cost"><span><Coins size={12} aria-hidden="true" />{item.cash_cost} cr</span><span><Clock3 size={12} aria-hidden="true" />{Math.round(item.duration_seconds / 60)} min</span></div>}{!complete && item.requires.length > 0 && <div className="dcl-research-dependency"><span>Prerequisites<strong>{prerequisites}/{item.requires.length}</strong></span><ClaimMeter value={prerequisites} max={item.requires.length} label={`${item.name} prerequisites completed`} tone="green" /></div>}<ClaimButton className="is-small" onClick={() => inspect('research', item.key)} aria-label={`Review ${item.name}`}>Details<ArrowRight size={13} aria-hidden="true" /></ClaimButton></section>;
        })}</div>
      </> : view === 'contracts' ? <>
        <div className="dcl-section-heading"><div><h3>Contracts</h3></div><ClaimBadge>{business.stats.completed_contracts}/{contracts.length}</ClaimBadge></div>
        {!tradingBuilding?.level && <section className="dcl-card dcl-capacity-callout"><div><strong>Trading Post required</strong></div><ClaimButton disabled={busy} onClick={() => onBuild('trading_post')}>Build Trading Post</ClaimButton></section>}
        <div className="dcl-contract-list">{contracts.slice(currentContractPage * 4, currentContractPage * 4 + 4).map(item => <section className="dcl-card dcl-contract-card" key={item.key}><header><DeepClaimBusinessIcon kind="contract" decorative /><div><h4>{item.name}</h4><p>Tier {item.tier} · {item.reward} cr</p></div><ClaimBadge tone={completedContracts.has(item.key) ? 'green' : 'brass'}>{completedContracts.has(item.key) ? 'Delivered' : 'Order'}</ClaimBadge></header><BusinessMaterials resources={item.inputs} stock={snapshot.resources} compact />{!completedContracts.has(item.key) && <OrderMaterialsProgress name={item.name} resources={item.inputs} stock={snapshot.resources} />}<ClaimButton className="is-small" onClick={() => inspect('contract', item.key)} aria-label={`Review order ${item.name}`}>Review order<ArrowRight size={13} aria-hidden="true" /></ClaimButton></section>)}</div><OfficePagination page={currentContractPage} total={contracts.length} size={4} label="orders" onPage={setContractPage} />
      </> : <>
        <div className="dcl-segment" role="group" aria-label="Company records"><button type="button" aria-pressed={records === 'milestones'} onClick={() => setRecords('milestones')}>Milestones</button><button type="button" aria-pressed={records === 'operations'} onClick={() => { setRecords('operations'); tutorial.emit('tab_opened', { tab: 'office', view: 'operations' }); }}>Operations</button></div>
        {records === 'milestones' ? <><div className="dcl-milestone-list">{milestones.slice(currentMilestonePage * 4, currentMilestonePage * 4 + 4).map(item => { const state = business.milestones.find(value => value.key === item.key); const progress = state?.progress ?? 0; return <section className="dcl-card dcl-milestone-card" key={item.key}><header><DeepClaimBusinessIcon kind="milestone" decorative /><div><h4>{item.name}</h4><p>{item.description}</p></div><ClaimBadge tone={state?.claimed_at ? 'green' : progress >= item.target ? 'brass' : 'muted'}>{state?.claimed_at ? 'Claimed' : progress >= item.target ? 'Ready' : `${progress}/${item.target}`}</ClaimBadge></header><ClaimMeter value={Math.min(item.target, progress)} max={item.target} label={`${item.name} recorded progress`} /><ClaimButton className="is-small" onClick={() => inspect('milestone', item.key)} aria-label={`Review milestone ${item.name}`}>{state?.claimed_at ? 'View record' : `Review · ${item.reward} cr`}</ClaimButton></section>; })}</div><OfficePagination page={currentMilestonePage} total={milestones.length} size={4} label="milestones" onPage={setMilestonePage} /><Link className="dcl-button" to="/feats?goal=deep_claim_shifts">View DH Feats</Link></> : <><div className="dcl-business-stat-grid">{DEEP_CLAIM_BUSINESS_METRICS.map(key => <span key={key}><strong>{business.stats[key].toLocaleString()}{key === 'max_completed_mining_depth' ? 'm' : ''}</strong><small>{METRIC_NAMES[key]}</small></span>)}</div><p className="dcl-note">Completed work only.</p></>}
      </>}
    </div>
    {view !== 'club' && <div className="dcl-business-footer dcl-dialog-actions">{review ? <><ClaimButton disabled={busy} onClick={() => { setReview(null); setError(''); }}><ArrowLeft size={14} aria-hidden="true" />Back</ClaimButton>{researchComplete ? null : stale ? <ClaimButton primary disabled={busy} onClick={() => { setReview({ ...review, revision: snapshot.revision }); setError(''); }}>Review current report</ClaimButton> : <ClaimButton primary pending={busy} disabled={readOnly || reasons.length > 0 || !catalog || !business} onClick={() => void confirm()}>{research ? 'Start research' : contract ? 'Deliver whole order' : 'Claim company credits'}</ClaimButton>}</> : <ClaimButton onClick={onClose} disabled={busy}>Back to camp</ClaimButton>}</div>}
  </ClaimDialog>;
}

function BusinessMaterials({ resources, stock, compact = false }: { resources: DeepClaimResources; stock: DeepClaimResources; compact?: boolean }) {
  return <div className={`dcl-business-materials ${compact ? 'is-compact' : ''}`}>{Object.entries(resources).map(([key, count]) => { const held = resourceQuantity(stock, key as keyof DeepClaimResources); return <span key={key} data-short={held < (count ?? 0)}><DeepClaimResourceIcon resourceId={key as keyof DeepClaimResources} decorative /><b>{count} {RESOURCE_BY_ID[key as keyof DeepClaimResources].name}</b><small>{held} collected{held < (count ?? 0) ? ` · need ${(count ?? 0) - held} more` : ' · ready'}</small>{!compact && <ClaimMeter value={Math.min(held, count ?? 0)} max={count ?? 0} label={`${RESOURCE_BY_ID[key as keyof DeepClaimResources].name} collected for requirement`} tone={held < (count ?? 0) ? 'brass' : 'green'} />}</span>; })}</div>;
}
function ResearchEffect({ bonuses, processing }: { bonuses: NonNullable<DeepClaimSnapshot['business']>['research_bonuses']; processing: number }) {
  return <p className="dcl-research-effect">{Object.entries(bonuses).map(([key, count]) => <span key={key}>+{count} {STAT_INFO[key as keyof typeof STAT_INFO].name}</span>)}{processing > 0 && <span>−{processing}% production time</span>}</p>;
}
function ResearchUnlocks({ keys, snapshot }: { keys: readonly string[]; snapshot: DeepClaimSnapshot }) {
  if (!keys.length) return null;
  return <div className="dcl-research-unlocks" aria-label="Recipe unlocks"><small>Unlocks</small>{keys.map(key => {
    const recipe = snapshot.recipes?.find(item => item.key === key) ?? snapshot.business_catalog?.recipes.find(item => item.key === key);
    const resource = Object.keys(recipe?.outputs ?? {})[0] as keyof DeepClaimResources | undefined;
    return <span key={key}>{recipe?.equipment_output ? <DeepClaimEquipmentIcon archetype={recipe.equipment_output} decorative /> : resource ? <DeepClaimResourceIcon resourceId={resource} decorative /> : <Package size={18} aria-hidden="true" />}<span>{recipe?.name ?? key}</span></span>;
  })}</div>;
}
/** Only visualizes the frozen server schedule. A filled gauge never completes research. */
function ActiveResearch({ order, name, now, onRefresh }: { order: NonNullable<DeepClaimSnapshot['business']>['research'][number]; name: string; now: number; onRefresh: () => void }) {
  const start = Date.parse(order.started_at), end = Date.parse(order.completes_at);
  const valid = Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(now) && end > start;
  const due = valid && now >= end;
  const percent = valid ? Math.max(0, Math.min(100, 100 * (now - start) / (end - start))) : 0;
  return <section className="dcl-card dcl-active-research" data-research-phase={!valid ? 'sync' : due ? 'awaiting-report' : 'working'}>
    <header><span className="dcl-research-active-art"><DeepClaimBusinessIcon kind="research" decorative /></span><div><small className="dcl-eyebrow">RESEARCH IN PROGRESS</small><strong>{name}</strong><small>{!valid ? 'Refresh to check the research schedule' : due ? 'Awaiting completion report' : `Completes in ${claimTimeLeft(order.completes_at, now)}`}</small></div><ClaimBadge tone="blue">Researching</ClaimBadge></header>
    <div className="dcl-research-gauge"><div><span>{due ? 'Work window elapsed' : 'Elapsed work'}</span><strong>{Math.floor(percent)}<small>%</small></strong></div><ClaimMeter value={percent} max={100} label="Research elapsed time" tone="blue" /><div className="dcl-research-stages" aria-hidden="true"><span data-reached={percent >= 0}>0%</span><span data-reached={percent >= 33}>33%</span><span data-reached={percent >= 67}>67%</span><span data-reached={percent >= 100}>100%</span></div></div>
    {(due || !valid) && <ClaimButton className="is-small" onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />Check research completion</ClaimButton>}
  </section>;
}
function ResearchBranchArt({ branch }: { branch: DeepClaimResearchBranch }) {
  const equipment: Partial<Record<DeepClaimResearchBranch, string>> = { excavation: 'iron_pickaxe', geology: 'survey_kit', logistics: 'hauler_frame', safety: 'iron_helmet', deep_operations: 'nickel_heatshield' };
  return <span className="dcl-branch-art" aria-hidden="true">{branch === 'processing' ? <DeepClaimResourceIcon resourceId="iron_bar" decorative /> : branch === 'workforce' ? <DeepClaimBusinessIcon kind="office" decorative /> : <DeepClaimEquipmentIcon archetype={equipment[branch] ?? 'survey_kit'} decorative />}</span>;
}
function OrderMaterialsProgress({ name, resources, stock }: { name: string; resources: DeepClaimResources; stock: DeepClaimResources }) {
  const target = Object.values(resources).reduce((total, count) => total + (count ?? 0), 0);
  const held = Object.entries(resources).reduce((total, [key, count]) => total + Math.min(count ?? 0, resourceQuantity(stock, key as keyof DeepClaimResources)), 0);
  return <div className="dcl-order-progress"><div><span>Materials assembled</span><strong>{held}/{target}</strong></div><ClaimMeter value={held} max={target} label={`${name} materials assembled`} tone={held >= target ? 'green' : 'brass'} /></div>;
}
function OfficePagination({ page, total, size, label, onPage }: { page: number; total: number; size: number; label: string; onPage: (page: number) => void }) {
  if (total <= size) return null;
  return <div className="dcl-field-pagination" role="group" aria-label={`${label} pages`}><ClaimButton className="is-small" aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</ClaimButton><span aria-live="polite">{page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}</span><ClaimButton className="is-small" aria-label={`Next ${label} page`} disabled={(page + 1) * size >= total} onClick={() => onPage(page + 1)}>Next</ClaimButton></div>;
}
