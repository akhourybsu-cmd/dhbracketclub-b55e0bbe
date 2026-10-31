import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useDraftArenaPalette } from '@/hooks/useDraftArenaPalette';
import type { CommissionerImpact, CommissionerMutate, CommissionerAction } from '@/lib/draft/commissioner';

export interface CommissionerReviewIntent {
  title: string;
  description: string;
  confirmLabel: string;
  action: CommissionerAction;
  payload: Record<string, unknown>;
  reason?: string;
  impact?: CommissionerImpact[];
  detail?: ReactNode;
}

export function CommissionerImpactList({ rows }: { rows: CommissionerImpact[] }) {
  return <div className="da-commissioner-impact" aria-label="Points impact">
    {rows.length === 0 && <p>No saved player totals change in this preview.</p>}
    {rows.map(row => <article key={row.userId}>
      <strong>{row.displayName}</strong>
      <div><span>{row.before} pts</span><ArrowRight size={14} aria-hidden="true" /><b>{row.rowRemoved ? 'Removed from standings' : row.after === null ? 'Awaiting a result' : `${row.after} pts`}</b><small>{row.delta > 0 ? '+' : ''}{row.delta}</small></div>
      <p>{row.rowRemoved ? 'No counted results remain. The adjustment ledger is retained.' : row.after === null ? 'The adjustment ledger awaits the first eligible result.' : `Rank ${row.beforeRank ?? '—'} → ${row.afterRank ?? '—'} · Seed ${row.beforeSeed ?? '—'} → ${row.afterSeed ?? '—'}`}{row.seedsLocked ? ' · Playoff rank and seed are locked.' : ''}</p>
    </article>)}
  </div>;
}

/** A review is local until the explicit confirmation reaches the audited RPC. */
export function CommissionerReview({ intent, mutate, busy, onClose, onSaved }: {
  intent: CommissionerReviewIntent;
  mutate: CommissionerMutate;
  busy: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { palette } = useDraftArenaPalette();
  const [reason, setReason] = useState(intent.reason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false);
  const pending = saving || busy;
  const valid = reason.trim().length >= 3 && reason.trim().length <= 1000;
  async function confirm() {
    if (guard.current || busy || !valid) return;
    guard.current = true; setSaving(true); setError(null);
    try {
      const result = await mutate(intent.action, intent.payload, reason.trim());
      if (intent.action === 'send_reminder' && typeof result.record?.notification_id !== 'string') throw new Error('Reminder delivery could not be verified. Refresh History before trying again.');
      const message = intent.action === 'send_reminder'
        ? 'Reminder sent as an in-app notification.'
        : `${intent.title} saved to season history.`;
      onSaved(message); onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The change could not be saved. Try again.');
    } finally { guard.current = false; setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !guard.current) onClose(); }}>
    <DialogContent className="da-appearance-panel da-lounge da-arena-dialog da-commissioner-review" data-da-palette={palette} onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogHeader><ShieldCheck size={22} aria-hidden="true" /><DialogTitle>{intent.title}</DialogTitle><DialogDescription>{intent.description}</DialogDescription></DialogHeader>
      <div className="da-commissioner-review-body">
        {intent.detail}
        {intent.impact && <CommissionerImpactList rows={intent.impact} />}
        <label className="da-commissioner-field">{intent.action === 'send_reminder' ? 'Reminder reason' : 'Reason for this change'}
          <Textarea value={reason} disabled={pending} rows={3} maxLength={1000} onChange={event => setReason(event.target.value)} placeholder="Explain the decision for season history" />
        </label>
        <p className="da-commissioner-hint">{intent.action === 'send_reminder' ? 'Your reason is the message in their inbox. ' : ''}3–1,000 characters. Saved with your commissioner action.</p>
        {error && <p className="da-commissioner-error" role="alert">{error} Your review is preserved; retry this confirmation.</p>}
      </div>
      <footer className="da-commissioner-review-actions">
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel preview</Button>
        <Button type="button" disabled={pending || !valid} onClick={() => void confirm()}>{pending ? 'Saving…' : intent.confirmLabel}</Button>
      </footer>
    </DialogContent>
  </Dialog>;
}
