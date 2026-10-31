import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CommissionerWorkspaceData } from '@/lib/draft/commissioner';
import type { CommissionerReviewIntent } from './CommissionerReview';

export function CommissionerSeasonRules({ data, busy, review }: { data: CommissionerWorkspaceData; busy: boolean; review: (intent: CommissionerReviewIntent) => void }) {
  const [subtitle, setSubtitle] = useState(data.season.subtitle ?? '');
  const [target, setTarget] = useState(String(data.season.regular_season_drafts || data.season.regular_season_weeks || 12));
  const [bestOf, setBestOf] = useState(String(data.season.best_of || 10));
  const entered = data.entries.filter(entry => !entry.is_playoff).length;
  const locked = data.season.status !== 'regular_season' || Boolean(data.season.archived_at);
  const valid = Number.isInteger(Number(target)) && Number(target) >= Math.max(1,entered) && Number(target) <= 50 && Number.isInteger(Number(bestOf)) && Number(bestOf) >= 1 && Number(bestOf) <= Number(target);
  return <section className="da-commissioner-card" aria-label="Season rules">
    <h4>Season format</h4><p>Adjust the existing regular-draft target and best-of count before playoffs. The target cannot drop below {entered} linked regular drafts.</p>
    {locked && <p className="da-commissioner-warning">Season format is locked after regular play.</p>}
    <label className="da-commissioner-field">Season subtitle<Input maxLength={60} disabled={busy || locked} value={subtitle} onChange={event => setSubtitle(event.target.value)} /></label>
    <div className="da-commissioner-rule-fields"><label className="da-commissioner-field">Regular draft target<Input type="number" inputMode="numeric" min={Math.max(1,entered)} max={50} disabled={busy || locked} value={target} onChange={event => setTarget(event.target.value)} /></label><label className="da-commissioner-field">Best-of results<Input type="number" inputMode="numeric" min={1} max={Number(target) || 50} disabled={busy || locked} value={bestOf} onChange={event => setBestOf(event.target.value)} /></label></div>
    <Button variant="outline" disabled={busy || locked || !valid} onClick={() => review({ title: 'Update season format', description: 'Updates the saved season format and rebuilds the standings from existing reports. Placement scoring and draft ratings remain the same. These settings lock when playoffs begin.', confirmLabel: 'Confirm season format', action: 'update_season', payload: { subtitle: subtitle.trim(), regular_season_drafts: Number(target), best_of: Number(bestOf) }, detail: <div className="da-commissioner-rule"><p>Regular target: {data.season.regular_season_drafts || data.season.regular_season_weeks} → {target}</p><p>Best-of results: {data.season.best_of} → {bestOf}</p><p>Subtitle: {subtitle.trim() || 'None'}</p></div> })}>Review season format</Button>
  </section>;
}
