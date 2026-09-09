import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Dices,
  Gauge,
  Lock,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  encounterFocus,
  encounterOutcomeLabel,
  encounterProgress,
  encounterProgressPercent,
  encounterRound,
  latestEncounterRoll,
  statLabel,
} from '@/lib/journey/adventure';
import type { RunState, RuntimeEncounterPayload } from '@/lib/journey/types';

interface Props {
  encounter: RuntimeEncounterPayload;
  state: RunState;
  busy: boolean;
  onAction: (actionKey: string) => void;
}

const kindLabels: Record<RuntimeEncounterPayload['definition']['kind'], string> = {
  hazard: 'Field challenge',
  investigation: 'Investigation',
  social: 'Social encounter',
  combat: 'Danger encounter',
  ritual: 'Edenite working',
};

const riskLabels = {
  measured: 'Measured',
  bold: 'Bold',
  desperate: 'Desperate',
};

export function AdventureEncounter({ encounter, state, busy, onAction }: Props) {
  const { definition, resolved, outcome } = encounter;
  const progress = encounterProgress(encounter);
  const progressPct = encounterProgressPercent(encounter);
  const focus = encounterFocus(encounter);
  const round = encounterRound(encounter);
  const lastRoll = latestEncounterRoll(encounter);
  const outcomeText = outcome === 'victory' ? definition.success_text : definition.failure_text;

  return (
    <section className={`jy-encounter ${resolved ? `jy-encounter-${outcome}` : ''}`} aria-label={definition.title}>
      <header className="jy-encounter-header">
        <div className="min-w-0">
          <div className="jy-eyebrow flex items-center gap-1.5">
            <Dices className="h-3.5 w-3.5" aria-hidden />
            {kindLabels[definition.kind]}
          </div>
          <h2 className="jy-display mt-1 text-2xl">{definition.title}</h2>
          <p className="jy-secondary mt-1 text-sm">{definition.objective}</p>
        </div>
        <div className={`jy-encounter-seal ${resolved ? 'is-resolved' : ''}`} aria-hidden>
          {resolved ? <CheckCircle2 /> : <Target />}
        </div>
      </header>

      <div className="jy-encounter-meters" aria-label="Challenge status">
        <div className="jy-encounter-meter jy-encounter-meter-wide">
          <div className="flex items-center justify-between gap-3">
            <span><Target className="h-3.5 w-3.5" aria-hidden /> Progress</span>
            <strong>{Math.min(progress, definition.target_progress)}/{definition.target_progress}</strong>
          </div>
          <div className="jy-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={definition.target_progress} aria-valuenow={Math.min(progress, definition.target_progress)}>
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="jy-encounter-meter">
          <span><Gauge className="h-3.5 w-3.5" aria-hidden /> Danger</span>
          <strong>{round}/{definition.max_rounds}</strong>
        </div>
        <div className="jy-encounter-meter">
          <span><Brain className="h-3.5 w-3.5" aria-hidden /> Focus</span>
          <strong>{focus}/{definition.max_focus}</strong>
        </div>
      </div>

      {lastRoll && (
        <div className={`jy-roll-result jy-roll-${lastRoll.result}`} role="status" aria-live="polite">
          <div className="jy-roll-die" aria-label={`Rolled ${lastRoll.die}`}>{lastRoll.die}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <strong>{lastRoll.action_label}</strong>
              <span className="jy-eyebrow">{lastRoll.total} vs {lastRoll.difficulty}</span>
            </div>
            <p className="jy-muted mt-0.5 text-xs">
              d20 {lastRoll.die} + {statLabel(lastRoll.stat)} {lastRoll.stat_score}
              {lastRoll.bonus ? ` + ${lastRoll.bonus}` : ''}
              {' · '}{lastRoll.result === 'success' ? 'Clean success' : lastRoll.result === 'costly' ? 'Progress with a cost' : 'Setback'}
              {lastRoll.damage > 0 ? ` · ${lastRoll.damage} strain` : ''}
            </p>
          </div>
        </div>
      )}

      {resolved ? (
        <div className="jy-encounter-resolution jy-fade-in">
          {outcome === 'victory' ? <Sparkles className="h-5 w-5" aria-hidden /> : <AlertTriangle className="h-5 w-5" aria-hidden />}
          <div>
            <div className="jy-eyebrow">{encounterOutcomeLabel(outcome)}</div>
            {outcomeText && <p className="jy-prose mt-1 text-sm">{outcomeText}</p>}
            <p className="jy-muted mt-1 text-xs">Your result has been written into this journey.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="jy-encounter-stakes">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            <span>{definition.stakes}</span>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="jy-eyebrow">Choose your approach</div>
            {definition.actions.map((action) => {
              const statScore = Number(state.stats?.[action.stat] ?? 0);
              const lacksFocus = action.focus_cost > focus;
              const unavailable = action.available === false;
              return (
                <button
                  key={action.action_key}
                  type="button"
                  className={`jy-action jy-action-${action.risk}`}
                  disabled={busy || lacksFocus || unavailable}
                  aria-disabled={lacksFocus || unavailable}
                  onClick={() => onAction(action.action_key)}
                >
                  <span className="jy-action-icon" aria-hidden>
                    {unavailable ? <Lock /> : action.risk === 'desperate' ? <ShieldAlert /> : action.risk === 'bold' ? <Dices /> : <Target />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <strong>{action.label}</strong>
                      <span className="jy-action-check">{statLabel(action.stat)} +{statScore} · TN {action.difficulty}</span>
                    </span>
                    <span className="jy-muted mt-0.5 block text-xs leading-relaxed">{action.description}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className="jy-chip">{riskLabels[action.risk]}</span>
                      {action.focus_cost > 0 && <span className="jy-chip jy-chip-gold">{action.focus_cost} Focus</span>}
                      {lacksFocus && <span className="jy-chip jy-chip-blood">Not enough focus</span>}
                      {unavailable && action.locked_hint && <span className="jy-chip jy-chip-blood">{action.locked_hint}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
