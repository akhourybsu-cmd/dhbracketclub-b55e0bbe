import { MapPin, RefreshCw, Thermometer, TramFront, Users } from 'lucide-react';
import { projectCrewPresentation } from '@/lib/deepClaim/crewPresentation';
import { RESOURCE_BY_ID } from '@/lib/deepClaim/catalog';
import type { DeepClaimExpedition, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { ClaimBadge, ClaimButton, ClaimMeter } from './DeepClaimPrimitives';
import { claimTimeLeft } from './display';
import { OPERATION_STEPS, operationCardModel } from './operationCard';
import { DeepClaimPortrait, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import './deepClaimExpeditionCard.css';

export function DeepClaimExpeditionCard({ job, snapshot, now, onRefresh, onCollect, onFollow, followed = false }: {
  job: DeepClaimExpedition; snapshot: DeepClaimSnapshot; now: number;
  onRefresh: () => void; onCollect: () => void; onFollow: (job: DeepClaimExpedition) => void;
  followed?: boolean;
}) {
  const state = operationCardModel(snapshot, job, now), source = state.source;
  const deep = source?.deep_modifiers;
  const modifiers = deep && (deep.lift_discount_percent > 0 || deep.thermal_load_percent > 0);
  const crewNames = state.crew.map(worker => worker.name).join(', ');
  const shortNames = state.crew.map(worker => worker.name.trim().split(/\s+/)[0]).join(' · ');
  const allStepsDone = source?.status === 'ready' || source?.status === 'collected';
  const followLabel = source?.status === 'active' ? 'Follow crew' : 'View worksite';
  const crewNumber = source?.status === 'active' ? projectCrewPresentation(snapshot, now).crews.find(crew => crew.job_id === source.id)?.number : null;
  return <article className="dcl-expedition-card dcl-operation-card"
    data-dc-tutorial={source?.status === 'ready' ? 'jobs-ready' : source?.status === 'active' ? 'jobs-active' : undefined}
    data-dc-expedition={source?.id} data-dc-crew-number={crewNumber ?? undefined} data-dc-followed={followed && source?.status === 'active' || undefined} aria-current={followed && source?.status === 'active' ? 'true' : undefined} data-operation-state={source?.status ?? 'unavailable'} data-dc-operation-stage={source?.stage}>
    <header><strong>{state.title}</strong>{crewNumber && <ClaimBadge tone="brass">Crew {crewNumber}</ClaimBadge>}{modifiers && <small className="dcl-expedition-deep" aria-label={`Lift ${deep.lift_discount_percent} percent, heat penalty ${deep.heat_penalty_percent} percent`}><TramFront size={10} aria-hidden="true" />{deep.lift_discount_percent}%<Thermometer size={10} aria-hidden="true" />{deep.heat_penalty_percent}%</small>}<ClaimBadge tone={state.ready ? 'green' : state.canCheckReturn ? 'brass' : 'blue'}>{state.status}</ClaimBadge></header>
    <div className="dcl-operation-crewline">
      <div className="dcl-operation-portraits" role="group" aria-label={crewNames ? `Assigned crew: ${crewNames}` : 'Assigned crew'}>
        {state.crew.map(worker => <DeepClaimPortrait key={worker.id} worker={worker} />)}
        {!state.crew.length && <Users size={22} aria-hidden="true" />}
      </div>
      <div className="dcl-operation-site"><strong title={crewNames || undefined}>{shortNames || `${state.crewCount} ${state.crewCount === 1 ? 'worker' : 'workers'}`}</strong><small>{state.material && <DeepClaimResourceIcon resourceId={state.material} decorative />}<span>{state.material ? RESOURCE_BY_ID[state.material].name : source?.mode === 'explore' ? 'Frontier' : 'Worksite'}{source ? ` · ${source.target.y}m` : ''}</span></small></div>
      <span className="dcl-operation-clock">{state.ready ? `${state.units.toLocaleString()} units staged` : source?.status === 'collected' ? 'Collected' : source ? claimTimeLeft(source.completes_at, now) : 'Sync needed'}</span>
    </div>
    <ol className="dcl-operation-route" aria-label="Expedition stages">{OPERATION_STEPS.map((step, index) => <li key={step.key} data-dc-stage={step.key} data-complete={allStepsDone || index < state.stageIndex || undefined} aria-current={!allStepsDone && index === state.stageIndex ? 'step' : undefined}><i aria-hidden="true" /><span>{step.label}</span></li>)}</ol>
    <ClaimMeter value={state.fraction} max={100} label="Expedition elapsed time" valueText={state.ready ? 'Returned; cargo awaits collection' : state.canCheckReturn ? 'Elapsed time only; awaiting a confirmed return report' : `${Math.round(state.fraction)} percent elapsed`} tone={state.ready ? 'green' : 'blue'} />
    <div className={`dcl-operation-actions${state.ready || state.canCheckReturn ? ' has-return' : ''}`}>
      {state.ready ? <ClaimButton className="is-small" primary onClick={onCollect}>Open haul</ClaimButton> : state.canCheckReturn ? <ClaimButton className="is-small" onClick={onRefresh}><RefreshCw size={13} aria-hidden="true" />Check return</ClaimButton> : null}
      <ClaimButton className="is-small dcl-operation-follow" disabled={!source} onClick={() => { if (source) onFollow(source); }}><MapPin size={14} aria-hidden="true" />{followLabel}</ClaimButton>
    </div>
  </article>;
}
