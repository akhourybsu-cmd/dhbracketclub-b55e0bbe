import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Clock3, Coins, FileText, Flag, LockKeyhole, Pin } from 'lucide-react';
import { companyGoals, evaluateCompanyGoal, goalRefId, type CompanyGoal, type CompanyGoalRef, type CompanyGoalRequirement } from '@/lib/deepClaim/companyGoals';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimBuildingPortrait } from './renderer/DeepClaimBuildingPortrait';
import { DeepClaimBusinessIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter } from './DeepClaimPrimitives';
import './companyGoals.css';

const CATEGORIES = [
  { kind: 'building', label: 'Buildings' }, { kind: 'research', label: 'Research' },
  { kind: 'contract', label: 'Contracts' }, { kind: 'milestone', label: 'Milestones' },
] as const;
const STATE_LABELS: Record<CompanyGoal['state'], string> = { complete: 'Complete', working: 'Researching', ready: 'Ready to review', locked: 'Locked', saving: 'In progress' };

function GoalArt({ goal }: { goal: CompanyGoal }) {
  return <span className="dcl-goal-art" aria-hidden="true">{goal.ref.kind === 'building'
    ? <DeepClaimBuildingPortrait buildingId={goal.ref.key} level={goal.ref.level} decorative />
    : <DeepClaimBusinessIcon kind={goal.ref.kind} decorative />}</span>;
}

function GoalProgress({ goal, compact = false }: { goal: CompanyGoal; compact?: boolean }) {
  const total = goal.requirements.length;
  const met = goal.state === 'complete' ? total : goal.requirements.filter(item => item.current >= item.target).length;
  const valueText = goal.state === 'complete' ? 'Complete' : goal.state === 'working' ? 'Waiting for confirmed research completion' : `${met} of ${total} requirements ready`;
  return <div className={`dcl-goal-progress${compact ? ' is-compact' : ''}`}>
    <ClaimMeter value={goal.state === 'complete' ? 1 : goal.progress} max={1} label={`${goal.name} goal progress`} valueText={valueText} tone={goal.state === 'complete' || goal.state === 'ready' ? 'green' : goal.state === 'working' ? 'blue' : 'brass'} />
    {!compact && <small>{goal.state === 'working' ? 'Awaiting completion report' : goal.state === 'complete' ? 'Complete' : `${met}/${total} ready`}</small>}
  </div>;
}

/** A plan is a navigation preference. These controls cannot purchase or award. */
export function DeepClaimGoalDock({ goal, onOpen, onReview, onReport }: { goal: CompanyGoal | null; onOpen: () => void; onReview: () => void; onReport?: () => void }) {
  const description = useId();
  return <section className={`dcl-goal-dock${goal ? ` is-${goal.state} has-review` : ''}${onReport ? ' has-report' : ''}`} aria-label="Company goal">
    <button type="button" className="dcl-goal-open" aria-label={goal ? 'Open company goals' : 'Choose company goal'} aria-describedby={description} onClick={onOpen}>
      {goal ? <GoalArt goal={goal} /> : <span className="dcl-goal-empty-art" aria-hidden="true"><Flag size={22} /></span>}
      <span className="dcl-goal-dock-copy"><small>Company goal</small><strong id={description}>{goal?.name ?? 'Choose a project'}</strong>{goal && <><GoalProgress goal={goal} compact /><span>{STATE_LABELS[goal.state]}</span></>}</span>
    </button>
    {goal && <button type="button" className="dcl-goal-review" aria-label="Review pinned goal" onClick={onReview}>{goal.state === 'complete' ? <CheckCheck size={20} aria-hidden="true" /> : <ArrowRight size={20} aria-hidden="true" />}</button>}
    {onReport && <button type="button" className="dcl-goal-review dcl-goal-report" aria-label="Open shift report" onClick={onReport}><FileText size={19} aria-hidden="true" /></button>}
  </section>;
}

function GoalRequirement({ requirement }: { requirement: CompanyGoalRequirement }) {
  const complete = requirement.current >= requirement.target;
  return <li className="dcl-goal-requirement" data-complete={complete}>
    <span className="dcl-goal-requirement-icon" aria-hidden="true">{requirement.resourceId ? <DeepClaimResourceIcon resourceId={requirement.resourceId} decorative /> : requirement.kind === 'cash' ? <Coins size={17} /> : complete ? <Check size={17} /> : <LockKeyhole size={15} />}</span>
    <span><strong>{requirement.label}</strong><small>{Math.min(requirement.current, requirement.target).toLocaleString()} / {requirement.target.toLocaleString()}</small></span>
    {complete && <Check size={15} aria-label="Ready" />}
  </li>;
}

