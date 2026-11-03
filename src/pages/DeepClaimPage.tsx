import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Coins, List, Package, Pickaxe, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { useDeepClaimTutorial } from '@/hooks/useDeepClaimTutorial';
import type { TutorialEvent, TutorialEventDetail, TutorialEventType, TutorialLessonId, TutorialOpenAction } from '@/lib/deepClaim/tutorial/types';
import { BUILDING_INFO, RESOURCE_BY_ID, RESOURCE_CATALOG, buildingEffect, resourceQuantity, resourceTotal } from '@/lib/deepClaim/catalog';
import { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { DEEP_CLAIM_RESOURCE_IDS, type DeepClaimBuildingId, type DeepClaimExpedition, type DeepClaimMode, type DeepClaimPoint, type DeepClaimProductionJob, type DeepClaimProductionStation, type DeepClaimResourceId, type DeepClaimResources } from '@/lib/deepClaim/types';
import { DeepClaimCanvas } from '@/components/deepClaim/renderer/DeepClaimCanvas';
import { DeepClaimBusinessIcon, DeepClaimDiscoveryIcon, DeepClaimResourceIcon } from '@/components/deepClaim/renderer/DeepClaimIcons';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimCrew, DeepClaimLog, DeepClaimStores } from '@/components/deepClaim/DeepClaimPanels';
import { DeepClaimWorkforce } from '@/components/deepClaim/DeepClaimWorkforce';
import { DeepClaimClubSession } from '@/components/deepClaim/DeepClaimClub';
import { deepClaimLink, type ClaimClubView } from '@/components/deepClaim/clubLinks';
import { DeepClaimBusiness, type ClaimBusinessView } from '@/components/deepClaim/DeepClaimBusiness';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import { DeepClaimFieldLog, DeepClaimOperations, type ClaimFieldView } from '@/components/deepClaim/DeepClaimField';
import { DeepClaimSettings, type ClaimVisualPreferences } from '@/components/deepClaim/DeepClaimSettings';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimDialogScope, ClaimMeter, ClaimState } from '@/components/deepClaim/DeepClaimPrimitives';
import { discoveryRevealKey, markDiscoveryRevealed, nextDiscoveryReveal, observeDiscoveryReveals, readDiscoveryReveals, saveDiscoveryReveals, type DiscoveryRevealReceipt } from '@/components/deepClaim/discoveryReveals';
import { claimIntroAvailable, claimTargets } from '@/components/deepClaim/display';
import { DeepClaimTitleScreen } from '@/components/deepClaim/menu/DeepClaimTitleScreen';
import { DeepClaimPrologue } from '@/components/deepClaim/menu/DeepClaimPrologue';
import { DeepClaimTutorialDirector, type DeepClaimTrainingRequest } from '@/components/deepClaim/tutorial/DeepClaimTutorialDirector';
import { DeepClaimTutorialEventsProvider } from '@/components/deepClaim/tutorial/events';
import type { ClaimWorkerInspectRequest } from '@/components/deepClaim/DeepClaimPanels';
import type { ClaimWorkforceViewRequest } from '@/components/deepClaim/DeepClaimWorkforce';
import type { ClaimSettingsViewRequest } from '@/components/deepClaim/DeepClaimSettings';
import '@/components/deepClaim/deepClaim.css';
import '@/components/deepClaim/deepClaimVisuals.css';
import '@/components/deepClaim/deepClaimMenus.css';
import { DeepClaimBuildingPortrait } from '@/components/deepClaim/renderer/DeepClaimBuildingPortrait';
import { DeepClaimNavEmblem } from '@/components/deepClaim/DeepClaimNavEmblem';
import { DHGamesIntro } from '@/components/games/DHGamesIntro';
import { hasVerifiedSale } from '@/lib/deepClaim/tutorial/completion';
import { evaluateCompanyGoal, type CompanyGoalRef } from '@/lib/deepClaim/companyGoals';
import { companyPlanKey, readCompanyPlan, saveCompanyPlan } from '@/lib/deepClaim/companyPlan';
import { DeepClaimGoalDock, DeepClaimGoalPlanner } from '@/components/deepClaim/DeepClaimCompanyGoals';
import { DeepClaimReturnReport } from '@/components/deepClaim/DeepClaimReturnReport';
import { acknowledgeReturnReport, currentReturnReport, observeReturnReport, readReturnReport, returnReportKey, saveReturnReport, type ReturnReportAction, type ReturnReportReceipt } from '@/lib/deepClaim/returnReport';
import { deriveNextShiftPlan, type NextShiftPlan } from '@/lib/deepClaim/nextShiftPlan';
import '@/components/deepClaim/deepClaimSession.css';
import { DeepClaimExpeditionCard } from '@/components/deepClaim/DeepClaimExpeditionCard';
import { DeepClaimRewardReceipt, type RewardReceiptData } from '@/components/deepClaim/DeepClaimRewardReceipt';
import { DeepClaimCrewDeparture } from '@/components/deepClaim/DeepClaimCrewDeparture';
import { commissionedCrew, confirmedBuildingChange, crewFocusPoint, type CrewDepartureMoment } from '@/lib/deepClaim/gameMoments';

const TABS = [{ key: 'surface', label: 'Surface' }, { key: 'mine', label: 'Mine' }, { key: 'crew', label: 'Crew' }, { key: 'stores', label: 'Stores' }, { key: 'log', label: 'Log' }, { key: 'settings', label: 'Settings' }] as const;
type Tab = typeof TABS[number]['key'];
type Reward = RewardReceiptData & { nextShiftId?: string };
function preferences(userId: string): ClaimVisualPreferences {
  const systemMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try { const value = JSON.parse(localStorage.getItem(`dh:deep-claim:visuals:v1:${userId}`) ?? 'null'); return { reducedMotion: typeof value?.reducedMotion === 'boolean' ? value.reducedMotion : systemMotion, reducedGraphics: value?.reducedGraphics === true }; }
  catch { return { reducedMotion: systemMotion, reducedGraphics: false }; }
}

export default function DeepClaimPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const assets = useClubAssets();
  const publisherEntry = useRef(false);
  const markPublisherStarted = useCallback(() => { publisherEntry.current = true; }, []);
  if (authLoading || clubLoading || assets.loading) return <main className="deep-claim"><header className="dcl-topbar"><Link to="/compete" className="dcl-icon-button" aria-label="Return to DH" data-dc-tutorial="game-exit"><ArrowLeft size={19} aria-hidden="true" /></Link><div className="dcl-brand"><small>DEEP CLAIM</small><h1>A Prospector’s Empire</h1></div></header><ClaimState title="Loading" onRetry={() => void assets.refresh()} refreshing={assets.loading} /></main>;
  if (!user || !club || !assets.isInstalled('deep-claim')) return <main className="deep-claim"><ClaimState title="This claim is outside your camp">Deep Claim needs an active club with the game installed.</ClaimState><Link className="dcl-button" to="/compete"><ArrowLeft size={16} aria-hidden="true" />Return to DH</Link></main>;
  return <DeepClaimCompany key={`${user.id}:${club.id}`} userId={user.id} clubId={club.id} clubName={club.name} publisherAvailable={!publisherEntry.current} onPublisherStarted={markPublisherStarted} />;
}

