import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Compass, GitBranch, Lock } from 'lucide-react';
import type { RuntimeChoice } from '@/lib/journey/types';

/**
 * Choice presentation. Hidden choices are already filtered out server-side;
 * locked choices stay visible with an authored hint so progression reads
 * clearly. Style only affects presentation — never implied morality.
 */
export function ChoiceList({
  choices, busy, onChoose,
}: { choices: RuntimeChoice[]; busy: boolean; onChoose: (key: string) => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (choices.length === 0) return null;

  return (
    <section aria-label="Available choices" className="mt-8 space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="jy-eyebrow">What does Theron do?</h2>
        <span className="jy-muted text-[0.6875rem]">Choices shape identity and future options</span>
      </div>
      {choices.map((choice, i) => {
        const { available, locked_hint: lockedLabel } = choice;
        const styleClass =
          choice.major_decision ? 'jy-choice-major'
          : choice.choice_style === 'skill' ? 'jy-choice-skill'
          : choice.choice_style === 'secret' ? 'jy-choice-secret' : '';
        const needsConfirm = choice.confirmation_required && confirming !== choice.choice_key;

        return (
          <button
            key={choice.choice_key}
            type="button"
            className={`jy-choice jy-choice-in ${styleClass}`}
            style={{ '--jy-i': i } as CSSProperties}
            disabled={!available || busy}
            aria-disabled={!available}
            onClick={() => {
              if (!available || busy) return;
              if (needsConfirm) { setConfirming(choice.choice_key); return; }
              setConfirming(null);
              onChoose(choice.choice_key);
            }}
          >
            <span className="flex items-start gap-2">
              {!available && <Lock className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span className="min-w-0">
                {choice.intent && (
                  <span className="jy-choice-intent"><Compass aria-hidden /> {choice.intent} approach</span>
                )}
                <span className="block">{choice.choice_text}</span>
                {choice.description && (
                  <span className="jy-muted mt-0.5 block text-[0.8125rem] italic">{choice.description}</span>
                )}
                {!available && lockedLabel && (
                  <span className="jy-chip mt-1.5 inline-flex">{lockedLabel}</span>
                )}
                {(choice.impact_preview?.length ?? 0) > 0 && (
                  <span className="jy-choice-impact">
                    <GitBranch aria-hidden />
                    <span>{choice.impact_preview?.join(' · ')}</span>
                  </span>
                )}
                {available && confirming === choice.choice_key && (
                  <span className="jy-chip jy-chip-blood mt-1.5 inline-flex">Tap again to confirm</span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
