import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Coins, Eye, EyeOff, RefreshCw, ShieldCheck, Trophy } from 'lucide-react';
import { useDeepClaimClub } from '@/hooks/useDeepClaimClub';
import { RESOURCE_BY_ID, resourceQuantity, resourceSaleValue } from '@/lib/deepClaim/catalog';
import { projectContributionReasons, projectQualificationValue } from '@/lib/deepClaim/social';
import type { DeepClaimClubView, DeepClaimPublicCompany, DeepClaimPublicSpecimen, DeepClaimResources, DeepClaimSnapshot, DeepClaimSocialPreferencesInput, DeepClaimStandingMetric } from '@/lib/deepClaim/types';
import { DeepClaimClubIcon, DeepClaimCompanyCrest, DeepClaimProjectArt, DeepClaimShowcaseArt } from './renderer/DeepClaimClubArt';
import { DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimMeter, ClaimState } from './DeepClaimPrimitives';
import type { ClaimClubView } from './clubLinks';
import { TutorialToolbar, useTutorialView } from './tutorial/events';

export interface DeepClaimClubActions {
  setSocialPreferences: (input: DeepClaimSocialPreferencesInput, revision?: number) => Promise<DeepClaimSnapshot>;
  contributeProject: (key: string, resources: DeepClaimResources, revision?: number) => Promise<DeepClaimSnapshot>;
  claimProject: (key: string, revision?: number) => Promise<DeepClaimSnapshot>;
}
export interface ClaimClubProps {
  snapshot: DeepClaimSnapshot; view: ClaimClubView; onView: (view: ClaimClubView) => void; onClose: () => void;
  projectKey?: string | null; onProjectHandled?: () => void; actions: DeepClaimClubActions; busy: boolean; readOnly: boolean;
  onConfirmed: (title: string, description: string, updated: DeepClaimSnapshot, credits?: boolean) => void;
}
/** Mount only inside the optional Club Office view. The private game never waits for this query. */
export function DeepClaimClubSession(props: ClaimClubProps) {
  const [metric, setMetric] = useState<DeepClaimStandingMetric>('weekly_mining_value');
  const [page, setPage] = useState(0);
  const club = useDeepClaimClub({ enabled: true, metric, page });
  return <DeepClaimClub {...props} data={club.data} loading={club.loading} refreshing={club.refreshing} error={club.error} refresh={club.refresh} metric={metric} onMetric={setMetric} page={page} onPage={setPage} readOnly={props.readOnly || club.readOnly} />;
}

