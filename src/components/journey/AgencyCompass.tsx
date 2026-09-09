import { Compass } from 'lucide-react';
import { dominantJourneyPath, journeyPathScores } from '@/lib/journey/agency';
import type { RunState } from '@/lib/journey/types';

export function AgencyCompass({ state, compact = false }: { state: RunState; compact?: boolean }) {
  const paths = journeyPathScores(state);
  const dominant = dominantJourneyPath(state);
  const ceiling = Math.max(4, ...paths.map((path) => path.score));

  if (compact) {
    return dominant ? (
      <span className="jy-chip jy-chip-agency" title={dominant.description}>
        <Compass className="h-3 w-3" aria-hidden /> {dominant.title}
      </span>
    ) : null;
  }

  return (
    <section className="jy-panel jy-agency-compass mt-4 p-4" aria-label="Theron's role-playing path">
      <header className="flex items-start gap-3">
        <span className="jy-agency-seal" aria-hidden><Compass /></span>
        <div>
          <div className="jy-eyebrow">Role-playing identity</div>
          <h2 className="jy-display mt-0.5 text-lg">{dominant?.title ?? 'A path not yet chosen'}</h2>
          <p className="jy-muted mt-1 text-xs">
            {dominant?.description ?? 'Your major decisions will define what kind of hero Theron becomes.'}
          </p>
        </div>
      </header>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {paths.map((path) => (
          <div key={path.key} className="jy-agency-track">
            <div><span>{path.label}</span><strong>{path.score}</strong></div>
            <span className="jy-agency-track-bar" aria-hidden>
              <i style={{ width: `${Math.min(100, (path.score / ceiling) * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
      <p className="jy-muted mt-3 text-[0.6875rem]">
        These paths unlock reactions and approaches; they do not label choices as good or evil.
      </p>
    </section>
  );
}
