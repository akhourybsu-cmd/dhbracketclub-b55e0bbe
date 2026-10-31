import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Layers3, MinusCircle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { COMMISSIONER_TIEBREAKERS, previewPointAdjustment, previewSeasonRemoval, type CommissionerPointRow, type CommissionerWorkspaceData } from '@/lib/draft/commissioner';
import type { CommissionerReviewIntent } from './CommissionerReview';

export function CommissionerPoints({ data, points, busy, initialDraftId, review }: {
  data: CommissionerWorkspaceData;
  points: CommissionerPointRow[];
  busy: boolean;
  initialDraftId?: string | null;
  review: (intent: CommissionerReviewIntent) => void;
}) {
  const [mode, setMode] = useState<'explorer' | 'adjustments' | 'entries'>(initialDraftId ? 'entries' : 'explorer');
  const [selected, setSelected] = useState(points[0]?.userId ?? '');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [draftId, setDraftId] = useState(initialDraftId ?? '');
  const [removalReason, setRemovalReason] = useState('');
  const player = points.find(row => row.userId === selected) ?? points[0];
  const readOnly = data.season.status === 'complete' || Boolean(data.season.archived_at);
  const regular = data.entries.filter(entry => !entry.is_playoff).map(entry => ({ entry, draft: data.drafts.find(draft => draft.id === entry.draft_id) })).filter(row => row.draft);
  const validDelta = Number.isInteger(Number(delta)) && Number(delta) !== 0 && Math.abs(Number(delta)) <= 100;
  const validReason = reason.trim().length >= 3;
  const validRemoval = regular.some(row => row.draft!.id === draftId);
  const mismatches = points.filter(row => row.pointsDelta !== null && row.pointsDelta !== 0);
  const name = (userId: string) => data.profiles.find(profile => profile.id === userId)?.display_name ?? 'Season member';

  function adjustmentPreview() {
    if (!player || !validDelta || !validReason) return;
    const impact = previewPointAdjustment(data, player.userId, Number(delta));
    if (!impact) return;
    review({ title: 'Point adjustment', description: 'Adds a signed season-points ledger entry. Original draft ratings and DH awards stay intact. The server recalculates the season projection.', confirmLabel: 'Confirm adjustment', action: 'add_adjustment', payload: { user_id: player.userId, delta: Number(delta) }, reason, impact: [impact], detail: <p>{player.displayName} · {Number(delta) > 0 ? '+' : ''}{Number(delta)} season points{player.draftsPlayed === 0 ? '. The ledger applies once this player has a counted result.' : ''}</p> });
  }
  return <section className="da-commissioner-points" aria-label="Season points explorer">
    <div className="da-commissioner-subnav" aria-label="Points views">
      {(['explorer', 'adjustments', 'entries'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'explorer' ? 'Explorer' : value === 'adjustments' ? 'Adjustments' : 'Draft entries'}</button>)}
    </div>
    {mode === 'explorer' && <>
      <div className="da-commissioner-section-heading"><div><h3>Every point, explained</h3><p>Placement points from the best {data.season.best_of || 10} eligible regular drafts, plus the active ledger.</p></div><Layers3 size={22} aria-hidden="true" /></div>
      <label className="da-commissioner-field">Points member<select value={player?.userId ?? ''} onChange={event => setSelected(event.target.value)} disabled={!points.length}>{!points.length && <option value="">No season players yet</option>}{points.map(row => <option key={row.userId} value={row.userId}>{row.displayName}</option>)}</select></label>
      {player && <>
        <div className="da-commissioner-metrics"><article><span>Saved total</span><strong>{player.persistedPoints ?? '—'}</strong></article><article><span>From reports</span><strong>{player.basePoints}</strong></article><article><span>Active ledger</span><strong>{player.adjustmentPoints > 0 ? '+' : ''}{player.adjustmentPoints}</strong></article><article><span>Calculated total</span><strong>{player.projectedPoints}</strong></article></div>
        <div className="da-commissioner-rule"><b>Rank {player.rank ?? '—'} · Seed {player.playoffSeed ?? '—'}</b><p>{player.countsTowardBestOf}/{player.bestOf} results counted · {player.wins} wins · {player.podiums} podiums</p><small>Saved ranks and seeds are authoritative. {data.season.status === 'playoffs' || data.season.status === 'complete' ? 'Playoff ranks and seeds are locked.' : 'Tiebreak order: ' + COMMISSIONER_TIEBREAKERS.join(' → ') + '.'}</small></div>
        {player.pointsDelta !== null && player.pointsDelta !== 0 && <p className="da-commissioner-warning">The saved total differs from the report calculation by {player.pointsDelta > 0 ? '+' : ''}{player.pointsDelta}. Review the reports before rebuilding the projection.</p>}
        {[{ label: 'Counted results', rows: player.counted }, { label: 'Dropped results', rows: player.dropped }].map(group => <div className="da-commissioner-result-group" key={group.label}><h4>{group.label}<span>{group.rows.length}</span></h4>{group.rows.length ? group.rows.map(result => <Link key={result.draftId} className="da-commissioner-result" to={`/drafts/${data.drafts.find(draft => draft.id === result.draftId)?.is_live ? 'live/' : ''}${result.draftId}`}><span className="da-commissioner-result-rank">#{result.rank}</span><div><strong>{result.topic}</strong><small>Draft {result.draftNumber} · Rated {result.score} · DH award {result.dhPoints}</small></div><b>{result.placementPoints}<small>season pts</small></b></Link>) : <p className="da-commissioner-empty">No {group.label.toLowerCase()}.</p>}</div>)}
      </>}
      <div className="da-commissioner-rule"><b>Placement scale</b><p>1st 10 · 2nd 7 · 3rd 5 · 4th 3 · 5th 2 · all other finishes 1.</p><small>DH awards belong to the app-wide score. They are shown for reference and are not added to season placement points.</small></div>
      <div className="da-commissioner-card"><h4><Calculator size={18} aria-hidden="true" /> Rebuild saved projection</h4><p>Recomputes standings from saved reports and the active ledger. It does not re-judge picks. {mismatches.length ? `${mismatches.length} saved totals differ.` : 'Loaded totals have no detected differences.'}</p><Button variant="outline" disabled={busy} onClick={() => review({ title: 'Rebuild season projection', description: 'Recalculates the saved season standings from existing report data and active adjustments. Locked playoff ranks and seeds are retained.', confirmLabel: 'Confirm rebuild', action: 'recalculate', payload: {} })}>Review rebuild</Button></div>
    </>}
    {mode === 'adjustments' && <>
      <div className="da-commissioner-section-heading"><div><h3>Commissioner ledger</h3><p>Reasoned season rulings. Every addition and revocation is recorded.</p></div><PlusCircle size={22} aria-hidden="true" /></div>
      {readOnly && <p className="da-commissioner-warning">This archived season is read-only for manual adjustments.</p>}
      <div className="da-commissioner-card">
        <label className="da-commissioner-field">Points member<select value={player?.userId ?? ''} disabled={readOnly || busy || !points.length} onChange={event => setSelected(event.target.value)}>{!points.length && <option value="">No season players yet</option>}{points.map(row => <option key={row.userId} value={row.userId}>{row.displayName}</option>)}</select></label>
        <label className="da-commissioner-field">Point change<Input type="number" inputMode="numeric" min={-100} max={100} step={1} value={delta} disabled={readOnly || busy} placeholder="e.g. 3 or -2" onChange={event => setDelta(event.target.value)} /></label>
        <p className="da-commissioner-hint">Whole points from −100 to +100, excluding zero. Signed totals can go below zero.</p>
        <label className="da-commissioner-field">Adjustment reason<Textarea rows={2} maxLength={1000} value={reason} disabled={readOnly || busy} onChange={event => setReason(event.target.value)} placeholder="Explain the ruling" /></label>
        <Button disabled={readOnly || busy || !player || !validDelta || !validReason} onClick={adjustmentPreview}>Preview adjustment</Button>
      </div>
      <h4>Saved adjustments</h4>
      {data.adjustments.length === 0 && <p className="da-commissioner-empty">No manual point adjustments.</p>}
      {data.adjustments.map(item => <article className="da-commissioner-ledger-row" key={item.id}><div><strong>{name(item.user_id)} <b>{item.delta > 0 ? '+' : ''}{item.delta}</b></strong><p>{item.reason}</p><small>{item.revoked_at ? `Revoked · ${item.revocation_reason ?? 'Recorded in history'}` : 'Active ledger entry'}</small></div>{!item.revoked_at && <Button variant="outline" disabled={readOnly || busy} onClick={() => { const impact = previewPointAdjustment(data, item.user_id, -item.delta); review({ title: 'Revoke adjustment', description: 'Retains the original ledger record and records a revocation. The active season total is recalculated.', confirmLabel: 'Confirm revocation', action: 'revoke_adjustment', payload: { id: item.id }, impact: impact ? [impact] : [], detail: <p>{name(item.user_id)} · reversing {item.delta > 0 ? '+' : ''}{item.delta} season points</p> }); }}>Review revocation</Button>}</article>)}
    </>}
    {mode === 'entries' && <>
      <div className="da-commissioner-section-heading"><div><h3>Season membership</h3><p>Review the best-of and seed impact before removing a regular draft.</p></div><MinusCircle size={22} aria-hidden="true" /></div>
      <div className="da-commissioner-rule"><b>Removal keeps the draft and its report.</b><p>Only its season membership is removed. Dropped best-of results may move into counted slots. Players without a remaining eligible result leave regular-season standings; their ledger stays in history.</p></div>
      <div className="da-commissioner-card">
        <label className="da-commissioner-field">Draft to remove<select value={draftId} disabled={busy || data.season.status !== 'regular_season'} onChange={event => setDraftId(event.target.value)}><option value="">Choose a regular draft</option>{regular.map(({ entry, draft }) => <option key={entry.id} value={draft!.id}>Draft {entry.week_number} · {draft!.topic}</option>)}</select></label>
        <label className="da-commissioner-field">Removal reason<Textarea value={removalReason} disabled={busy || data.season.status !== 'regular_season'} rows={2} maxLength={1000} onChange={event => setRemovalReason(event.target.value)} /></label>
        {data.season.status !== 'regular_season' && <p className="da-commissioner-warning">Regular-season membership is locked after playoffs start.</p>}
        <Button variant="outline" disabled={busy || data.season.status !== 'regular_season' || !validRemoval || removalReason.trim().length < 3} onClick={() => review({ title: 'Remove draft from season', description: 'Removes only the regular-season entry. The draft, picks, ratings and DH awards remain saved. The server rebuilds the season projection.', confirmLabel: 'Confirm removal', action: 'remove_draft', payload: { draft_id: draftId }, reason: removalReason, impact: previewSeasonRemoval(data, draftId), detail: <p>{data.drafts.find(draft => draft.id === draftId)?.topic}</p> })}>Review removal</Button>
      </div>
    </>}
  </section>;
}