type Review = { kind: 'project'; key: string; revision: number; confirmed: boolean } | { kind: 'privacy'; revision: number; confirmed: boolean } | { kind: 'company'; userId: string };
const METRIC_NAMES: Record<DeepClaimStandingMetric, string> = { weekly_mining_value: 'Weekly value', operational_depth: 'Depth', best_find: 'Best find' };
export function DeepClaimClub({ snapshot, data, loading, refreshing, error, refresh, metric, onMetric, page, onPage, view, onView, onClose, projectKey, onProjectHandled, actions, onConfirmed, busy, readOnly }: ClaimClubProps & {
  data: DeepClaimClubView | null; loading: boolean; refreshing: boolean; error: string | null; refresh: () => Promise<void>;
  metric: DeepClaimStandingMetric; onMetric: (metric: DeepClaimStandingMetric) => void; page: number; onPage: (page: number) => void;
}) {
  const [storedReview, setReview] = useState<Review | null>(() => projectKey && view === 'projects' ? { kind: 'project', key: projectKey, revision: snapshot.revision, confirmed: false } : null);
  const body = useRef<HTMLDivElement>(null);
  const previousView = useRef(view);
  const internalView = useRef<ClaimClubView | null>(null);
  const review = previousView.current === view || internalView.current === view ? storedReview : null;
  const reviewIdentity = review?.kind === 'project' ? `project:${review.key}` : review?.kind === 'company' ? `company:${review.userId}` : review?.kind ?? 'list';
  useLayoutEffect(() => { if (body.current) body.current.scrollTop = 0; }, [view, reviewIdentity]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [projectPage, setProjectPage] = useState(0);
  const [standings, setStandings] = useState(false);
  const [showcase, setShowcase] = useState(false);
  const [featuredPage, setFeaturedPage] = useState(0);
  const [featured, setFeatured] = useState<string[]>([]);
  const [actionError, setActionError] = useState('');
  useLayoutEffect(() => {
    if (internalView.current === view) { previousView.current = view; internalView.current = null; return; }
    if (previousView.current === view) return;
    previousView.current = view; internalView.current = null;
    setReview(null); setQuantities({}); setActionError('');
  }, [view]);
  const current = data && data.metric === metric && data.showcases.page === page ? data : null;
  useTutorialView('club_view_opened', current ? { view, record_id: metric } : null, `club:${view}:${metric}:${!!current}`);
  const confirmedReview = !!review && 'confirmed' in review && review.confirmed;
  const project = review?.kind === 'project' ? current?.projects.find(item => item.key === review.key) : undefined;
  useTutorialView('club_view_opened', project ? { view: 'project', record_id: project.key } : null, `club-project:${project?.key}`);
  useTutorialView('privacy_reviewed', current && review?.kind === 'privacy' ? { view: 'privacy' } : null, `privacy:${reviewIdentity}:${!!current}`);
  const definition = current?.catalog.projects.find(item => item.key === project?.key);
  const requested = useMemo(() => Object.fromEntries(Object.entries(quantities).filter(([, value]) => value !== '' && Number(value) !== 0).map(([key, value]) => [key, Number(value)])) as DeepClaimResources, [quantities]);
  const pendingSync = !!current && current.own_revision > snapshot.revision;
  const frozen = readOnly || busy || refreshing || !!error || pendingSync;
  const stale = !!review && 'revision' in review && review.revision < snapshot.revision;
  const reasons = project && definition ? projectContributionReasons({ project: definition, requested, stock: snapshot.resources, cash: snapshot.company?.cash ?? 0, progress: project.progress, own: project.own_contribution, cap_percent: project.effective_cap_percent }) : [];
  if (project && project.status !== 'open') reasons.unshift('This project is not open for contributions.');
  const publicCompany = review?.kind === 'company' ? current?.showcases.companies.find(item => item.user_id === review.userId) : undefined;
  const selectable = useMemo(() => {
    const items = new Map<string, { id: string; specimen: DeepClaimPublicSpecimen; retained: boolean }>();
    current?.own.featured_discovery_ids.forEach((id, index) => { const specimen = current.own.featured_specimens[index]; if (specimen) items.set(id, { id, specimen, retained: true }); });
    snapshot.discoveries?.filter(item => item.status === 'kept').forEach(item => items.set(item.id, { id: item.id, specimen: { kind: item.kind, name: item.name, quality: item.quality, detail: item.detail }, retained: false }));
    return [...items.values()];
  }, [current, snapshot.discoveries]);
  const shownFeaturedPage = Math.min(featuredPage, Math.max(0, Math.ceil(selectable.length / 6) - 1));
  function reset() { setReview(null); setActionError(''); setQuantities({}); onProjectHandled?.(); }
  function changeView(next: ClaimClubView) { internalView.current = next; reset(); onView(next); }
  function inspectProject(key: string) { setQuantities({}); setActionError(''); setReview({ kind: 'project', key, revision: snapshot.revision, confirmed: false }); }
  function editPrivacy() {
    if (!current) return;
    setFeaturedPage(0); setStandings(current.own.standings_enabled); setShowcase(current.own.showcase_enabled); setFeatured([...current.own.featured_discovery_ids]);
    setActionError(''); setReview({ kind: 'privacy', revision: snapshot.revision, confirmed: false });
  }
  async function submit() {
    if (!current || !review || review.kind === 'company' || frozen || stale) return;
    setActionError('');
    try {
      if (review.kind === 'privacy' && confirmedReview) {
        const updated = await actions.setSocialPreferences({ standings_enabled: standings, showcase_enabled: showcase, featured_discovery_ids: [...featured] }, review.revision);
        onConfirmed('Sharing updated.', 'Your sharing preferences have been saved.', updated);
      } else if (project?.status === 'completed' && project.qualified && !project.claimed_at) {
        const updated = await actions.claimProject(project.key, review.revision);
        onConfirmed('Project reward secured.', `${definition?.name} · ${project.reward_amount} company credits.`, updated, true);
      } else if (project?.status === 'open' && confirmedReview && !reasons.length) {
        const updated = await actions.contributeProject(project.key, requested, review.revision);
        onConfirmed('Contribution recorded.', `${Object.entries(requested).map(([key, count]) => `${count} ${RESOURCE_BY_ID[key as keyof DeepClaimResources].name}`).join(', ')} permanently contributed from collected stock.`, updated);
      }
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : 'The club action could not be confirmed. Check the saved action before retrying.'); }
  }
  const projects = current?.projects ?? [];
  const shownProjectPage = Math.min(projectPage, Math.max(0, Math.ceil(projects.length / 3) - 1));
  const hasClaim = !!project && project.status === 'completed' && project.qualified && !project.claimed_at;
  const projectInvalid = !project || project.status !== 'open' || reasons.length > 0;
  return <div className="dcl-club">
    <TutorialToolbar lessonId={review?.kind === 'privacy' ? 'club.privacy' : view === 'standings' ? 'club.standings' : view === 'showcase' ? 'club.showcase' : 'club.projects'} label={review?.kind === 'privacy' ? 'Sharing privacy' : view === 'standings' ? 'Standings' : view === 'showcase' ? 'Showcases' : 'Club projects'}><div className="dcl-club-viewbar" role="group" aria-label="Club office views">{(['projects', 'standings', 'showcase'] as const).map(key => <button type="button" key={key} aria-pressed={view === key} disabled={busy} onClick={() => changeView(key)}><DeepClaimClubIcon kind={key === 'projects' ? 'project' : key === 'standings' ? 'standings' : 'showcase'} decorative />{key === 'projects' ? 'Projects' : key === 'standings' ? 'Standings' : 'Showcase'}</button>)}</div></TutorialToolbar>
    <div ref={body} className="dcl-club-body">
      {!current ? <ClaimState title={error ? 'Club board unavailable' : 'Opening the club board'} error={error} onRetry={() => void refresh()} refreshing={loading || refreshing}>Your private company remains available.</ClaimState> : <>
        {error && <div className="dcl-error" role="alert"><p>{error}</p><ClaimButton className="is-small" onClick={() => void refresh()}>Retry club records</ClaimButton></div>}
        {pendingSync && <p className="dcl-note" role="status">Updating your private stock before club decisions are available.</p>}
        {review?.kind === 'privacy' ? <>
          <div className="dcl-section-heading" data-dc-tutorial="club-privacy"><div><h3>Sharing</h3></div><DeepClaimClubIcon kind="club" decorative /></div>
          <p className="dcl-note">Sharing is limited to your current club. Standings show your name, company and scores; showcases show selected specimens. Your mine, crew, stock, cash and shifts stay private. Turning sharing off keeps your progress and contributions.</p>
          <label className="dcl-sharing-choice"><input type="checkbox" aria-label="List my company in standings" checked={standings} disabled={frozen || confirmedReview} onChange={event => setStandings(event.target.checked)} /><span><strong>List my company in standings</strong><small>Weekly mining value, completed depth and best-find value.</small></span></label>
          <label className="dcl-sharing-choice"><input type="checkbox" aria-label="Publish my selected specimens" checked={showcase} disabled={frozen || confirmedReview} onChange={event => setShowcase(event.target.checked)} /><span><strong>Publish my selected specimens</strong><small>Choose up to three owned, kept finds below.</small></span></label>
          <div className="dcl-featured-picker" role="group" aria-label="Featured kept specimens">{selectable.slice(shownFeaturedPage * 6, shownFeaturedPage * 6 + 6).map(item => <label className="dcl-sharing-choice" data-owned-find-id={item.id} key={item.id}><input type="checkbox" aria-label={`Feature ${item.specimen.name}${item.retained ? ' (retained selection)' : ''}`} checked={featured.includes(item.id)} disabled={frozen || confirmedReview || !featured.includes(item.id) && featured.length >= 3} onChange={() => setFeatured(values => values.includes(item.id) ? values.filter(id => id !== item.id) : [...values, item.id])} /><span><strong>{item.specimen.name}</strong><small>{item.specimen.quality}{item.retained ? ' · retained selection' : ''}</small></span></label>)}</div>
          {selectable.length > 6 && <div className="dcl-field-pagination" role="group" aria-label="Kept specimen pages"><ClaimButton className="is-small" aria-label="Previous kept specimens" disabled={shownFeaturedPage === 0 || frozen || confirmedReview} onClick={() => setFeaturedPage(value => value - 1)}>Previous</ClaimButton><span>{shownFeaturedPage * 6 + 1}–{Math.min(selectable.length, shownFeaturedPage * 6 + 6)} of {selectable.length}</span><ClaimButton className="is-small" aria-label="Next kept specimens" disabled={(shownFeaturedPage + 1) * 6 >= selectable.length || frozen || confirmedReview} onClick={() => setFeaturedPage(value => value + 1)}>Next</ClaimButton></div>}
          {!selectable.length && <p className="dcl-note">Keep a discovery before selecting a specimen to share.</p>}
          <p className="dcl-note">{featured.length}/3 selected. Older featured finds stay selected; uncheck one to remove it.</p>
          {confirmedReview && <div className="dcl-sharing-review" aria-label="Reviewed sharing choices"><ShieldCheck size={18} aria-hidden="true" /><strong>Confirm current-club sharing</strong><p>Standings: {standings ? 'listed' : 'private'} · Showcase: {showcase ? 'published' : 'private'} · {featured.length} selected specimens.</p><p>Nothing is published until you confirm.</p></div>}
        </> : project && definition ? <>
          <div className="dcl-section-heading" data-dc-tutorial="club-project-review"><div><h3>{definition.name}</h3><p>{definition.description}</p></div><ClaimBadge tone={project.status === 'completed' ? 'green' : project.status === 'open' ? 'brass' : 'muted'}>{project.status}</ClaimBadge></div><DeepClaimProjectArt projectKey={project.key} status={project.status} progress={projectFraction(project)} decorative className="dcl-project-detail-art" />
          {project.status === 'locked' ? <p className="dcl-note">Requires {definition.requires.map(key => current.catalog.projects.find(item => item.key === key)?.name ?? key).join(', ')}.</p> : <>
            <p className="dcl-note">Contribution limit: {project.effective_cap_percent}% per material. The limit can rise if the club shrinks. Keep 2 credits in cash and collected stock combined; pending rewards do not count.</p>
            <div className="dcl-project-inputs">{Object.entries(project.goals).map(([key, goal]) => { const resource = key as keyof DeepClaimResources, delivered = resourceQuantity(project.progress, resource), own = resourceQuantity(project.own_contribution, resource), stock = resourceQuantity(snapshot.resources, resource); const globalRemaining = Math.max(0, (goal ?? 0) - delivered), ownRemaining = Math.max(0, Math.floor((goal ?? 0) * project.effective_cap_percent / 100) - own); return <section key={key}><header><DeepClaimResourceIcon resourceId={resource} decorative /><strong>{RESOURCE_BY_ID[resource].name}</strong><small>{delivered}/{goal} delivered</small></header><ClaimMeter value={delivered} max={goal ?? 1} label={`${RESOURCE_BY_ID[resource].name} project progress`} /><p>Collected {stock} · project needs {globalRemaining} · you may add {ownRemaining} more</p>{project.status === 'open' && <label>Contribution<input type="number" min="0" max={Math.min(stock, globalRemaining, ownRemaining)} step="1" aria-label={`${RESOURCE_BY_ID[resource].name} contribution`} disabled={frozen || confirmedReview || Math.min(stock, globalRemaining, ownRemaining) === 0} value={quantities[key] ?? ''} onChange={event => { setQuantities(values => ({ ...values, [key]: event.target.value })); setActionError(''); }} placeholder="0" /></label>}</section>; })}</div>
            <div className="dcl-compact-facts" role="group" aria-label="Project reward qualification"><span><Check size={14} aria-hidden="true" />Your value <b>{project.own_value}/{project.total_value}</b></span><span><ShieldCheck size={14} aria-hidden="true" />Qualify at <b>{projectQualificationValue(project.total_value)} ({current.catalog.caps.qualified_percent}%)</b></span><span><Coins size={14} aria-hidden="true" />Reward pool <b>{project.reward_pool} cr</b></span></div><details className="dcl-detail-disclosure"><summary>Reward rules</summary><p className="dcl-note">Rewards are proportional to your contribution and rounded down. Meet the qualifying contribution shown above to claim your share after the project is complete.</p></details>
            {project.status === 'completed' && <div className="dcl-trade-summary"><span>{project.claimed_at ? 'Your reward was claimed' : project.qualified ? 'Your confirmed reward' : 'Participation below qualifying threshold'}</span><strong>{project.reward_amount} cr</strong></div>}
            {confirmedReview && project.status === 'open' && <div className="dcl-sharing-review" aria-label="Reviewed permanent contribution"><ShieldCheck size={18} aria-hidden="true" /><strong>These materials leave your warehouse permanently</strong><ClubMaterials resources={requested} /><p>Contributions cannot be refunded. If stock, project space or your limit changes, nothing is transferred.</p></div>}
            {project.status === 'open' && reasons.length > 0 && <ul className="dcl-blocked-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
          </>}
        </> : publicCompany ? <>
          <PublicCompanyHeader company={publicCompany} /><DeepClaimShowcaseArt specimens={publicCompany.specimens} companyName={publicCompany.company_name} decorative className="dcl-showcase-detail-art" />{publicCompany.specimens.length ? publicCompany.specimens.map((specimen, index) => <section className="dcl-card" key={index}><h4>{specimen.name}</h4><ClaimBadge>{specimen.quality}</ClaimBadge><p>{specimen.detail}</p></section>) : <p className="dcl-note">This company has not selected a specimen to display.</p>}
        </> : <>
          <div className="dcl-club-privacy"><span>{current.own.standings_enabled || current.own.showcase_enabled ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}<strong>{current.own.standings_enabled || current.own.showcase_enabled ? 'Club sharing on' : 'Your company is private'}</strong></span><ClaimButton className="is-small" onClick={editPrivacy}>Sharing preferences</ClaimButton></div>
          {view === 'projects' ? <>
            <div className="dcl-section-heading"><div><h3>Club projects</h3></div><ClaimButton className="is-small dcl-club-refresh" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh club projects"><RefreshCw size={15} aria-hidden="true" /></ClaimButton></div>
            <div className="dcl-club-project-list" data-dc-tutorial="club-projects">{projects.slice(shownProjectPage * 3, shownProjectPage * 3 + 3).map(item => { const metadata = current.catalog.projects.find(value => value.key === item.key)!; return <button type="button" className="dcl-card dcl-club-project-card" key={item.key} onClick={() => inspectProject(item.key)} aria-label={`Review project ${metadata.name}`}><DeepClaimProjectArt projectKey={item.key} status={item.status} progress={projectFraction(item)} decorative /><span><strong>{metadata.name}</strong><small>{item.status} · {item.reward_pool} cr pool</small><ClubMaterials resources={item.goals} progress={item.progress} /></span><ClaimBadge tone={item.status === 'completed' ? 'green' : 'brass'}>{item.status === 'completed' && item.qualified && !item.claimed_at ? 'Reward ready' : item.status}</ClaimBadge></button>; })}</div>
            {projects.length > 3 && <div className="dcl-field-pagination" role="group" aria-label="Club project pages"><ClaimButton className="is-small" aria-label="Previous club projects" disabled={shownProjectPage === 0} onClick={() => setProjectPage(value => value - 1)}>Previous</ClaimButton><span>{shownProjectPage * 3 + 1}–{Math.min(projects.length, shownProjectPage * 3 + 3)} of {projects.length}</span><ClaimButton className="is-small" aria-label="Next club projects" disabled={(shownProjectPage + 1) * 3 >= projects.length} onClick={() => setProjectPage(value => value + 1)}>Next</ClaimButton></div>}
            <Link className="dcl-button" to="/feats?goal=deep_claim_club_projects"><Trophy size={15} aria-hidden="true" />View DH Feats</Link>
          </> : view === 'standings' ? <>
            <div className="dcl-segment dcl-club-metrics" role="group" aria-label="Club standing metric">{(['weekly_mining_value', 'operational_depth', 'best_find'] as const).map(key => <button type="button" key={key} aria-pressed={metric === key} onClick={() => onMetric(key)}>{METRIC_NAMES[key]}</button>)}</div>
            <details className="dcl-detail-disclosure"><summary>About this board</summary><p className="dcl-note">{current.catalog.standings.find(item => item.key === metric)?.description} Ties share rank; the top 50 and your own rank appear once. Boards are separate, with no combined score. Other returns appear after that company synchronizes.</p></details>{metric === 'weekly_mining_value' && <p className="dcl-note">{formatWeek(current.week.starts_at, current.week.timezone)} – {formatWeek(current.week.ends_at, current.week.timezone)} · {current.week.timezone}</p>}
            <div className="dcl-club-standings" data-dc-tutorial="club-standings" aria-label="Club standings">{current.standings.map(player => <article key={player.user_id} className="dcl-club-standing"><b>{player.rank}</b><PublicAvatar name={player.display_name} url={player.avatar_url} /><div><strong>{player.display_name}{player.is_you ? ' · You' : ''}</strong><small>{player.company_name}</small></div><span>{player.value.toLocaleString()}{metric === 'operational_depth' ? 'm' : ' value'}</span></article>)}</div>
            {!current.standings.length && <p className="dcl-note">No listed companies yet. Listing is optional in Sharing preferences.</p>}
          </> : <>
            <div className="dcl-section-heading"><div><h3>Showcases</h3></div><ClaimBadge>{current.showcases.total} companies</ClaimBadge></div>
            <div className="dcl-public-showcases" data-dc-tutorial="club-showcase">{current.showcases.companies.map(company => <button type="button" className="dcl-card" key={company.user_id} aria-label={`View ${company.company_name} showcase`} onClick={() => setReview({ kind: 'company', userId: company.user_id })}><PublicCompanyHeader company={company} /><DeepClaimShowcaseArt specimens={company.specimens} companyName={company.company_name} decorative /></button>)}</div>
            {!current.showcases.companies.length && <p className="dcl-note">No shared specimens on this page.</p>}
            <div className="dcl-field-pagination" role="group" aria-label="Showcase pages"><ClaimButton className="is-small" disabled={page === 0 || refreshing} onClick={() => onPage(page - 1)}>Previous</ClaimButton><span>Page {page + 1}</span><ClaimButton className="is-small" disabled={!current.showcases.has_more || refreshing} onClick={() => onPage(page + 1)}>Next</ClaimButton></div>
          </>}
        </>}
        {stale && <p className="dcl-note">Your company changed. Review the current stock and choices before confirming.</p>}{actionError && <p className="dcl-error" role="alert">{actionError}</p>}
      </>}
    </div>
    <div className="dcl-club-footer dcl-dialog-actions">{review ? <><ClaimButton disabled={busy} onClick={() => { if ('confirmed' in review && confirmedReview) setReview({ ...review, confirmed: false }); else reset(); }}><ArrowLeft size={14} aria-hidden="true" />Back</ClaimButton>{review.kind !== 'company' && current && (review.kind === 'privacy' || hasClaim || project?.status === 'open') && (stale ? <ClaimButton primary disabled={frozen} onClick={() => setReview({ ...review, revision: snapshot.revision, confirmed: false })}>Review current stock</ClaimButton> : 'confirmed' in review && !confirmedReview && !hasClaim ? <ClaimButton primary disabled={frozen || review.kind === 'project' && projectInvalid} onClick={() => setReview({ ...review, revision: snapshot.revision, confirmed: true })}>{review.kind === 'privacy' ? 'Review sharing' : 'Review contribution'}</ClaimButton> : <ClaimButton primary pending={busy} disabled={frozen || review.kind === 'project' && !hasClaim && projectInvalid} onClick={() => void submit()}>{review.kind === 'privacy' ? 'Confirm sharing preferences' : hasClaim ? 'Claim project credits' : 'Confirm contribution'}</ClaimButton>)}</> : <ClaimButton onClick={onClose} disabled={busy}>Back to camp</ClaimButton>}</div>
  </div>;
}

function ClubMaterials({ resources, progress }: { resources: DeepClaimResources; progress?: DeepClaimResources }) {
  return <div className="dcl-club-materials">{Object.entries(resources).map(([key, quantity]) => <span key={key}><DeepClaimResourceIcon resourceId={key as keyof DeepClaimResources} decorative /><b>{progress ? `${resourceQuantity(progress, key as keyof DeepClaimResources)}/` : ''}{quantity}</b><small>{RESOURCE_BY_ID[key as keyof DeepClaimResources].name}</small></span>)}</div>;
}
function projectFraction(project: DeepClaimClubView['projects'][number]) { const goals = Object.entries(project.goals); return goals.length ? goals.reduce((sum, [key, goal]) => sum + Math.min(1, resourceQuantity(project.progress, key as keyof DeepClaimResources) / (goal || 1)), 0) / goals.length : 0; }
function PublicAvatar({ name, url }: { name: string; url: string | null }) { return <span className="dcl-public-avatar" aria-hidden="true">{name.trim().slice(0, 1).toLocaleUpperCase()}{url && <img src={url} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span>; }
function PublicCompanyHeader({ company }: { company: DeepClaimPublicCompany }) { return <div className="dcl-public-company"><DeepClaimCompanyCrest userId={company.user_id} companyName={company.company_name} decorative /><span><strong>{company.company_name}</strong><small>{company.display_name}</small></span></div>; }
function formatWeek(value: string, timezone: string) { try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: timezone }).format(new Date(value)); } catch { return value.slice(0, 10); } }