export function DeepClaimGoalPlanner({ snapshot, selected, onPin, onReview, onClose }: {
  snapshot: DeepClaimSnapshot; selected: CompanyGoalRef | null; onPin: (goal: CompanyGoalRef) => void;
  onReview: (goal: CompanyGoalRef) => void; onClose: () => void;
}) {
  const goals = useMemo(() => companyGoals(snapshot), [snapshot]);
  const [category, setCategory] = useState<CompanyGoalRef['kind']>(selected?.kind ?? 'building');
  const [page, setPage] = useState(0);
  const [inspectedRef, setInspectedRef] = useState<CompanyGoalRef | null>(selected);
  const inspected = inspectedRef ? evaluateCompanyGoal(snapshot, inspectedRef) : null;
  const selectedId = selected ? goalRefId(selected) : null;
  const [lastCard, setLastCard] = useState<string | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const previousInspect = useRef<string | null>(null);
  const identity = inspected?.id ?? null;
  useLayoutEffect(() => {
    const body = content.current?.closest('.dcl-dialog-scroll-body');
    if (body) body.scrollTop = 0;
    if (identity) detailHeading.current?.focus({ preventScroll: true });
    else if (previousInspect.current && lastCard) [...(content.current?.querySelectorAll<HTMLButtonElement>('[data-dc-goal-id]') ?? [])].find(button => button.dataset.dcGoalId === lastCard)?.focus({ preventScroll: true });
    previousInspect.current = identity;
  }, [identity, category, lastCard]);
  const filtered = goals.filter(goal => goal.ref.kind === category);
  const pages = Math.max(1, Math.ceil(filtered.length / 4));
  const currentPage = Math.min(page, pages - 1);
  const current = filtered.slice(currentPage * 4, currentPage * 4 + 4);
  function back() { if (inspected) setInspectedRef(null); else onClose(); }
  return <ClaimDialog open title="Company goals" onClose={onClose} className="dcl-goal-planner" footer={<div className="dcl-dialog-actions"><ClaimButton onClick={back}>{inspected ? 'Back to goals' : 'Back to camp'}</ClaimButton>{inspected && <ClaimButton primary disabled={selectedId === inspected.id || inspected.state === 'complete'} onClick={() => onPin(inspected.ref)}><Pin size={15} aria-hidden="true" />{selectedId === inspected.id ? 'Pinned' : 'Pin goal'}</ClaimButton>}</div>}>
    <div ref={content} className="dcl-goal-planner-body">
      <div className="dcl-goal-categories" role="group" aria-label="Goal categories">{CATEGORIES.map(item => <button type="button" key={item.kind} aria-label={item.label} aria-pressed={category === item.kind} onClick={() => { setCategory(item.kind); setPage(0); setInspectedRef(null); }}><span aria-hidden="true">{item.kind === 'building' ? <Flag size={18} /> : <DeepClaimBusinessIcon kind={item.kind} decorative />}</span><strong>{item.label}</strong><small>{goals.filter(goal => goal.ref.kind === item.kind).length}</small></button>)}</div>
      {inspected ? <section className={`dcl-goal-inspector is-${inspected.state}`} data-dc-goal-detail={inspected.id}>
        <div className="dcl-goal-hero"><GoalArt goal={inspected} /><div><ClaimBadge tone={inspected.state === 'complete' || inspected.state === 'ready' ? 'green' : inspected.state === 'working' ? 'blue' : 'brass'}>{STATE_LABELS[inspected.state]}</ClaimBadge><h3 ref={detailHeading} tabIndex={-1}>{inspected.name}</h3>{inspected.detail && <p>{inspected.detail}</p>}</div></div>
        <GoalProgress goal={inspected} />
        <ul className="dcl-goal-requirements" aria-label="Goal requirements">{inspected.requirements.map(requirement => <GoalRequirement key={requirement.key} requirement={requirement} />)}</ul>
        {inspected.completesAt && inspected.state === 'working' && <p className="dcl-goal-clock"><Clock3 size={14} aria-hidden="true" />Completes {new Date(inspected.completesAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}
        {inspected.state === 'locked' && !!inspected.blockers.length && <p className="dcl-goal-blockers">{inspected.blockers[0]}</p>}
        {inspected.reward != null && <div className="dcl-goal-award"><Coins size={16} aria-hidden="true" /><strong>{inspected.reward.toLocaleString()} cr</strong><span>{inspected.ref.kind === 'contract' ? 'Delivery payout' : 'Milestone award'}</span></div>}
        <ClaimButton onClick={() => onReview(inspected.ref)}>Review goal<ArrowRight size={15} aria-hidden="true" /></ClaimButton>
      </section> : <>
        <div className="dcl-goal-grid" aria-label={`${CATEGORIES.find(item => item.kind === category)?.label} goals`}>{current.map(goal => <button type="button" className={`dcl-goal-card is-${goal.state}`} data-dc-goal-id={goal.id} key={goal.id} aria-label={`Plan ${goal.name}`} aria-pressed={selectedId === goal.id} onClick={() => { setLastCard(goal.id); setInspectedRef(goal.ref); }}><GoalArt goal={goal} /><span><strong>{goal.name}</strong><small>{STATE_LABELS[goal.state]}</small><GoalProgress goal={goal} compact /></span>{selectedId === goal.id && <Pin className="dcl-goal-card-pin" size={13} aria-hidden="true" />}</button>)}</div>
        {!filtered.length && <p className="dcl-note">{category === 'building' ? 'All buildings are maxed.' : 'No goals available.'}</p>}
        {pages > 1 && <div className="dcl-goal-pages" role="group" aria-label="Goal pages"><ClaimButton className="is-small" aria-label="Previous goal page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={16} aria-hidden="true" /></ClaimButton><span aria-live="polite">{currentPage + 1} / {pages}</span><ClaimButton className="is-small" aria-label="Next goal page" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ArrowRight size={16} aria-hidden="true" /></ClaimButton></div>}
      </>}
    </div>
  </ClaimDialog>;
}
