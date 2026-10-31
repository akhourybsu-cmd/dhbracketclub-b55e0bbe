import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommissionerWorkspaceData } from '@/lib/draft/commissioner';
import type { CommissionerReviewIntent } from './CommissionerReview';

export function CommissionerDisputes({ data, busy, review }: { data: CommissionerWorkspaceData; busy: boolean; review: (intent: CommissionerReviewIntent) => void }) {
  const [filter, setFilter] = useState<'pending' | 'resolved'>('pending');
  const disputes = data.disputes.filter(dispute => filter === 'pending' ? dispute.status === 'pending' : dispute.status !== 'pending');
  return <section aria-label="Dispute desk" className="da-commissioner-disputes">
    <div className="da-commissioner-section-heading"><div><h3>The review desk</h3><p>Read the original rating and player argument before recording a ruling.</p></div><Scale size={22} aria-hidden="true" /></div>
    <div className="da-commissioner-subnav" aria-label="Dispute views"><button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Pending · {data.disputes.filter(item => item.status === 'pending').length}</button><button type="button" aria-pressed={filter === 'resolved'} onClick={() => setFilter('resolved')}>Resolved</button></div>
    {!disputes.length && <p className="da-commissioner-empty">{filter === 'pending' ? 'No pending disputes in this season.' : 'No resolved disputes yet.'}</p>}
    {disputes.map(dispute => {
      const pick = data.picks.find(item => item.id === dispute.pick_id);
      const draft = data.drafts.find(item => item.id === dispute.draft_id);
      const profile = data.profiles.find(item => item.id === dispute.user_id);
      const rating = data.results.flatMap(result => Array.isArray(result.pick_ratings) ? result.pick_ratings as unknown[] : []).find(value => value && typeof value === 'object' && 'pick_id' in value && value.pick_id === dispute.pick_id) as { score?: unknown; explanation?: unknown } | undefined;
      const href = `/drafts/${draft?.is_live ? 'live/' : ''}${dispute.draft_id}`;
      const ruling = (action: 'dismiss_dispute' | 'reject_dispute') => review({ title: action === 'reject_dispute' ? 'Reject dispute' : 'Dismiss dispute', description: action === 'reject_dispute' ? 'Keeps the original rating and records why the challenge is rejected. This closes the pending dispute.' : 'Closes the pending dispute without changing its rating. Record why no further action is needed.', confirmLabel: action === 'reject_dispute' ? 'Confirm rejection' : 'Confirm dismissal', action, payload: { dispute_id: dispute.id }, detail: <div className="da-commissioner-rule"><b>{pick?.pick_text ?? 'Original pick unavailable'}</b><p>{dispute.reason}</p></div> });
      return <article className="da-commissioner-dispute-card" key={dispute.id}>
        <header><div><small>{profile?.display_name ?? 'Season member'} · {draft?.topic ?? 'Season draft'}</small><h4>{pick?.pick_text ?? 'Original pick unavailable'}</h4></div><span className="da-commissioner-badge">{dispute.status}</span></header>
        <div className="da-commissioner-rating"><b>{typeof rating?.score === 'number' ? `${rating.score}/10` : 'Rating unavailable'}</b><p>{typeof rating?.explanation === 'string' ? rating.explanation : 'Open the saved draft report for the full rating context.'}</p></div>
        <div className="da-commissioner-argument"><small>Player argument</small><p>{dispute.reason}</p></div>
        {dispute.commissioner_rationale && <div className="da-commissioner-rule"><b>Commissioner rationale</b><p>{dispute.commissioner_rationale}</p></div>}
        {dispute.status === 'pending' && <p className="da-commissioner-hint">Only this season’s commissioner or a club-scoped app administrator can resolve this case. Re-evaluation uses the existing draft judging flow.</p>}
        <footer><Button variant="outline" asChild><Link to={href}>Open draft review</Link></Button>{dispute.status === 'pending' && <><Button variant="outline" disabled={busy} onClick={() => ruling('dismiss_dispute')}>Review dismissal</Button><Button variant="outline" disabled={busy} onClick={() => ruling('reject_dispute')}>Review rejection</Button></>}</footer>
      </article>;
    })}
  </section>;
}