function DeepClaimCompany({ userId, clubId, clubName, publisherAvailable, onPublisherStarted }: { userId: string; clubId: string; clubName: string; publisherAvailable: boolean; onPublisherStarted: () => void }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const requestedLink = useMemo(() => deepClaimLink(new URLSearchParams(query), clubId), [query, clubId]);
  const operation = useDeepClaim();
  const data = operation.data;
  const company = data?.company;
  const companyPresent = !!company;
  const companyId = company?.id;
  const planScope = useMemo(() => companyId ? { userId, clubId, companyId } : null, [userId, clubId, companyId]);
  const planKey = planScope ? companyPlanKey(planScope) : '';
  const reportKey = planScope ? returnReportKey(planScope) : '';
  const [plannedGoal, setPlannedGoal] = useState<{ key: string; ref: CompanyGoalRef | null }>({ key: '', ref: null });
  const [goalPlanner, setGoalPlanner] = useState(false);
  const [officeReview, setOfficeReview] = useState<{ kind: 'research' | 'contract' | 'milestone'; key: string } | undefined>();
  const [reportReceipt, setReportReceipt] = useState<{ key: string; value: ReturnReportReceipt | null }>({ key: '', value: null });
  const [returnReportOpen, setReturnReportOpen] = useState(false);
  const [manualReport, setManualReport] = useState(false);
  const reportVisit = useRef(false);
  const [screen, setScreen] = useState<'title' | 'founding' | 'game'>('title');
  const [publisherOpening, setPublisherOpening] = useState(() => publisherAvailable && !requestedLink.office && !requestedLink.mismatch);
  const [publisherRevealing, setPublisherRevealing] = useState(false);
  const publisherVisible = publisherOpening && screen === 'title' && !requestedLink.office && !requestedLink.mismatch;
  const mainSurface = useRef<HTMLElement>(null);
  const publisherWasVisible = useRef(false);
  useLayoutEffect(() => {
    if (publisherOpening || requestedLink.office || requestedLink.mismatch) onPublisherStarted();
    if (requestedLink.office || requestedLink.mismatch || screen !== 'title') setPublisherOpening(false);
  }, [publisherOpening, requestedLink.office, requestedLink.mismatch, screen, onPublisherStarted]);
  useLayoutEffect(() => {
    const surface = mainSurface.current;
    if (surface) surface.inert = publisherVisible;
    if (!publisherVisible && publisherWasVisible.current && screen === 'title' && !requestedLink.office && !requestedLink.mismatch) {
      surface?.querySelector<HTMLButtonElement>('[data-dc-menu-action]:not(:disabled)')?.focus({ preventScroll: true });
    }
    publisherWasVisible.current = publisherVisible;
  }, [publisherVisible, screen, requestedLink.office, requestedLink.mismatch]);
  const [menuSettings, setMenuSettings] = useState(false);
  const [trainingModal, setTrainingModal] = useState(false);
  const [trainingRequest, setTrainingRequest] = useState<DeepClaimTrainingRequest | null>(null);
  const scope = useMemo(() => ({ user_id: userId, club_id: clubId, company_id: company?.id ?? null }), [userId, clubId, company?.id]);
  const training = useDeepClaimTutorial({ scope, enabled: !!data });
  const [tutorialEvents, setTutorialEvents] = useState<TutorialEvent[]>([]);
  const [workerRequest, setWorkerRequest] = useState<ClaimWorkerInspectRequest | undefined>();
  const [crewRequest, setCrewRequest] = useState<ClaimWorkforceViewRequest | undefined>();
  const [settingsRequest, setSettingsRequest] = useState<ClaimSettingsViewRequest | undefined>();
  const [tab, setTab] = useState<Tab>('surface');
  const [crewView, setCrewView] = useState<'staff' | 'hire'>('staff');
  const [storesView, setStoresView] = useState<'stock' | 'workshop'>('stock');
  const [office, setOffice] = useState(false);
  const [officeResearch, setOfficeResearch] = useState<string | undefined>();
  const [officeView, setOfficeView] = useState<ClaimBusinessView>('company');
  const [clubView, setClubView] = useState<ClaimClubView>('projects');
  const [clubProject, setClubProject] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState('');
  const [station, setStation] = useState<DeepClaimProductionStation>('smeltery');
  const [selectedTile, setSelectedTile] = useState<DeepClaimPoint | null>(null);
  const [fieldOperations, setFieldOperations] = useState<{ point: DeepClaimPoint | null } | null>(null);
  const [fieldView, setFieldView] = useState<ClaimFieldView>('finds');
  const [selectedFindId, setSelectedFindId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; point: DeepClaimPoint } | undefined>();
  const [dispatch, setDispatch] = useState<{ mode: DeepClaimMode; target: DeepClaimPoint | null; plan?: NextShiftPlan } | null>(null);
  const [buildings, setBuildings] = useState(false);
  const [building, setBuilding] = useState<DeepClaimBuildingId | null>(null);
  const [sale, setSale] = useState<DeepClaimResourceId | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [haul, setHaul] = useState<string | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [departure, setDeparture] = useState<(CrewDepartureMoment & { revision: number }) | null>(null);
  const [revealTarget, setRevealTarget] = useState<{ scope: string; id: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const revealReceipt = useRef<{ key: string; value: DiscoveryRevealReceipt } | null>(null);
  const revealedThisVisit = useRef(false);
  const [localError, setLocalError] = useState('');
  const [dismissedError, setDismissedError] = useState('');
  const [visuals, setVisuals] = useState(() => preferences(userId));
  const [, tick] = useState(0);
  const active = useRef(true);
  const notificationOpened = useRef(false);
  const id = useId();
  const audio = useMemo(() => createDeepClaimAudio(userId), [userId]);
  const audioLease = useMemo(() => ({ audio, owners: 0 }), [audio]);
  const titleSoundPlayed = useRef(false);
  useEffect(() => {
    active.current = true; audioLease.owners++;
    return () => {
      active.current = false; audioLease.owners--;
      // StrictMode immediately reacquires this same controller. A real route or
      // identity departure releases its own lease and closes it after the turn.
      queueMicrotask(() => { if (audioLease.owners === 0) audioLease.audio.dispose(); });
    };
  }, [audioLease]);
  useEffect(() => { if (screen !== 'game') return; const timer = window.setInterval(() => { if (document.visibilityState === 'visible') tick(value => value + 1); }, 1000); return () => clearInterval(timer); }, [screen]);
  const now = operation.serverNow();
  const ready = data?.expeditions.filter(job => job.status === 'ready') ?? [];
  const live = data?.expeditions.filter(job => job.status !== 'collected') ?? [];
  const world = data?.world ?? null;
  const infrastructure = data?.infrastructure;
  const extractionTargets = useMemo(() => claimTargets({ world, infrastructure }, 'extract'), [world, infrastructure]);
  const phase2 = !!data && data.schema_version >= 2;
  const phase3 = !!data && data.schema_version >= 3;
  const phase4 = !!data && data.schema_version >= 4;
  const pendingFinds = data?.discovery_summary?.pending ?? 0;
  const findsAtCapacity = pendingFinds >= (data?.field_catalog?.caps.pending_dispatch ?? 24);
  const productionReady = data?.production_jobs?.filter(job => job.status === 'ready') ?? [];
  const chosenBuilding = data?.buildings.find(item => item.key === building);
  // Frozen at open: a refreshed snapshot must be re-reviewed before Confirm is enabled.
  const [buildingReview, setBuildingReview] = useState<{ key: DeepClaimBuildingId; level: number; cost: number | null } | null>(null);
  useEffect(() => { if (!building) setBuildingReview(null); else setBuildingReview(review => review?.key === building ? review : chosenBuilding ? { key: building, level: chosenBuilding.level, cost: chosenBuilding.upgrade_cost ?? null } : null); }, [building, chosenBuilding]);
  const buildingReviewStale = !!buildingReview && !!chosenBuilding && (buildingReview.level !== chosenBuilding.level || buildingReview.cost !== (chosenBuilding.upgrade_cost ?? null));
  // Synchronous latch: rejects rapid double taps before the busy state renders.
  const actionLatch = useRef(false);
  async function latched<T>(run: () => Promise<T>): Promise<T | undefined> { if (actionLatch.current) return undefined; actionLatch.current = true; try { return await run(); } finally { actionLatch.current = false; } }
  const deep = data?.schema_version === 5 ? data.deep_catalog : undefined;
  const requiresDeepResearch = !!deep && chosenBuilding?.key === 'mine_shaft' && chosenBuilding.level + 1 === deep.shaft.max_level;
  const missingDeepResearch = requiresDeepResearch ? deep.shaft.required_research.filter(key => !data?.business?.research.some(order => order.key === key && order.status === 'completed')) : [];
  const upgradeShortfall = chosenBuilding?.upgrade_cost != null && company ? Math.max(0, chosenBuilding.upgrade_cost + 2 - company.cash) : 0;
  const chosenHaul = data?.expeditions.find(item => item.id === haul);
  useEffect(() => { if (haul && data && !operation.busy && (!chosenHaul || chosenHaul.status !== 'ready')) setHaul(null); }, [haul, data, chosenHaul, operation.busy]);
  const stock = sale && data ? resourceQuantity(data.resources, sale) : 0;
  const saleValid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= stock;
  const canWrite = !operation.readOnly && !operation.busy;
  const sceneVisible = screen === 'game' && (tab === 'surface' || tab === 'mine');
  const revealScope = company ? discoveryRevealKey(userId, clubId, company.id) : '';
  const revealedFind = revealTarget?.scope === revealScope ? data?.discoveries?.find(find => find.id === revealTarget.id && find.status === 'pending') ?? null : null;
  useLayoutEffect(() => { setRevealTarget(null); revealReceipt.current = null; revealedThisVisit.current = false; }, [revealScope]);
  const ownDialogOpen = !!(office || fieldOperations || dispatch || buildings || building || sale || haul || reward || revealedFind || goalPlanner || returnReportOpen);
  const occluded = ownDialogOpen || dialogOpen;
  useEffect(() => {
    if (!departure) return;
    const current = data?.expeditions.find(job => job.id === departure.job.id);
    if (screen !== 'game' || company?.id !== departure.companyId || trainingModal || training.progress.campaign_status === 'active'
      || office || fieldOperations || buildings || building || sale || haul || reward || revealedFind || goalPlanner || returnReportOpen
      || data && data.revision >= departure.revision && (!current || current.status !== 'active')) setDeparture(null);
  }, [departure, data, screen, company?.id, trainingModal, training.progress.campaign_status, office, fieldOperations, buildings, building, sale, haul, reward, revealedFind, goalPlanner, returnReportOpen]);
  useEffect(() => { audio.setBackgroundPaused?.(publisherVisible || screen === 'game' && (occluded || !sceneVisible)); if (screen !== 'game') audio.setScene({ view: 'surface', depth: 0 }); }, [audio, occluded, sceneVisible, screen, publisherVisible]);
  useLayoutEffect(() => { setTutorialEvents([]); }, [scope.company_id]);
  const currentError = localError || operation.error;
  const freeCrewSlot = !!company && live.filter(job => job.status === 'active').length < company.crew_slots;
  useEffect(() => {
    if (requestedLink.mismatch) { notificationOpened.current = false; setOffice(false); setClubProject(null); setLinkMessage('This notification belongs to a different club. You are still viewing your current company.'); return; }
    setLinkMessage('');
    if (requestedLink.office && phase4 && companyPresent) { notificationOpened.current = true; setScreen('game'); setOfficeView(requestedLink.office); setOffice(true); setClubView(requestedLink.view); setClubProject(requestedLink.project); }
    else if (!requestedLink.office && notificationOpened.current) { notificationOpened.current = false; setOffice(false); setClubProject(null); }
  }, [requestedLink, phase4, companyPresent]);
  function clearNotificationLink() { const next = new URLSearchParams(params); ['club', 'office', 'view', 'project'].forEach(key => next.delete(key)); setParams(next, { replace: true }); setOffice(false); setClubProject(null); setLinkMessage(''); }
  const introAvailable = !!data && claimIntroAvailable(data);
  const firstHaulCollected = !!data?.expeditions.some(job => job.tutorial && job.status === 'collected');
  const coreBuildings = ['mine_office', 'mine_shaft', 'warehouse', 'tool_station'];
  const firstUpgradePending = !!data?.buildings.length && data.buildings.every(item => coreBuildings.includes(item.key) ? item.level === 1 : item.level === 0);
  const firstSaleConfirmed = hasVerifiedSale({ snapshot: data, scope, progress: training.progress, events: tutorialEvents });
  const saleDecisionReviewed = firstSaleConfirmed || training.progress.reviewed_lessons.includes('beginner.sale');
  const sellFirstHaul = firstHaulCollected && firstUpgradePending && !live.length && !saleDecisionReviewed && resourceTotal(data?.resources ?? {}) > 0;
  const reviewFirstUpgrade = firstHaulCollected && firstUpgradePending && !live.length && (saleDecisionReviewed || resourceTotal(data?.resources ?? {}) === 0);
  const selectedGoal = plannedGoal.key === planKey ? plannedGoal.ref : null;
  const goal = useMemo(() => data && selectedGoal ? evaluateCompanyGoal(data, selectedGoal) : null, [data, selectedGoal]);
  const pendingReport = useMemo(() => data && planScope && reportReceipt.key === reportKey ? observeReturnReport(reportReceipt.value, data, planScope).report : null, [data, planScope, reportReceipt, reportKey]);
  const currentReport = useMemo(() => data && planScope ? currentReturnReport(data, planScope) : null, [data, planScope]);
  const visibleReport = manualReport ? currentReport : pendingReport;
  const nextShiftSource = reward?.nextShiftId ? data?.expeditions.find(job => job.id === reward.nextShiftId) : undefined;
  const nextShift = data && nextShiftSource ? deriveNextShiftPlan(data, nextShiftSource).plan : null;

  useEffect(() => {
    if (!data || !planScope || plannedGoal.key === planKey) return;
    setPlannedGoal({ key: planKey, ref: readCompanyPlan(planScope, data) });
  }, [data, planScope, plannedGoal.key, planKey]);
  useEffect(() => {
    if (!data || !planScope || operation.readOnly || operation.pendingAction || reportReceipt.key === reportKey) return;
    const observed = observeReturnReport(readReturnReport(reportKey), data, planScope);
    setReportReceipt({ key: reportKey, value: observed.receipt });
    if (observed.receipt) saveReturnReport(reportKey, observed.receipt);
  }, [data, planScope, reportKey, reportReceipt.key, operation.readOnly, operation.pendingAction]);
  useEffect(() => {
    reportVisit.current = false; setReturnReportOpen(false); setManualReport(false);
  }, [reportKey]);
  useEffect(() => {
    if (screen !== 'game') { reportVisit.current = false; return; }
    if (reportVisit.current || !data || !planScope || reportReceipt.key !== reportKey || operation.readOnly || operation.pendingAction || operation.busy) return;
    if (!pendingReport) { reportVisit.current = true; return; }
    if (ownDialogOpen || dialogOpen || trainingModal || training.progress.campaign_status === 'active' || introAvailable || requestedLink.office) return;
    reportVisit.current = true; setManualReport(false); setReturnReportOpen(true);
  }, [screen, data, planScope, reportReceipt.key, reportKey, operation.readOnly, operation.pendingAction, operation.busy, pendingReport, ownDialogOpen, dialogOpen, trainingModal, training.progress.campaign_status, introAvailable, requestedLink.office]);
  useEffect(() => { if (returnReportOpen && !visibleReport) setReturnReportOpen(false); }, [returnReportOpen, visibleReport]);

  useEffect(() => {
    if (!data?.company || operation.readOnly || operation.pendingAction) return;
    const key = discoveryRevealKey(userId, clubId, data.company.id);
    const previous = revealReceipt.current?.key === key ? revealReceipt.current.value : readDiscoveryReveals(key);
    const value = observeDiscoveryReveals(previous, data.discoveries ?? [], data.server_now);
    revealReceipt.current = { key, value }; saveDiscoveryReveals(key, value);
    if (!sceneVisible || occluded || revealedThisVisit.current) return;
    const find = nextDiscoveryReveal(value, data.discoveries ?? []);
    if (!find) return;
    revealedThisVisit.current = true;
    const marked = markDiscoveryRevealed(value, find.id, data.discoveries ?? []);
    revealReceipt.current = { key, value: marked }; saveDiscoveryReveals(key, marked);
    setRevealTarget({ scope: key, id: find.id }); audio.play('complete');
  }, [data, operation.readOnly, operation.pendingAction, userId, clubId, sceneVisible, occluded, audio]);

  function changeVisuals(patch: Partial<ClaimVisualPreferences>) {
    setVisuals(before => { const next = { ...before, ...patch }; try { localStorage.setItem(`dh:deep-claim:visuals:v1:${userId}`, JSON.stringify(next)); } catch { /* Device preferences still work without storage. */ } return next; });
  }
  const observe = useCallback((type: TutorialEventType, detail?: TutorialEventDetail) => {
    if (!scope.company_id) return;
    const event: TutorialEvent = { ...scope, type, at: new Date().toISOString(), ...(detail ? { detail } : {}) };
    setTutorialEvents(before => {
      const last = before[before.length - 1];
      return last?.type === event.type && JSON.stringify(last.detail) === JSON.stringify(event.detail) ? before : [...before.slice(-255), event];
    });
  }, [scope]);
  function confirmed(type: TutorialEventType, updated: import('@/lib/deepClaim/types').DeepClaimSnapshot, detail?: TutorialEventDetail) {
    const owner = updated.company;
    if (!owner || owner.user_id !== userId || owner.club_id !== clubId) return;
    setTutorialEvents(before => [...before.slice(-255), { user_id: userId, club_id: clubId, company_id: owner.id, type, at: updated.server_now, snapshot_revision: updated.revision, ...(detail ? { detail } : {}) }]);
  }
  function tracked<Args extends unknown[]>(action: (...args: Args) => Promise<import('@/lib/deepClaim/types').DeepClaimSnapshot>, type: TutorialEventType, detail?: (...args: Args) => TutorialEventDetail | null) {
    return async (...args: Args) => { const updated = await action(...args); const info = detail?.(...args); if (info !== null) confirmed(type, updated, info); return updated; };
  }
  const teachingActions = { ...operation,
    hire: tracked(operation.hire, 'hire_confirmed', id => ({ record_id: id })),
    train: tracked(operation.train, 'training_confirmed', (id, stat) => ({ worker_id: id, stat })),
    assignEquipment: tracked(operation.assignEquipment, 'equipment_confirmed', (id, workerId) => workerId ? ({ record_id: id, worker_id: workerId }) : null),
    repairEquipment: tracked(operation.repairEquipment, 'repair_confirmed', id => ({ record_id: id })),
    startProduction: tracked(operation.startProduction, 'production_confirmed', recipe => ({ recipe_key: recipe })),
    resolveDiscovery: tracked(operation.resolveDiscovery, 'discovery_confirmed', (id, choice) => ({ record_id: id, view: choice })),
    startResearch: tracked(operation.startResearch, 'research_confirmed', key => ({ record_id: key, view: 'started' })),
    fulfillContract: tracked(operation.fulfillContract, 'contract_confirmed', key => ({ record_id: key })),
    claimMilestone: tracked(operation.claimMilestone, 'milestone_confirmed', key => ({ record_id: key })),
    contributeProject: tracked(operation.contributeProject, 'club_contribution_confirmed', key => ({ record_id: key })),
    claimProject: tracked(operation.claimProject, 'club_claim_confirmed', key => ({ record_id: key })),
    setSocialPreferences: tracked(operation.setSocialPreferences, 'preferences_confirmed', input => ({ view: input.showcase_enabled && input.featured_discovery_ids.length > 0 ? 'showcase_published' : input.standings_enabled ? 'standings_enabled' : 'private' })),
  };
  function trainingCommand(kind: DeepClaimTrainingRequest['kind'], lessonId?: TutorialLessonId) { setTrainingRequest({ id: crypto.randomUUID(), kind, ...(lessonId ? { lessonId } : {}) }); }
  function closeGameDialogs() { setDeparture(null); setOffice(false); setFieldOperations(null); setDispatch(null); setBuildings(false); setBuilding(null); setSale(null); setHaul(null); setReward(null); setRevealTarget(null); setOfficeResearch(undefined); setOfficeReview(undefined); setClubProject(null); setSelectedFindId(null); setGoalPlanner(false); setReturnReportOpen(false); }
  function mainMenu() {
    if (operation.busy) { setLocalError('Wait for the current confirmation before returning to the main menu.'); return; }
    training.update({ campaign_status: training.progress.campaign_status === 'active' ? 'paused' : training.progress.campaign_status });
    closeGameDialogs(); setMenuSettings(false); setScreen('title'); observe('main_menu_opened'); audio.play('menu_back');
  }
  async function menuInteraction() { if (await audio.unlock()) { audio.play(titleSoundPlayed.current ? 'menu_select' : 'title'); titleSoundPlayed.current = true; } }
  function tutorialNavigate(action: TutorialOpenAction) {
    if (operation.busy) return;
    if (action.type === 'journal') { trainingCommand('journal', action.lesson_id); return; }
    if (action.type === 'main_menu') { mainMenu(); return; }
    if (action.type === 'return_to_club') { observe('exit_reviewed'); return; }
    if (action.type === 'found_company') { if (!company && data && !operation.readOnly) setScreen('founding'); else setScreen('game'); return; }
    if (!company || !data) { trainingCommand('replay', 'beginner.claim'); return; }
    setScreen('game'); setWorkerRequest(undefined); setCrewRequest(undefined); setSettingsRequest(undefined);
    if (action.type === 'tab') {
      if (action.tab !== tab) closeGameDialogs();
      setTab(action.tab); observe('tab_opened', { tab: action.tab, ...(action.view ? { view: action.view } : {}) });
      if (action.tab === 'surface' && action.view === 'buildings') { setBuilding(null); setBuildings(true); }
      if (action.tab === 'surface' && action.view === 'returns') { const returned = data.expeditions.find(job => job.status === 'ready'); if (returned) setHaul(returned.id); }
      if (action.tab === 'crew') { setCrewView(action.view === 'hire' ? 'hire' : 'staff'); setCrewRequest({ id: crypto.randomUUID(), view: action.view === 'hire' ? 'hire' : 'staff' }); }
      if (action.tab === 'stores') { setStoresView(action.view === 'workshop' ? 'workshop' : 'stock'); if (action.station) setStation(action.station); }
      if (action.tab === 'log') { setSelectedFindId(null); setFieldView(action.view === 'reports' ? 'reports' : 'finds'); }
      if (action.tab === 'settings') setSettingsRequest({ id: crypto.randomUUID(), view: action.view === 'updates' ? 'updates' : action.view === 'visuals' ? 'visuals' : 'sound' });
    } else if (action.type === 'office') { closeGameDialogs(); setOfficeView(action.view); setClubView(action.club_view ?? 'projects'); setOffice(true); }
    else if (action.type === 'building') { closeGameDialogs(); setTab('surface'); setBuilding(action.building); observe('building_inspected', { building_key: action.building }); }
    else if (action.type === 'worker') { closeGameDialogs(); setTab('crew'); const worker = data.workers.find(worker => action.name ? worker.name === action.name : action.specialty ? worker.specialty === action.specialty : true); if (worker) setWorkerRequest({ id: crypto.randomUUID(), workerId: worker.id, view: action.view ?? 'overview' }); }
    else if (action.type === 'dispatch') { if (!dispatch || action.mode && dispatch.mode !== action.mode) { closeGameDialogs(); const mode = action.mode ?? 'extract'; openDispatch(mode, introAvailable && mode === 'extract' ? { x: 47, y: 1 } : null); } observe('dispatch_opened'); }
  }
  function openDispatch(mode: DeepClaimMode, point: DeepClaimPoint | null = selectedTile) {
    if (!data?.company) return;
    setLocalError(''); setDispatch({ mode, target: point ?? claimTargets(data, mode)[0] ?? null });
    observe('dispatch_opened', { mode });
  }
  function openFinds(id: string | null = null) { setFieldOperations(null); setFieldView('finds'); setSelectedFindId(id); setTab('log'); }
  function locateSite(point: DeepClaimPoint) { setFieldOperations(null); setSelectedFindId(null); setTab('mine'); setSelectedTile({ x: point.x, y: point.y }); setFocusRequest({ id: crypto.randomUUID(), point: { x: point.x, y: point.y } }); observe('map_interacted', { interaction: 'focus' }); if (data?.world?.tiles.some(tile => tile.x === point.x && tile.y === point.y)) observe('worksite_inspected'); }
  function followCrew(job: DeepClaimExpedition) {
    if (!data) return;
    const point = crewFocusPoint(data, job, now);
    if (point) { setDeparture(null); locateSite(point); audio.play('menu_select'); }
  }
  function selectMapTile(point: DeepClaimPoint) {
    setSelectedTile(point);
    observe('map_interacted', { interaction: 'select' });
    if (data?.world?.tiles.some(tile => tile.x === point.x && tile.y === point.y)) observe('worksite_inspected');
    const find = data?.discoveries?.find(item => item.x === point.x && item.y === point.y && item.status === 'pending');
    if (phase3 && find) { openFinds(find.id); return; }
    const tile = data?.world?.tiles.find(item => item.x === point.x && item.y === point.y);
    if (phase3 && tile?.remaining === 0) { setFieldOperations({ point }); return; }
    openDispatch(tile?.material && tile.remaining > 0 ? 'extract' : 'explore', point);
  }
  function openOffice(view: ClaimBusinessView = 'company', researchKey?: string) { setOfficeReview(undefined); setOfficeResearch(researchKey); setOfficeView(view); setOffice(true); setBuildings(false); setBuilding(null); }
  function pinCompanyGoal(ref: CompanyGoalRef) {
    if (!data || !planScope || !evaluateCompanyGoal(data, ref)) return;
    saveCompanyPlan(planScope, data, ref);
    setPlannedGoal({ key: planKey, ref }); setGoalPlanner(false); audio.play('menu_select');
  }
  function reviewCompanyGoal(ref: CompanyGoalRef) {
    if (!data || !evaluateCompanyGoal(data, ref)) return;
    closeGameDialogs();
    if (ref.kind === 'building') { setTab('surface'); setBuilding(ref.key); observe('building_inspected', { building_key: ref.key }); }
    else { setOfficeReview({ kind: ref.kind, key: ref.key }); setOfficeView(ref.kind === 'research' ? 'research' : ref.kind === 'contract' ? 'contracts' : 'records'); setOffice(true); }
  }
  function dismissReturnReport() {
    if (data && planScope && reportReceipt.key === reportKey) {
      const receipt = acknowledgeReturnReport(reportReceipt.value, data, planScope);
      setReportReceipt({ key: reportKey, value: receipt });
      if (receipt) saveReturnReport(reportKey, receipt);
    }
    setReturnReportOpen(false); setManualReport(false);
  }
  function reviewReturn(action: ReturnReportAction) {
    dismissReturnReport();
    if (action.kind === 'haul') { if (data?.expeditions.some(job => job.id === action.id && job.status === 'ready')) setHaul(action.id); }
    else if (action.kind === 'production') openWorkshop(action.station);
    else if (action.kind === 'finds') openFinds();
    else openOffice('research', action.key);
  }
  function planNextShift() {
    if (!data || !nextShiftSource || !canWrite) return;
    const result = deriveNextShiftPlan(data, nextShiftSource);
    if (!result.plan) { setLocalError(result.reasons[0] ?? 'Review the current camp before planning another shift.'); return; }
    setReward(null); setLocalError(''); setDispatch({ mode: result.plan.mode, target: result.plan.target, plan: result.plan });
    observe('dispatch_opened', { mode: result.plan.mode });
  }
  function openWorkshop(key: DeepClaimProductionStation) { setStation(key); setStoresView('workshop'); setTab('stores'); setBuilding(null); setBuildings(false); }
  function openSurfaceBuilding(key: DeepClaimBuildingId) {
    setLocalError('');
    const current = data?.buildings.find(item => item.key === key);
    if (current) observe('building_inspected', { building_key: key });
    if (phase4 && current && current.level > 0 && (key === 'mine_office' || key === 'research_office' || key === 'trading_post')) openOffice(key === 'research_office' ? 'research' : key === 'trading_post' ? 'contracts' : 'company');
    else if (phase2 && current && current.level > 0 && (key === 'smeltery' || key === 'gem_workshop' || key === 'tool_station')) openWorkshop(key);
    else if (phase2 && key === 'mine_office' && current && current.level > 0) { setCrewView('hire'); setTab('crew'); }
    else setBuilding(key);
  }
  function managementConfirmed(title: string, description: string) { if (active.current) { setReward({ title, description }); audio.play('complete'); } }
  async function collectProduction(job: DeepClaimProductionJob) {
    if (!data || !canWrite || actionLatch.current) return;
    actionLatch.current = true;
    try {
    const owned = new Set(data.equipment?.map(item => item.id) ?? []);
    const updated = await operation.collectProduction(job.id);
    if (!active.current) return;
    const nextJob = updated.production_jobs?.find(item => item.id === job.id);
    const remaining = nextJob?.status === 'ready' ? nextJob.outputs : {};
    const resources = Object.fromEntries(DEEP_CLAIM_RESOURCE_IDS.map(key => [key, Math.max(0, resourceQuantity(job.outputs, key) - resourceQuantity(remaining, key))]).filter(([, quantity]) => Number(quantity) > 0)) as DeepClaimResources;
    const equipment = updated.equipment?.filter(item => !owned.has(item.id)).flatMap(item => { const definition = updated.equipment_catalog?.find(value => value.key === item.definition_key); return definition ? [{ id: item.id, key: definition.key, name: definition.name, tier: definition.tier }] : []; });
    if (resourceTotal(resources) > 0 || equipment?.length) confirmed('production_collected', updated, { job_id: job.id, recipe_key: job.recipe_key, moved: resources, quantity: resourceTotal(resources) + (equipment?.length ?? 0) });
    if (resourceTotal(resources) > 0 || equipment?.length) { setReward({ title: 'Production secured.', description: resourceTotal(remaining) ? 'Part of the output moved to your company; the rest stays staged until Stores has room.' : 'Collected output is now owned by your company.', resources, equipment, remaining: resourceTotal(remaining) }); audio.play('deposit'); }
    else setReward({ title: 'Nothing collected.', description: resourceTotal(remaining) ? 'Stores is full. Make room in Stores, then collect the staged output.' : 'Your company is up to date.', remaining: resourceTotal(remaining) });
    } finally { actionLatch.current = false; }
  }
  async function bootstrap(name: string) {
    if (!canWrite || name.trim().length < 2 || company) return;
    setLocalError(''); setDismissedError('');
    try { const updated = await operation.bootstrap(name); if (active.current && updated.company) { confirmed('company_confirmed', updated); setScreen('game'); trainingCommand('welcome'); audio.play('building'); } }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The company could not be founded. Retry sync.'); throw error; }
  }
  async function collect() {
    if (!chosenHaul || !canWrite || actionLatch.current) return;
    actionLatch.current = true;
    const original = chosenHaul.cargo ?? {};
    setLocalError(''); setDismissedError('');
    try {
      const updated = await operation.collect(chosenHaul.id);
      if (!active.current) return;
      const updatedHaul = updated.expeditions.find(job => job.id === chosenHaul.id);
      const remaining = updatedHaul?.status === 'ready' ? updatedHaul.cargo ?? {} : {};
      const moved = Object.fromEntries(DEEP_CLAIM_RESOURCE_IDS.map(key => [key, Math.max(0, resourceQuantity(original, key) - resourceQuantity(remaining, key))]).filter(([, amount]) => Number(amount) > 0)) as DeepClaimResources;
      if (resourceTotal(moved) > 0) confirmed('haul_collected', updated, { job_id: chosenHaul.id, moved, quantity: resourceTotal(moved) });
      setHaul(null); setReward({ title: resourceTotal(moved) ? 'Haul secured.' : 'Camp updated.', description: resourceTotal(moved) ? 'Cargo added to your warehouse.' : 'No cargo moved. Check your staged haul.', resources: moved, remaining: resourceTotal(remaining), ...(resourceTotal(moved) > 0 && !resourceTotal(remaining) && updatedHaul?.status === 'collected' ? { nextShiftId: updatedHaul.id } : {}) }); if (resourceTotal(moved)) audio.play('deposit');
    } catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The haul could not be confirmed. Retry sync.'); }
    finally { actionLatch.current = false; }
  }
  async function sell() {
    if (!sale || !saleValid || !canWrite) return;
    setLocalError(''); setDismissedError('');
    await latched(async () => { try { const updated = await operation.sell({ resource_key: sale, quantity }); if (active.current) { confirmed('sale_confirmed', updated, { resource_key: sale, quantity }); setSale(null); setReward({ title: 'Trade recorded.', description: 'Warehouse and balance updated.', cash: updated.company?.cash }); audio.play('deposit'); } }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The sale could not be confirmed. Retry sync.'); } });
  }
  async function upgrade() {
    if (!data || !chosenBuilding || !canWrite || missingDeepResearch.length > 0) return;
    if (buildingReviewStale) { setLocalError('This building changed while you were reviewing it. Review the current upgrade first.'); return; }
    setLocalError(''); setDismissedError('');
    await latched(async () => { try { const updated = await operation.upgrade(chosenBuilding.key); if (active.current) { const buildingChange = confirmedBuildingChange(data, updated, chosenBuilding.key); confirmed('upgrade_confirmed', updated, { building_key: chosenBuilding.key }); setBuilding(null); setReward({ title: buildingChange ? `${BUILDING_INFO[chosenBuilding.key].name} ${buildingChange.fromLevel === 0 ? 'built' : 'upgraded'}.` : 'Camp updated.', description: buildingChange ? '' : 'Your company is up to date.', ...(buildingChange ? { buildingChange } : {}) }); audio.play(buildingChange ? buildingChange.fromLevel === 0 ? 'building' : 'upgrade' : 'menu_select'); } }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The upgrade could not be confirmed. Retry sync.'); } });
  }
  async function retrySaved() {
    setLocalError(''); setDismissedError('');
    const pendingKind = operation.pendingAction;
    try { const updated = await operation.retryPending(); if (active.current) { if (updated?.company) { setScreen('game'); if (screen === 'founding' || pendingKind === 'Create company') trainingCommand('welcome'); } setReward({ title: 'Saved action confirmed.', description: 'Your company is up to date.' }); } }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'Still unable to confirm. Your request remains saved.'); }
  }

  return <DeepClaimTutorialEventsProvider value={{ emit: observe, openJournal: lessonId => trainingCommand('journal', lessonId), askGus: () => trainingCommand('advice'), mainMenu,
    ...(company ? { commentaryEnabled: training.progress.commentary_enabled, onCommentaryChange: (enabled: boolean) => training.update({ commentary_enabled: enabled }) } : {}),
    scopeKey: `${userId}:${clubId}:${company?.id ?? ''}:${training.progress.active_step_id ?? ''}` }}><ClaimDialogScope onOpenChange={setDialogOpen}><main ref={mainSurface} aria-hidden={publisherVisible || undefined} className="deep-claim" data-testid="deep-claim-shell" data-reduced-motion={visuals.reducedMotion}>
    {screen === 'game' ? <>
    <header className="dcl-topbar"><Link to="/compete" className="dcl-icon-button" aria-label="Return to DH" data-dc-tutorial="game-exit"><ArrowLeft size={19} aria-hidden="true" /></Link><div className="dcl-brand"><small>DEEP CLAIM</small><h1>{company?.name ?? 'A Prospector’s Empire'}</h1></div>{company && <div className="dcl-top-money"><strong aria-label={`${company.cash.toLocaleString()} company credits`}><Coins size={14} aria-hidden="true" />{company.cash.toLocaleString()}</strong><small>{company.warehouse_used}/{company.warehouse_capacity} stored</small><span className="dcl-hud-stock" aria-hidden="true"><i style={{ width: `${Math.min(100, 100 * company.warehouse_used / Math.max(1, company.warehouse_capacity))}%` }} /></span></div>}<button type="button" className="dcl-icon-button" aria-label="Refresh company" disabled={operation.refreshing || operation.busy} onClick={() => void operation.refresh()}><RefreshCw size={17} className={operation.refreshing ? 'dcl-spin' : ''} aria-hidden="true" /></button></header>
    {linkMessage && <div className="dcl-action-error" role="status"><span>{linkMessage}</span><button type="button" onClick={clearNotificationLink}>Return to current company</button></div>}
    {operation.pendingAction ? <div className="dcl-offline" role="status"><span><ShieldCheck size={14} aria-hidden="true" />Saved action: {operation.pendingAction}</span><button type="button" disabled={operation.busy} onClick={() => void retrySaved()}>{operation.busy ? 'Confirming…' : 'Confirm sync'}</button></div> : operation.readOnly && data ? <div className="dcl-offline" role="status"><span><WifiOff size={14} aria-hidden="true" />Saved camp · read-only until reconnected</span><button type="button" disabled={operation.refreshing} onClick={() => void operation.refresh()}>Reconnect</button></div> : null}
    {!data ? <ClaimState error={operation.error} onRetry={() => void operation.refresh()} refreshing={operation.refreshing} /> : !company ? <ClaimState title="Opening the company" onRetry={() => void operation.refresh()}>Your confirmed company will appear after synchronization.</ClaimState> : <>
      {currentError && currentError !== dismissedError && <div className="dcl-action-error" role="alert"><span>{currentError}</span><button type="button" aria-label="Dismiss company message" onClick={() => { setDismissedError(currentError); setLocalError(''); }}>OK</button></div>}
      <div className="dcl-content">
        <div className="dcl-scene" data-dc-tutorial="map-viewport" hidden={!sceneVisible} role={sceneVisible ? 'tabpanel' : undefined} id={sceneVisible ? `${id}-panel` : undefined} aria-labelledby={`${id}-${tab}`}>
          <DeepClaimCanvas snapshot={data} view={tab === 'mine' ? 'mine' : 'surface'} selectedTile={selectedTile} onSelectTile={selectMapTile} focusRequest={focusRequest} onSelectBuilding={openSurfaceBuilding} active={sceneVisible && !occluded} reducedMotion={visuals.reducedMotion} reducedGraphics={visuals.reducedGraphics} audio={audio} onInteraction={interaction => observe('map_interacted', { interaction })} />
          <div className="dcl-map-heading"><div><h2>{tab === 'mine' ? 'Mine' : 'Camp'}</h2><p>{introAvailable ? 'Your first shift · 30 seconds' : sellFirstHaul ? 'First haul ready to sell' : reviewFirstUpgrade ? (firstSaleConfirmed ? 'First sale complete · Build your camp' : 'Haul stored · Review camp upgrades') : tab === 'mine' ? `Revealed ground · supported depth ${data.world?.max_depth ?? 0}m` : `${live.filter(job => job.status === 'active').length}/${company.crew_slots} crews working · ${ready.length + productionReady.length} ready collections`}</p></div><div className="dcl-map-tools">{phase4 && tab === 'surface' && <button type="button" className="dcl-icon-button" aria-label="Open company office" onClick={() => openOffice()}><DeepClaimBusinessIcon kind="office" decorative /></button>}<button type="button" className="dcl-icon-button" aria-label={tab === 'surface' ? 'Open camp buildings' : phase3 ? 'Open mine operations' : 'Choose a worksite from list'} onClick={() => { if (tab === 'surface') setBuildings(true); else if (phase3) setFieldOperations({ point: selectedTile }); else openDispatch('explore'); }}>{tab === 'surface' ? <Building2 size={18} aria-hidden="true" /> : <List size={18} aria-hidden="true" />}</button></div></div>
          {tab === 'surface' && !introAvailable && training.progress.campaign_status !== 'active' && <div className="dcl-session-goal"><DeepClaimGoalDock goal={goal} onOpen={() => setGoalPlanner(true)} onReview={() => { if (selectedGoal) reviewCompanyGoal(selectedGoal); }} onReport={currentReport ? () => { setManualReport(true); setReturnReportOpen(true); } : undefined} /></div>}
          <div className="dcl-map-actions">{live.length ? <div className="dcl-operation-dock">{live.map(job => <DeepClaimExpeditionCard key={job.id} job={job} snapshot={data} now={now} onFollow={followCrew} onRefresh={() => void operation.refresh()} onCollect={() => { setHaul(job.id); setLocalError(''); }} />)}<ClaimButton className="is-small" disabled={!findsAtCapacity && (!canWrite || !freeCrewSlot || ready.length + productionReady.length > 0)} onClick={() => findsAtCapacity ? openFinds() : openDispatch('explore')} aria-label={findsAtCapacity ? 'Review pending finds' : 'Dispatch another crew'}><Pickaxe size={15} aria-hidden="true" />{findsAtCapacity ? 'Review finds' : ready.length + productionReady.length ? 'Collect output first' : freeCrewSlot ? 'New shift' : 'Crews busy'}</ClaimButton></div> : <><ClaimButton primary disabled={!productionReady.length && !pendingFinds && !sellFirstHaul && !reviewFirstUpgrade && !canWrite} onClick={() => { if (productionReady.length) openWorkshop(productionReady[0].station); else if (pendingFinds) openFinds(); else if (sellFirstHaul) setTab('stores'); else if (reviewFirstUpgrade) setBuildings(true); else if (introAvailable) openDispatch('extract', { x: 47, y: 1 }); else openDispatch('explore', null); }}><Pickaxe size={16} aria-hidden="true" />{productionReady.length ? 'Collect production' : pendingFinds ? `Review finds · ${pendingFinds}` : introAvailable ? 'Start first shift · 30s' : sellFirstHaul ? 'Sell first haul' : reviewFirstUpgrade ? 'Review camp upgrades' : 'Explore'}</ClaimButton><ClaimButton disabled={!canWrite || productionReady.length > 0 || findsAtCapacity || !introAvailable && !extractionTargets.length} onClick={() => introAvailable ? openDispatch('explore', null) : openDispatch('extract', null)}><Package size={16} aria-hidden="true" />{introAvailable ? 'Explore' : 'Extract'}</ClaimButton></>}</div>
        </div>
        {!sceneVisible && <section key={tab} className="dcl-pane dcl-view-enter" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>{tab === 'crew' ? phase2 ? <DeepClaimWorkforce snapshot={data} initialView={crewView} inspectRequest={workerRequest} viewRequest={crewRequest} actions={teachingActions} busy={operation.busy} readOnly={operation.readOnly} onConfirmed={managementConfirmed} onQuarters={() => setBuilding('workers_quarters')} /> : <DeepClaimCrew snapshot={data} inspectRequest={workerRequest} /> : tab === 'stores' ? phase2 ? <DeepClaimIndustry snapshot={data} view={storesView} onView={setStoresView} station={station} onStation={setStation} busy={operation.busy} readOnly={operation.readOnly} now={now} onRefresh={() => void operation.refresh()} onBuild={setBuilding} onResearch={key => openOffice('research', key)} onSell={key => { setSale(key); setQuantity(resourceQuantity(data.resources, key)); setLocalError(''); }} onOpenHaul={id => { setHaul(id); setLocalError(''); }} startProduction={teachingActions.startProduction} collectProduction={collectProduction} onConfirmed={managementConfirmed} /> : <DeepClaimStores snapshot={data} readyHauls={ready} onOpenHaul={id => { setHaul(id); setLocalError(''); }} busy={operation.busy} readOnly={operation.readOnly} onSell={key => { setSale(key); setQuantity(resourceQuantity(data.resources, key)); setLocalError(''); }} /> : tab === 'log' ? phase3 ? <DeepClaimFieldLog snapshot={data} view={fieldView} onView={setFieldView} selectedFindId={selectedFindId} onSelectFind={setSelectedFindId} onLocate={locateSite} resolveDiscovery={teachingActions.resolveDiscovery} readOnly={operation.readOnly} busy={operation.busy} onConfirmed={managementConfirmed} /> : <DeepClaimLog snapshot={data} /> : <DeepClaimSettings viewRequest={settingsRequest} onOpenJournal={() => trainingCommand('journal')} onMainMenu={mainMenu} audio={audio} visuals={visuals} onVisualsChange={changeVisuals} onRefresh={() => void operation.refresh()} refreshing={operation.refreshing} serverTime={data.server_now} industry={phase2} field={phase3} business={phase4} deep={!!deep} />}</section>}
      </div>
      <nav className="dcl-tabs" role="tablist" aria-label="Company views" onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const current = TABS.findIndex(item => item.key === tab); const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length; setTab(TABS[next].key); setWorkerRequest(undefined); setCrewRequest(undefined); setSettingsRequest(undefined); observe('tab_opened', { tab: TABS[next].key }); document.getElementById(`${id}-${TABS[next].key}`)?.focus(); }}>{TABS.map(item => <button type="button" role="tab" id={`${id}-${item.key}`} aria-controls={`${id}-panel`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} data-dc-tutorial={`nav-${item.key}`} onClick={() => { setTab(item.key); setWorkerRequest(undefined); setCrewRequest(undefined); setSettingsRequest(undefined); observe('tab_opened', { tab: item.key }); }} key={item.key}><DeepClaimNavEmblem kind={item.key} />{item.label}{item.key === 'stores' && ready.length + productionReady.length > 0 && <b aria-label={`${ready.length + productionReady.length} collections ready`}>{ready.length + productionReady.length}</b>}{item.key === 'log' && pendingFinds > 0 && <b aria-label={`${pendingFinds} finds pending`}>{pendingFinds}</b>}</button>)}</nav>
      {phase4 && office && <DeepClaimBusiness key={officeReview ? `${officeReview.kind}:${officeReview.key}` : 'office'} snapshot={data} initialReview={officeReview} initialResearchKey={officeResearch} view={officeView} onView={setOfficeView} onClose={() => setOffice(false)} onBuild={key => { setOffice(false); setBuilding(key); }} onHire={() => { setOffice(false); setCrewView('hire'); setTab('crew'); }} onStores={() => { setOffice(false); setStoresView('stock'); setTab('stores'); }} clubContent={<DeepClaimClubSession key={clubProject ?? 'club'} snapshot={data} view={clubView} onView={setClubView} onClose={() => setOffice(false)} projectKey={clubProject} onProjectHandled={() => setClubProject(null)} actions={teachingActions} busy={operation.busy} readOnly={operation.readOnly} onConfirmed={(title, description, updated, credits) => { if (active.current) { setOffice(false); setReward({ title, description, ...(credits ? { cash: updated.company?.cash } : {}) }); audio.play('complete'); } }} />} actions={teachingActions} now={now} onRefresh={() => void operation.refresh()} busy={operation.busy} readOnly={operation.readOnly} onConfirmed={(title, description, updated) => { if (active.current) { setOffice(false); setReward({ title, description, cash: updated.company?.cash }); audio.play('complete'); } }} />}
      {goalPlanner && <DeepClaimGoalPlanner snapshot={data} selected={selectedGoal} onPin={pinCompanyGoal} onReview={reviewCompanyGoal} onClose={() => setGoalPlanner(false)} />}
      {returnReportOpen && visibleReport && <DeepClaimReturnReport report={visibleReport} onClose={dismissReturnReport} onAction={reviewReturn} />}
      {phase3 && fieldOperations && <DeepClaimOperations snapshot={data} point={fieldOperations.point} onClose={() => setFieldOperations(null)} onDispatch={(mode, point) => { setFieldOperations(null); const valid = point && claimTargets(data, mode).some(site => site.x === point.x && site.y === point.y); openDispatch(mode, valid ? point : null); }} onLocate={locateSite} onFinds={() => openFinds()} onReports={() => { setFieldOperations(null); setFieldView('reports'); setTab('log'); }} />}
      {dispatch && <DeepClaimDispatch key={`${dispatch.mode}:${dispatch.target?.x}:${dispatch.target?.y}`} snapshot={data} initialPlan={dispatch.plan} initialMode={dispatch.mode} initialTarget={dispatch.target} onClose={() => setDispatch(null)} readOnly={operation.readOnly} busy={operation.busy} preview={operation.preview} dispatch={async (input, revision) => { const updated = await operation.dispatch(input, revision); if (active.current) { if (input.mode === 'explore' || input.mode === 'extract') confirmed('expedition_confirmed', updated, { mode: input.mode }); const moment = commissionedCrew(data, updated, input); if (moment && training.progress.campaign_status !== 'active') setDeparture({ ...moment, revision: updated.revision }); audio.play('dispatch'); } return updated; }} />}
      <ClaimDialog open={buildings} onClose={() => setBuildings(false)} title="Buildings" description=""><div className="dcl-building-list" data-dc-tutorial="buildings-list">{data.buildings.map(item => <button type="button" key={item.key} onClick={() => { setBuildings(false); setBuilding(item.key); setLocalError(''); observe('building_inspected', { building_key: item.key }); }}><DeepClaimBuildingPortrait buildingId={item.key} level={item.level} decorative /><span><strong>{BUILDING_INFO[item.key].name}</strong><small>{item.level === 0 ? 'Unbuilt plot' : `Level ${item.level}`} · {item.effect}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div></ClaimDialog>
      <ClaimDialog open={!!building} onClose={() => setBuilding(null)} busy={operation.busy} title={building ? BUILDING_INFO[building].name : 'Camp building'} description="" footerNote={chosenBuilding && chosenBuilding.upgrade_cost != null && <><span>{chosenBuilding.level === 0 ? 'Build cost' : 'Upgrade cost'} · 2 cr reserve</span><strong>{chosenBuilding.upgrade_cost.toLocaleString()} cr</strong></>} footer={chosenBuilding && <div className="dcl-dialog-actions"><ClaimButton disabled={operation.busy} onClick={() => setBuilding(null)}>Back to camp</ClaimButton>{chosenBuilding.upgrade_cost != null && (buildingReviewStale ? <ClaimButton primary disabled={operation.busy} onClick={() => { setBuildingReview({ key: chosenBuilding.key, level: chosenBuilding.level, cost: chosenBuilding.upgrade_cost ?? null }); setLocalError(''); }}>Review current upgrade</ClaimButton> : <ClaimButton primary pending={operation.busy} disabled={!canWrite || upgradeShortfall > 0 || missingDeepResearch.length > 0} onClick={() => void upgrade()}>{chosenBuilding.level === 0 ? 'Confirm build' : 'Confirm upgrade'}</ClaimButton>)}</div>}>{chosenBuilding && <div data-dc-tutorial="building-review"><div className="dcl-building-hero"><DeepClaimBuildingPortrait buildingId={chosenBuilding.key} level={chosenBuilding.level} /><div><ClaimBadge>{chosenBuilding.level === 0 ? 'Unbuilt plot' : `Level ${chosenBuilding.level} / ${chosenBuilding.max_level}`}</ClaimBadge><ClaimMeter value={chosenBuilding.level} max={chosenBuilding.max_level} label={`${BUILDING_INFO[chosenBuilding.key].name} building level`} />{chosenBuilding.level >= chosenBuilding.max_level && <small>Maxed</small>}</div></div><p className="dcl-note">{chosenBuilding.effect}</p>{deep && chosenBuilding.key === 'mine_shaft' && chosenBuilding.level === deep.shaft.max_level && <p className="dcl-note">Powered shaft lift: up to {data.deep_operations?.lift_discount_percent ?? 0}% travel saving on the known constructed central shaft. Each verified route shows its actual saving. Current infrastructure capacity: {data.deep_operations?.infrastructure_capacity}.</p>}{chosenBuilding.upgrade_cost != null ? <><div className="dcl-trade-summary"><span>{chosenBuilding.level === 0 ? 'Build level 1' : `Next level ${chosenBuilding.level + 1}`}<small>{buildingEffect(chosenBuilding.key, chosenBuilding.level + 1)}</small></span><strong>{chosenBuilding.upgrade_cost.toLocaleString()} cr</strong></div>{requiresDeepResearch && deep && <section className="dcl-deep-upgrade" aria-label="Ancient Deep shaft requirements"><h3>{deep.name}</h3><p>Level {deep.shaft.max_level} opens supported depth {deep.shaft.max_depth}m, a constructed shaft to {deep.shaft.corridor_depth}m and a powered lift on known shaft travel. Infrastructure capacity rises to {deep.infrastructure.deep_capacity}.</p>{deep.shaft.required_research.map(key => <p key={key} data-complete={!missingDeepResearch.includes(key)}>{!missingDeepResearch.includes(key) ? 'Complete' : 'Required'}: {data.business_catalog?.research.find(item => item.key === key)?.name ?? key}</p>)}{missingDeepResearch.length > 0 && <ClaimButton onClick={() => openOffice('research', missingDeepResearch[0])}>Review deep research</ClaimButton>}</section>}{upgradeShortfall > 0 && <p className="dcl-error">Sell materials to earn {upgradeShortfall} more credits, including the operating reserve.</p>}</> : <ClaimBadge tone="green">Maxed</ClaimBadge>}{phase2 && chosenBuilding.level > 0 && (chosenBuilding.key === 'smeltery' || chosenBuilding.key === 'gem_workshop' || chosenBuilding.key === 'tool_station') && <ClaimButton onClick={() => openWorkshop(chosenBuilding.key as DeepClaimProductionStation)}>Open workshop<ArrowRight size={14} aria-hidden="true" /></ClaimButton>}{phase4 && ['mine_office', 'research_office', 'trading_post'].includes(chosenBuilding.key) && <ClaimButton onClick={() => openOffice(chosenBuilding.key === 'research_office' ? 'research' : chosenBuilding.key === 'trading_post' ? 'contracts' : 'company')}>Open company office</ClaimButton>}{phase2 && chosenBuilding.key === 'mine_office' && <ClaimButton onClick={() => { setBuilding(null); setCrewView('hire'); setTab('crew'); }}>Open hiring office</ClaimButton>}{phase2 && chosenBuilding.key === 'workers_quarters' && chosenBuilding.level > 0 && <ClaimButton onClick={() => { setBuilding(null); setCrewView('staff'); setTab('crew'); }}>Manage crew</ClaimButton>}{localError && <p className="dcl-error" role="alert">{localError}</p>}</div>}</ClaimDialog>
      <ClaimDialog open={!!sale} onClose={() => setSale(null)} busy={operation.busy} title={sale ? `Sell ${RESOURCE_BY_ID[sale].name}` : 'Sell materials'} description="" footerNote={sale && <><span>Sale total · {saleValid ? quantity : '—'} units</span><strong>{saleValid ? (quantity * RESOURCE_BY_ID[sale].sell_price).toLocaleString() : '—'} cr</strong></>} footer={sale && <div className="dcl-dialog-actions"><ClaimButton disabled={operation.busy} onClick={() => setSale(null)}>Back to inventory</ClaimButton><ClaimButton primary pending={operation.busy} disabled={!canWrite || !saleValid} onClick={() => void sell()}>Confirm sale</ClaimButton></div>}>{sale && <><div className="dcl-sale-identity"><DeepClaimResourceIcon resourceId={sale} decorative /><strong>{stock.toLocaleString()} in storage</strong></div><label data-dc-tutorial="sale-review">Quantity<input type="number" min="1" max={stock} step="1" value={Number.isNaN(quantity) ? '' : quantity} disabled={!canWrite} onChange={event => setQuantity(Number(event.target.value))} aria-label="Quantity to sell" /></label><div className="dcl-quantity-presets" role="group" aria-label="Sale quantity shortcuts">{[0.25, 0.5, 1].map(fraction => <ClaimButton key={fraction} disabled={!canWrite || stock < 1} onClick={() => setQuantity(Math.max(1, Math.floor(stock * fraction)))}>{fraction === 1 ? 'All stock' : `${fraction * 100}%`}</ClaimButton>)}</div><div className="dcl-trade-summary"><span>{RESOURCE_BY_ID[sale].sell_price} cr × {saleValid ? quantity : '—'}</span><strong>{saleValid ? (quantity * RESOURCE_BY_ID[sale].sell_price).toLocaleString() : '—'} cr</strong></div>{!saleValid && <p className="dcl-note">Choose a whole quantity from 1 to {stock}.</p>}{localError && <p className="dcl-error" role="alert">{localError}</p>}</>}</ClaimDialog>
      <ClaimDialog open={!!haul} onClose={() => setHaul(null)} busy={operation.busy} title="The haul is home" description="" footer={chosenHaul && <div className="dcl-dialog-actions"><ClaimButton disabled={operation.busy} onClick={() => setHaul(null)}>Back to camp</ClaimButton><ClaimButton data-dc-tutorial="haul-collect" primary pending={operation.busy} disabled={!canWrite || company.warehouse_used >= company.warehouse_capacity && resourceTotal(chosenHaul.cargo ?? {}) > 0} onClick={() => void collect()}>Collect into storage</ClaimButton></div>}>{chosenHaul && <><ResourceList resources={chosenHaul.cargo ?? {}} /><p className="dcl-note">Warehouse space: {company.warehouse_capacity - company.warehouse_used} units. If the haul is larger, the rest stays staged and blocks new shifts until collected.</p>{localError && <p className="dcl-error" role="alert">{localError}</p>}{company.warehouse_used >= company.warehouse_capacity && <ClaimButton onClick={() => { setHaul(null); setTab('stores'); }}>Make room in Stores</ClaimButton>}</>}</ClaimDialog>
    </>}
    <ClaimDialog open={!!revealedFind} onClose={() => setRevealTarget(null)} title="A find from the deep" description="" className={`dcl-find-reveal is-${revealedFind?.quality ?? 'fine'}`}>
      {revealedFind && <><div className="dcl-find-reveal-art"><DeepClaimDiscoveryIcon kind={revealedFind.kind} quality={revealedFind.quality} decorative /></div><ClaimBadge>{revealedFind.quality} specimen</ClaimBadge><h3>{revealedFind.name}</h3><p>{revealedFind.detail}</p><p className="dcl-note">The specimen is pending in your field book. Nothing is sold or salvaged until you decide.</p><div className="dcl-dialog-actions"><ClaimButton onClick={() => setRevealTarget(null)}>Later</ClaimButton><ClaimButton primary onClick={() => { const find = revealedFind; setRevealTarget(null); openFinds(find.id); }}>Inspect find<ArrowRight size={15} aria-hidden="true" /></ClaimButton></div></>}
    </ClaimDialog>
    {reward && <DeepClaimRewardReceipt reward={reward} onClose={() => setReward(null)} onNextShift={nextShift && training.progress.campaign_status !== 'active' ? planNextShift : undefined} nextShiftDisabled={!canWrite} reducedMotion={visuals.reducedMotion} />}
    {departure && !ownDialogOpen && !dialogOpen && !trainingModal && <DeepClaimCrewDeparture job={departure.job} workers={departure.workers} onDone={() => setDeparture(null)} onFollow={() => followCrew(departure.job)} reducedMotion={visuals.reducedMotion} />}
    </> : <>
      {operation.pendingAction && <div className="dcl-offline" role="status"><span>Saved action: {operation.pendingAction}</span><button type="button" disabled={operation.busy} onClick={() => void retrySaved()}>Confirm sync</button></div>}
      {screen === 'founding' && !company ? <DeepClaimPrologue identity={`${userId}:${clubId}`} clubName={clubName} reducedMotion={visuals.reducedMotion} reducedGraphics={visuals.reducedGraphics} busy={operation.busy} blocked={operation.readOnly} error={localError || operation.error} onBack={() => setScreen('title')} onFound={bootstrap} onInteraction={() => void menuInteraction()} />
        : <DeepClaimTitleScreen summary={company ? { companyName: company.name, supportedDepth: data?.world?.max_depth ?? 0, employeeCount: data?.workers.length ?? 0, activeExpeditions: live.filter(job => job.status === 'active').length, readyCollections: ready.length + productionReady.length, lastSyncedAt: data?.server_now } : null}
          loading={!data} busy={operation.busy || !company && operation.readOnly} cached={operation.readOnly && !!data} error={localError || operation.error || linkMessage} active={(!publisherVisible || publisherRevealing) && !menuSettings && !trainingModal && !dialogOpen} reducedMotion={visuals.reducedMotion} reducedGraphics={visuals.reducedGraphics}
          onContinue={() => { if (company) setScreen('game'); }} onNewGame={() => { if (!company && data && !operation.readOnly) setScreen('founding'); }}
          onJournal={() => trainingCommand('journal')} onSettings={() => setMenuSettings(true)} onExit={() => navigate('/compete')} onRetry={() => void operation.refresh()} onInteraction={() => void menuInteraction()} />}
    </>}
    <ClaimDialog open={menuSettings} onClose={() => setMenuSettings(false)} title="Settings" description="" className="dcm-settings-dialog">
      <DeepClaimSettings audio={audio} visuals={visuals} onVisualsChange={changeVisuals} onRefresh={() => void operation.refresh()} refreshing={operation.refreshing} serverTime={data?.server_now} industry={phase2} field={phase3} business={phase4 && !!company} deep={!!deep} onOpenJournal={() => { setMenuSettings(false); trainingCommand('journal'); }} />
    </ClaimDialog>
  </main>{publisherVisible && <DHGamesIntro reducedMotion={visuals.reducedMotion} onReveal={() => setPublisherRevealing(true)} onComplete={() => setPublisherOpening(false)} />}<DeepClaimTutorialDirector snapshot={data} scope={scope} progress={training.progress} events={tutorialEvents} update={training.update} request={trainingRequest}
    active={screen === 'game' && !!company && !publisherVisible} receiptOpen={operation.busy || !!reward || !!revealedFind} reducedMotion={visuals.reducedMotion} navigate={tutorialNavigate} onModalChange={setTrainingModal} audio={audio} saving={training.saving} error={training.error}
    onRetry={() => void training.refresh()} onContinue={() => { if (company) setScreen('game'); }} />
  </ClaimDialogScope></DeepClaimTutorialEventsProvider>;
}

function ResourceList({ resources }: { resources: DeepClaimResources }) {
  const stock = RESOURCE_CATALOG.filter(resource => resourceQuantity(resources, resource.id) > 0);
  return <div className="dcl-resource-receipt">{stock.length ? stock.map(resource => <span key={resource.id}><DeepClaimResourceIcon resourceId={resource.id} decorative /><strong>{resourceQuantity(resources, resource.id).toLocaleString()}</strong><small>{resource.name}</small></span>) : <p>No materials</p>}</div>;
}
