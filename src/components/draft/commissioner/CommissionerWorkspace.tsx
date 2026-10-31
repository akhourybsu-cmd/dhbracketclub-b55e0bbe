import { useCallback, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, ArrowUpRight, Bell, CalendarDays, CheckCircle2, ClipboardList, History, Layers3, RefreshCw, Scale, ShieldCheck, Trophy, Users, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClub } from '@/contexts/ClubContext';
import { useCommissionerWorkspace } from '@/hooks/useCommissionerWorkspace';
import type { CommissionerAction, CommissionerInboxItem, CommissionerMutate } from '@/lib/draft/commissioner';
import { CommissionerPlanner } from './CommissionerPlanner';
import { CommissionerPoints } from './CommissionerPoints';
import { CommissionerDisputes } from './CommissionerDisputes';
import { CommissionerSeasonRules } from './CommissionerSeasonRules';
import { commissionerSavedChanges } from './commissionerPresentation';
import { CommissionerReview, type CommissionerReviewIntent } from './CommissionerReview';
import './commissionerWorkspace.css';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: ClipboardList }, { id: 'points', label: 'Points', icon: Layers3 },
  { id: 'disputes', label: 'Disputes', icon: Scale }, { id: 'planner', label: 'Planner', icon: CalendarDays },
  { id: 'participation', label: 'Participation', icon: Users }, { id: 'playoffs', label: 'Playoffs', icon: Trophy },
  { id: 'history', label: 'History', icon: History }, { id: 'tools', label: 'Season tools', icon: Wrench },
] as const;
type Section = typeof SECTIONS[number]['id'];
const ACTION_LABELS: Partial<Record<CommissionerAction | 'resolve_dispute', string>> = { add_adjustment: 'Point adjustment added', revoke_adjustment: 'Point adjustment revoked', remove_draft: 'Draft removed from season', add_draft: 'Draft added to season', recalculate: 'Standings rebuilt', dismiss_dispute: 'Dispute dismissed', reject_dispute: 'Dispute rejected', resolve_dispute: 'Re-evaluated pick', send_reminder: 'Reminder sent', upsert_plan: 'Schedule saved', delete_plan: 'Schedule deleted', upsert_preset: 'Preset saved', delete_preset: 'Preset deleted', update_season: 'Season rules updated', transfer_commissioner: 'Commissioner transferred' };
const date = (value: string) => { const parsed = new Date(value); return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Saved in season history'; };

export interface CommissionerWorkspaceProps {
  seasonId: string | null;
  seasonTitle?: string;
  onRefresh?: () => void | Promise<void>;
  children?: ReactNode;
}

export function CommissionerWorkspace({ seasonId, seasonTitle = 'Season', onRefresh, children }: CommissionerWorkspaceProps) {
  const { club } = useClub();
  const workspace = useCommissionerWorkspace(seasonId);
  const { data, points, actions, participation, readiness, loading, refreshing, error, busy, mutate: workspaceMutate } = workspace;
  const [params, setParams] = useSearchParams();
  const requested = params.get('tool');
  const available = SECTIONS;
  const section: Section = available.some(item => item.id === requested) ? requested as Section : 'overview';
  const [reviewState, setReviewState] = useState<{ seasonId: string | null; intent: CommissionerReviewIntent } | null>(null);
  const intent = reviewState?.seasonId === seasonId ? reviewState.intent : null;
  const setIntent = (next: CommissionerReviewIntent | null) => setReviewState(next ? { seasonId, intent: next } : null);
  const [savedNotice, setSavedNotice] = useState<{ seasonId: string | null; message: string } | null>(null);
  const notice = savedNotice?.seasonId === seasonId ? savedNotice.message : '';
  const setNotice = (message: string) => setSavedNotice({ seasonId, message });
  const tabsId = useId();
  const setSection = (value: Section) => { setNotice(''); setParams(current => { const next = new URLSearchParams(current); next.set('tab', 'commissioner'); next.set('tool', value); return next; }, { replace: true }); };
  const mutate: CommissionerMutate = useCallback(async (...args) => {
    const result = await workspaceMutate(...args);
    try { await onRefresh?.(); } catch { /* The action is already persisted; workspace exposes its own read status. */ }
    return result;
  }, [workspaceMutate, onRefresh]);
  function navKeys(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const index = available.findIndex(item => item.id === section);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length;
    event.preventDefault(); setSection(available[next].id); document.getElementById(`${tabsId}-${available[next].id}`)?.focus();
  }
  function remind(item: CommissionerInboxItem) {
    if (!item.userId || (item.kind !== 'stalled_turn' && item.kind !== 'playoff_topic')) return;
    setIntent({ title: 'Send player reminder', description: 'Sends one in-app notification to this waiting player. It does not submit a pick, skip a turn or alter the clock. Recent duplicates are limited by the server.', confirmLabel: 'Send reminder', action: 'send_reminder', payload: item.kind === 'stalled_turn' ? { kind: 'pick', draft_id: item.draftId, target_user_id: item.userId } : { kind: 'topic', match_id: item.matchId, target_user_id: item.userId }, detail: <p>{item.detail}</p> });
  }
  const roster = data ? data.profiles.filter(profile => data.participants.some(participant => participant.user_id === profile.id && data.entries.some(entry => entry.draft_id === participant.draft_id))).map(profile => ({ userId: profile.id, name: profile.display_name })) : [];
  const archived = data?.season.status === 'complete' || Boolean(data?.season.archived_at);
  const inbox = (rows: CommissionerInboxItem[]) => rows.length ? <div className="da-commissioner-inbox">{rows.map(item => <article key={item.id} data-priority={item.priority}><div><span className="da-commissioner-badge">{item.kind === 'stalled_turn' ? 'Pick waiting' : item.kind === 'playoff_topic' ? 'Topic waiting' : item.kind === 'dispute' ? 'Dispute' : 'Report'}</span><h4>{item.title}</h4><p>{item.detail}</p></div><footer>{item.kind === 'dispute' ? <Button variant="outline" onClick={() => setSection('disputes')}>Review case</Button> : <Button variant="outline" asChild><Link to={item.href}>Open draft <ArrowUpRight size={14} aria-hidden="true" /></Link></Button>}{(item.kind === 'stalled_turn' || item.kind === 'playoff_topic') && <Button variant="outline" disabled={busy} onClick={() => remind(item)}><Bell size={14} aria-hidden="true" /> Review reminder</Button>}</footer></article>)}</div> : <div className="da-commissioner-empty"><CheckCircle2 size={25} aria-hidden="true" /><strong>No items need attention.</strong><p>Saved reports, waiting turns and disputes will appear here.</p></div>;

  return <section className="da-commissioner-workspace" data-testid="commissioner-workspace" aria-label="Commissioner workspace">
    <header className="da-commissioner-header"><div className="da-commissioner-heading"><ShieldCheck size={22} aria-hidden="true" /><div><small>Commissioner command</small><h2>{seasonTitle}</h2></div></div><Button type="button" variant="ghost" size="icon" disabled={loading || refreshing || busy || !seasonId} aria-label="Refresh workspace" onClick={() => void workspace.refresh()}><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" /></Button></header>
    <nav className="da-commissioner-nav" role="tablist" aria-label="Commissioner sections" onKeyDown={navKeys}>{available.map(item => <button type="button" role="tab" id={`${tabsId}-${item.id}`} key={item.id} aria-selected={section === item.id} aria-controls={`${tabsId}-panel-${item.id}`} tabIndex={section === item.id ? 0 : -1} onClick={() => setSection(item.id)}><item.icon size={16} aria-hidden="true" /><span>{item.label}</span>{item.id === 'disputes' && data && data.disputes.some(dispute => dispute.status === 'pending') && <b>{data.disputes.filter(dispute => dispute.status === 'pending').length}</b>}</button>)}</nav>
    {notice && <div className="da-commissioner-notice" role="status"><CheckCircle2 size={16} aria-hidden="true" /><span>{notice}</span><button type="button" aria-label="Dismiss update" onClick={() => setNotice('')}>×</button></div>}
    {data && error && <div className="da-commissioner-load-error" role="alert"><p>{error} Showing the last loaded snapshot.</p><Button variant="outline" disabled={refreshing || busy} onClick={() => void workspace.refresh()}>Retry workspace</Button></div>}
    {!data ? <div className="da-commissioner-pane" aria-busy={loading}>
      {loading ? <div className="da-commissioner-empty"><Activity size={25} aria-hidden="true" /><strong>Loading season command…</strong><p>Checking the saved season, reports and action history.</p></div> : !seasonId ? <div className="da-commissioner-empty"><ShieldCheck size={25} aria-hidden="true" /><h3>No season selected</h3><p>Start or select a season to open its commissioner workspace.</p>{children}</div> : <div className="da-commissioner-empty" role="alert"><ShieldCheck size={25} aria-hidden="true" /><h3>Workspace unavailable</h3><p>{error ?? 'Commissioner access is required for this season.'}</p><Button variant="outline" onClick={() => void workspace.refresh()}>Retry workspace</Button></div>}
    </div> : <>
      {available.map(item => <div key={item.id} className="da-commissioner-pane" role="tabpanel" id={`${tabsId}-panel-${item.id}`} aria-labelledby={`${tabsId}-${item.id}`} hidden={section !== item.id} tabIndex={0}>
        {item.id === 'overview' && <>
          <div className="da-commissioner-section-heading"><div><h3>Season at a glance</h3><p>{archived ? 'Archived records. Reconciliation remains available in Points.' : 'Manage the real season. Changes are permission checked and recorded.'}</p></div><span className="da-commissioner-badge">{data.season.status.replace(/_/g, ' ')}</span></div>
          <div className="da-commissioner-metrics"><article><span>Completed</span><strong>{readiness?.completedDrafts ?? 0}<small>/{readiness?.targetDrafts ?? 0}</small></strong></article><article><span>Players</span><strong>{readiness?.rosterSize ?? 0}</strong></article><article><span>Attention</span><strong>{actions.length}</strong></article><article><span>Plans</span><strong>{data.plans.filter(plan => plan.status === 'planned' || plan.status === 'ready').length}</strong></article></div>
          <div className="da-commissioner-section-heading"><div><h3>Action inbox</h3><p>Real pending cases and saved-report checks.</p></div><span className="da-commissioner-badge">{actions.length} open</span></div>{inbox(actions)}
          <div className="da-commissioner-rule"><b>Your commissioner tools</b><p>Use Points for best-of breakdowns and audited rulings, Planner for reusable rules and schedules, and History for saved decisions.</p></div>
        </>}
        {item.id === 'points' && <CommissionerPoints key={data.season.id} data={data} points={points} busy={busy} initialDraftId={params.get('draft')} review={setIntent} />}
        {item.id === 'disputes' && <CommissionerDisputes data={data} busy={busy} review={setIntent} />}
        {item.id === 'planner' && club && <CommissionerPlanner clubId={club.id} seasonId={seasonId} data={data} mutate={mutate} busy={busy} readOnly={archived} recipients={roster} />}
        {item.id === 'participation' && <>
          <div className="da-commissioner-section-heading"><div><h3>The season roster</h3><p>Joined drafts, completed reports, recorded passes and actual waiting turns.</p></div><Users size={22} aria-hidden="true" /></div>
          <div className="da-commissioner-participation">{participation.map(player => <article key={player.userId}><header><strong>{player.displayName}</strong><span>{player.participationRate}% joined</span></header><div className="da-commissioner-progress" role="progressbar" aria-label={`${player.displayName} participation`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, player.participationRate))}><i style={{ width: `${Math.max(0, Math.min(100, player.participationRate))}%` }} /></div><div className="da-commissioner-player-stats"><span><b>{player.joined}</b> joined</span><span><b>{player.completed}</b> complete</span><span><b>{player.reports}</b> reports</span><span><b>{player.skipped}</b> passed picks</span><span><b>{player.missed}</b> missed drafts</span><span><b>{player.pendingTurns}</b> turns waiting</span></div><p>{player.remainingToBestOf ? `${player.remainingToBestOf} more eligible results to fill the best-of.` : 'Best-of result slots filled.'}</p></article>)}</div>
          {!participation.length && <p className="da-commissioner-empty">Players appear after joining a season draft.</p>}
          <h4>Waiting-player reminders</h4><p className="da-commissioner-hint">Review before sending an in-app notification. Timed rooms appear after their saved deadline; untimed rooms after 24 hours without activity. Paused LIVE clocks are excluded.</p>{inbox(actions.filter(action => action.kind === 'stalled_turn' || action.kind === 'playoff_topic'))}
        </>}
        {item.id === 'playoffs' && readiness && <>
          <div className="da-commissioner-section-heading"><div><h3>Road to the bracket</h3><p>Readiness follows the existing season transition rules.</p></div><Trophy size={24} aria-hidden="true" /></div>
          <div className="da-commissioner-metrics"><article><span>Completed</span><strong>{readiness.completedDrafts}/{readiness.targetDrafts}</strong></article><article><span>Ranked players</span><strong>{data.standings.length}</strong></article><article><span>Verified reports</span><strong>{readiness.verifiedReports}</strong></article><article><span>Pending cases</span><strong>{readiness.pendingDisputes}</strong></article></div>
          <div className="da-commissioner-rule"><b>{readiness.readyForPlayoffs ? 'Ready for the playoff transition' : data.season.status === 'playoffs' ? 'The bracket is in play' : 'Season readiness'}</b>{readiness.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}<small>Report checks and disputes are review cues, not additional playoff gates. Playoff seeding uses the saved standings and existing tiebreak rules.</small></div>
          <Button asChild><Link to="/drafts?tab=season">Open season and playoffs <ArrowUpRight size={15} aria-hidden="true" /></Link></Button>
          <h4>Saved seeds</h4><div className="da-commissioner-seeds">{[...data.standings].sort((a, b) => (a.playoff_seed ?? 999) - (b.playoff_seed ?? 999)).map(standing => { const profile = data.profiles.find(profile => profile.id === standing.user_id); return profile ? <article key={standing.id}><b>#{standing.playoff_seed ?? '—'}</b><strong>{profile.display_name}</strong><span>{standing.season_points} pts</span></article> : null; })}</div>
        </>}
        {item.id === 'history' && <>
          <div className="da-commissioner-section-heading"><div><h3>The season record</h3><p>Latest 200 persisted commissioner decisions, reasons and saved changes.</p></div><History size={22} aria-hidden="true" /></div>
          {!data.audit.length && <p className="da-commissioner-empty">No commissioner actions recorded yet.</p>}
          <ol className="da-commissioner-history">{[...data.audit].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(record => { const changes = commissionerSavedChanges(record,data); return <li key={record.id}><span className="da-commissioner-history-dot" aria-hidden="true" /><div><header><strong>{ACTION_LABELS[record.action as CommissionerAction] ?? 'Commissioner action'}</strong><time dateTime={record.created_at}>{date(record.created_at)}</time></header><p>{record.reason}</p><small>{data.profiles.find(profile => profile.id === record.actor_user_id)?.display_name ?? 'Commissioner'}</small><details className="da-commissioner-saved-changes"><summary>Saved changes</summary>{changes.length ? <dl>{changes.map((change,index) => <div key={`${change.label}-${index}`}><dt>{change.label}</dt><dd><span>{change.before}</span><span aria-hidden="true">→</span><b>{change.after}</b></dd></div>)}</dl> : <p>{record.action === 'recalculate' ? 'Projection rebuilt from saved reports and the active ledger. Locked playoff ranks and seeds were retained.' : 'The decision and reason were saved. No additional public field details are available.'}</p>}</details></div></li>; })}</ol>
        </>}
        {item.id === 'tools' && <><div className="da-commissioner-section-heading"><div><h3>Season controls</h3><p>Membership, commissioner transfer and season transitions retain their existing rules.</p></div><Wrench size={22} aria-hidden="true" /></div><CommissionerSeasonRules key={data.season.id} data={data} busy={busy} review={setIntent} />{children}</>}
      </div>)}
      {intent && <CommissionerReview key={`${intent.action}:${JSON.stringify(intent.payload)}`} intent={intent} mutate={mutate} busy={busy} onClose={() => setIntent(null)} onSaved={setNotice} />}
    </>}
  </section>;
}
