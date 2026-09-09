import { ArrowRight, Compass, ScrollText, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { JourneyDecisionImpact } from '@/lib/journey/types';

export function DecisionImpact({
  impact,
  onDismiss,
}: {
  impact: JourneyDecisionImpact;
  onDismiss: () => void;
}) {
  return (
    <aside className="jy-decision-impact jy-fade-in" aria-label="Decision consequences">
      <div className="jy-decision-impact-icon" aria-hidden><Compass /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="jy-eyebrow">The journey remembers</div>
            <p className="jy-secondary mt-1 text-sm">{impact.outcome_text ?? impact.choice_text}</p>
          </div>
          <button type="button" className="jy-icon-button" onClick={onDismiss} aria-label="Dismiss decision summary">
            <X aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {impact.path_label && <span className="jy-chip jy-chip-gold">{impact.path_label} path +1</span>}
          {impact.impact.map((item) => <span key={item} className="jy-chip">{item}</span>)}
        </div>
        <Link to="/journey/journal" className="jy-decision-impact-link">
          <ScrollText aria-hidden /> Review your decisions <ArrowRight aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
