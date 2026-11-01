import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Check, Clock3, Coins, FileText, House, List, Package, Pickaxe, RefreshCw, Settings, ShieldCheck, Users, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { BUILDING_INFO, RESOURCE_BY_ID, RESOURCE_CATALOG, buildingEffect, resourceQuantity, resourceTotal } from '@/lib/deepClaim/catalog';
import { createDeepClaimAudio } from '@/lib/deepClaim/audio';
import { DEEP_CLAIM_RESOURCE_IDS, type DeepClaimBuildingId, type DeepClaimExpedition, type DeepClaimMode, type DeepClaimPoint, type DeepClaimProductionJob, type DeepClaimProductionStation, type DeepClaimResourceId, type DeepClaimResources } from '@/lib/deepClaim/types';
import { DeepClaimCanvas } from '@/components/deepClaim/renderer/DeepClaimCanvas';
import { DeepClaimEquipmentIcon, DeepClaimResourceIcon } from '@/components/deepClaim/renderer/DeepClaimIcons';
import { DeepClaimMark } from '@/components/deepClaim/DeepClaimMark';
import { DeepClaimDispatch } from '@/components/deepClaim/DeepClaimDispatch';
import { DeepClaimCrew, DeepClaimLog, DeepClaimStores } from '@/components/deepClaim/DeepClaimPanels';
import { DeepClaimWorkforce } from '@/components/deepClaim/DeepClaimWorkforce';
import { DeepClaimIndustry } from '@/components/deepClaim/DeepClaimIndustry';
import { DeepClaimSettings, type ClaimVisualPreferences } from '@/components/deepClaim/DeepClaimSettings';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimMeter, ClaimState } from '@/components/deepClaim/DeepClaimPrimitives';
import { claimIntroAvailable, claimTargets, claimTimeLeft } from '@/components/deepClaim/display';
import '@/components/deepClaim/deepClaim.css';

const TABS = [{ key: 'surface', label: 'Surface', icon: House }, { key: 'mine', label: 'Mine', icon: Pickaxe }, { key: 'crew', label: 'Crew', icon: Users }, { key: 'stores', label: 'Stores', icon: Package }, { key: 'log', label: 'Log', icon: FileText }, { key: 'settings', label: 'Settings', icon: Settings }] as const;
type Tab = typeof TABS[number]['key'];
type Reward = { title: string; description: string; resources?: DeepClaimResources; remaining?: number; cash?: number; equipment?: { id: string; key: string; name: string; tier: 1 | 2 }[] };
function preferences(userId: string): ClaimVisualPreferences {
  const systemMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  try { const value = JSON.parse(localStorage.getItem(`dh:deep-claim:visuals:v1:${userId}`) ?? 'null'); return { reducedMotion: typeof value?.reducedMotion === 'boolean' ? value.reducedMotion : systemMotion, reducedGraphics: value?.reducedGraphics === true }; }
  catch { return { reducedMotion: systemMotion, reducedGraphics: false }; }
}

export default function DeepClaimPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const assets = useClubAssets();
  if (authLoading || clubLoading || assets.loading) return <main className="deep-claim"><header className="dcl-topbar"><Link to="/compete" className="dcl-icon-button" aria-label="Return to DH"><ArrowLeft size={19} aria-hidden="true" /></Link><div className="dcl-brand"><small>DEEP CLAIM</small><h1>A Prospector’s Empire</h1></div></header><ClaimState title="Finding the frontier" onRetry={() => void assets.refresh()} refreshing={assets.loading} /></main>;
  if (!user || !club || !assets.isInstalled('deep-claim')) return <main className="deep-claim"><ClaimState title="This claim is outside your camp">Deep Claim needs an active club with the game installed.</ClaimState><Link className="dcl-button" to="/compete"><ArrowLeft size={16} aria-hidden="true" />Return to DH</Link></main>;
  return <DeepClaimCompany key={`${user.id}:${club.id}`} userId={user.id} />;
}

function DeepClaimCompany({ userId }: { userId: string }) {
  const operation = useDeepClaim();
  const data = operation.data;
  const company = data?.company;
  const [tab, setTab] = useState<Tab>('surface');
  const [crewView, setCrewView] = useState<'staff' | 'hire'>('staff');
  const [storesView, setStoresView] = useState<'stock' | 'workshop'>('stock');
  const [station, setStation] = useState<DeepClaimProductionStation>('smeltery');
  const [selectedTile, setSelectedTile] = useState<DeepClaimPoint | null>(null);
  const [dispatch, setDispatch] = useState<{ mode: DeepClaimMode; target: DeepClaimPoint | null } | null>(null);
  const [buildings, setBuildings] = useState(false);
  const [building, setBuilding] = useState<DeepClaimBuildingId | null>(null);
  const [sale, setSale] = useState<DeepClaimResourceId | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [haul, setHaul] = useState<string | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [localError, setLocalError] = useState('');
  const [dismissedError, setDismissedError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [visuals, setVisuals] = useState(() => preferences(userId));
  const [, tick] = useState(0);
  const active = useRef(true);
  const id = useId();
  const audio = useMemo(() => createDeepClaimAudio(userId), [userId]);
  useEffect(() => { active.current = true; return () => { active.current = false; audio.dispose(); }; }, [audio]);
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === 'visible') tick(value => value + 1); }, 1000); return () => clearInterval(timer); }, []);
  const now = operation.serverNow();
  const ready = data?.expeditions.filter(job => job.status === 'ready') ?? [];
  const live = data?.expeditions.filter(job => job.status !== 'collected') ?? [];
  const phase2 = data?.schema_version === 2;
  const productionReady = data?.production_jobs?.filter(job => job.status === 'ready') ?? [];
  const chosenBuilding = data?.buildings.find(item => item.key === building);
  const upgradeShortfall = chosenBuilding?.upgrade_cost != null && company ? Math.max(0, chosenBuilding.upgrade_cost + 2 - company.cash) : 0;
  const chosenHaul = data?.expeditions.find(item => item.id === haul);
  const stock = sale && data ? resourceQuantity(data.resources, sale) : 0;
  const saleValid = Number.isSafeInteger(quantity) && quantity > 0 && quantity <= stock;
  const canWrite = !operation.readOnly && !operation.busy;
  const sceneVisible = tab === 'surface' || tab === 'mine';
  const currentError = localError || operation.error;
  const freeCrewSlot = !!company && live.filter(job => job.status === 'active').length < company.crew_slots;
  const introAvailable = !!data && claimIntroAvailable(data);
  const firstHaulCollected = !!data?.expeditions.some(job => job.tutorial && job.status === 'collected');
  const coreBuildings = ['mine_office', 'mine_shaft', 'warehouse', 'tool_station'];
  const firstUpgradePending = !!data?.buildings.length && data.buildings.every(item => coreBuildings.includes(item.key) ? item.level === 1 : item.level === 0);
  const sellFirstHaul = firstHaulCollected && firstUpgradePending && !live.length && resourceTotal(data?.resources ?? {}) > 0;
  const reviewFirstUpgrade = firstHaulCollected && firstUpgradePending && !live.length && resourceTotal(data?.resources ?? {}) === 0;

  function changeVisuals(patch: Partial<ClaimVisualPreferences>) {
    setVisuals(before => { const next = { ...before, ...patch }; try { localStorage.setItem(`dh:deep-claim:visuals:v1:${userId}`, JSON.stringify(next)); } catch { /* Device preferences still work without storage. */ } return next; });
  }
  function openDispatch(mode: DeepClaimMode, point: DeepClaimPoint | null = selectedTile) {
    if (!data?.company) return;
    setLocalError(''); setDispatch({ mode, target: point ?? claimTargets(data, mode)[0] ?? null });
  }
  function openWorkshop(key: DeepClaimProductionStation) { setStation(key); setStoresView('workshop'); setTab('stores'); setBuilding(null); setBuildings(false); }
  function openSurfaceBuilding(key: DeepClaimBuildingId) {
    setLocalError('');
    const current = data?.buildings.find(item => item.key === key);
    if (phase2 && current && current.level > 0 && (key === 'smeltery' || key === 'gem_workshop' || key === 'tool_station')) openWorkshop(key);
    else if (phase2 && key === 'mine_office' && current && current.level > 0) { setCrewView('hire'); setTab('crew'); }
    else setBuilding(key);
  }
  function managementConfirmed(title: string, description: string) { if (active.current) { setReward({ title, description }); audio.play('complete'); } }
  async function collectProduction(job: DeepClaimProductionJob) {
    if (!data || !canWrite) return;
    const owned = new Set(data.equipment?.map(item => item.id) ?? []);
    const updated = await operation.collectProduction(job.id);
    if (!active.current) return;
    const nextJob = updated.production_jobs?.find(item => item.id === job.id);
    const remaining = nextJob?.status === 'ready' ? nextJob.outputs : {};
    const resources = Object.fromEntries(DEEP_CLAIM_RESOURCE_IDS.map(key => [key, Math.max(0, resourceQuantity(job.outputs, key) - resourceQuantity(remaining, key))]).filter(([, quantity]) => Number(quantity) > 0)) as DeepClaimResources;
    const equipment = updated.equipment?.filter(item => !owned.has(item.id)).flatMap(item => { const definition = updated.equipment_catalog?.find(value => value.key === item.definition_key); return definition ? [{ id: item.id, key: definition.key, name: definition.name, tier: definition.tier }] : []; });
    setReward({ title: 'Production secured.', description: 'Collected output is now owned by your company.', resources, equipment, remaining: resourceTotal(remaining) }); audio.play('deposit');
  }
  async function bootstrap() {
    if (!canWrite || companyName.trim().length < 2) return;
    setLocalError(''); setDismissedError('');
    try { await operation.bootstrap(companyName); if (active.current) audio.play('building'); }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The company could not be founded. Retry sync.'); }
  }
  async function collect() {
    if (!chosenHaul || !canWrite) return;
    const original = chosenHaul.cargo ?? {};
    setLocalError(''); setDismissedError('');
    try {
      const updated = await operation.collect(chosenHaul.id);
      if (!active.current) return;
      const updatedHaul = updated.expeditions.find(job => job.id === chosenHaul.id);
      const remaining = updatedHaul?.status === 'ready' ? updatedHaul.cargo ?? {} : {};
      const moved = Object.fromEntries(DEEP_CLAIM_RESOURCE_IDS.map(key => [key, Math.max(0, resourceQuantity(original, key) - resourceQuantity(remaining, key))]).filter(([, amount]) => Number(amount) > 0)) as DeepClaimResources;
      setHaul(null); setReward({ title: resourceTotal(moved) ? 'Haul secured.' : 'Camp updated.', description: 'Confirmed cargo is now part of your company’s stored stock.', resources: moved, remaining: resourceTotal(remaining) }); audio.play('deposit');
    } catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The haul could not be confirmed. Retry sync.'); }
  }
  async function sell() {
    if (!sale || !saleValid || !canWrite) return;
    setLocalError(''); setDismissedError('');
    try { const updated = await operation.sell({ resource_key: sale, quantity }); if (active.current) { setSale(null); setReward({ title: 'Trade recorded.', description: 'Your warehouse and company balance are synchronized.', cash: updated.company?.cash }); audio.play('deposit'); } }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The sale could not be confirmed. Retry sync.'); }
  }
  async function upgrade() {
    if (!chosenBuilding || !canWrite) return;
    setLocalError(''); setDismissedError('');
    try { await operation.upgrade(chosenBuilding.key); if (active.current) { setBuilding(null); setReward({ title: `${BUILDING_INFO[chosenBuilding.key].name} ${chosenBuilding.level === 0 ? 'built' : 'upgraded'}.`, description: 'The building is ready at its new level.' }); audio.play('upgrade'); } }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'The upgrade could not be confirmed. Retry sync.'); }
  }
  async function retrySaved() {
    setLocalError(''); setDismissedError('');
    try { await operation.retryPending(); if (active.current) setReward({ title: 'Saved action confirmed.', description: 'Your company is synchronized. The action was applied once.' }); }
    catch (error) { if (active.current) setLocalError(error instanceof Error ? error.message : 'Still unable to confirm. Your request remains saved.'); }
  }

  return <main className="deep-claim" data-testid="deep-claim-shell" data-reduced-motion={visuals.reducedMotion}>
    <header className="dcl-topbar"><Link to="/compete" className="dcl-icon-button" aria-label="Return to DH"><ArrowLeft size={19} aria-hidden="true" /></Link><div className="dcl-brand"><small>DEEP CLAIM</small><h1>{company?.name ?? 'A Prospector’s Empire'}</h1></div>{company && <div className="dcl-top-money"><strong aria-label={`${company.cash.toLocaleString()} company credits`}><Coins size={14} aria-hidden="true" />{company.cash.toLocaleString()}</strong><small>{company.warehouse_used}/{company.warehouse_capacity} stored</small></div>}<button type="button" className="dcl-icon-button" aria-label="Refresh company" disabled={operation.refreshing || operation.busy} onClick={() => void operation.refresh()}><RefreshCw size={17} className={operation.refreshing ? 'dcl-spin' : ''} aria-hidden="true" /></button></header>
    {operation.pendingAction ? <div className="dcl-offline" role="status"><span><ShieldCheck size={14} aria-hidden="true" />Saved action: {operation.pendingAction}</span><button type="button" disabled={operation.busy} onClick={() => void retrySaved()}>{operation.busy ? 'Confirming…' : 'Confirm sync'}</button></div> : operation.readOnly && data ? <div className="dcl-offline" role="status"><span><WifiOff size={14} aria-hidden="true" />Saved camp · read-only until reconnected</span><button type="button" disabled={operation.refreshing} onClick={() => void operation.refresh()}>Reconnect</button></div> : null}
    {!data ? <ClaimState error={operation.error} onRetry={() => void operation.refresh()} refreshing={operation.refreshing} /> : !company ? <div className="dcl-state"><DeepClaimMark className="dcl-bootstrap-mark" decorative /><form className="dcl-bootstrap" onSubmit={event => { event.preventDefault(); void bootstrap(); }}><span className="dcl-eyebrow">A PROSPECTOR’S EMPIRE</span><h1>Stake your claim.</h1><p>Three workers. Uncharted ground. A company that keeps working when you leave.</p><label htmlFor={`${id}-name`}>Company name</label><input id={`${id}-name`} value={companyName} minLength={2} maxLength={40} disabled={!canWrite} autoComplete="organization" placeholder="Your frontier company" onChange={event => setCompanyName(event.target.value)} />{(localError || operation.error) && <p className="dcl-error" role="alert">{localError || operation.error}</p>}<ClaimButton type="submit" primary pending={operation.busy} disabled={operation.readOnly || companyName.trim().length < 2}>Found company<ArrowRight size={15} aria-hidden="true" /></ClaimButton><small>Your first introductory shift takes 30 seconds. Standard shifts use real expedition time.</small></form></div> : <>
      {currentError && currentError !== dismissedError && <div className="dcl-action-error" role="alert"><span>{currentError}</span><button type="button" aria-label="Dismiss company message" onClick={() => { setDismissedError(currentError); setLocalError(''); }}>OK</button></div>}
      <div className="dcl-content">
        <div className="dcl-scene" hidden={!sceneVisible} role={sceneVisible ? 'tabpanel' : undefined} id={sceneVisible ? `${id}-panel` : undefined} aria-labelledby={`${id}-${tab}`}>
          <DeepClaimCanvas snapshot={data} view={tab === 'mine' ? 'mine' : 'surface'} selectedTile={selectedTile} onSelectTile={point => { setSelectedTile(point); const tile = data.world?.tiles.find(tile => tile.x === point.x && tile.y === point.y); openDispatch(tile?.material && tile.remaining > 0 ? 'extract' : 'explore', point); }} onSelectBuilding={openSurfaceBuilding} active={sceneVisible} reducedMotion={visuals.reducedMotion} reducedGraphics={visuals.reducedGraphics} audio={audio} />
          <div className="dcl-map-heading"><div><h2>{tab === 'mine' ? 'Below the claim' : 'The frontier camp'}</h2><p>{introAvailable ? 'Start your 30-second extraction shift.' : sellFirstHaul ? 'Sell your first haul in Stores, then improve your camp.' : reviewFirstUpgrade ? 'Your first sale is in. Review a permanent camp upgrade.' : tab === 'mine' ? `Revealed ground · supported depth ${data.world?.max_depth ?? 0}m` : `${live.filter(job => job.status === 'active').length}/${company.crew_slots} crews working · ${ready.length + productionReady.length} ready collections`}</p></div><button type="button" className="dcl-icon-button" aria-label={tab === 'surface' ? 'Open camp buildings' : 'Choose a worksite from list'} onClick={() => { if (tab === 'surface') setBuildings(true); else openDispatch('explore'); }}>{tab === 'surface' ? <Building2 size={18} aria-hidden="true" /> : <List size={18} aria-hidden="true" />}</button></div>
          <div className="dcl-map-actions">{live.length ? <div className="dcl-operation-dock">{live.map(job => <ExpeditionCard key={job.id} job={job} now={now} onRefresh={() => void operation.refresh()} onCollect={() => { setHaul(job.id); setLocalError(''); }} />)}<ClaimButton className="is-small" disabled={!canWrite || !freeCrewSlot || ready.length + productionReady.length > 0} onClick={() => openDispatch('explore')} aria-label="Dispatch another crew"><Pickaxe size={15} aria-hidden="true" />{ready.length + productionReady.length ? 'Collect output first' : freeCrewSlot ? 'New shift' : 'Crews busy'}</ClaimButton></div> : <><ClaimButton primary disabled={!productionReady.length && !sellFirstHaul && !reviewFirstUpgrade && !canWrite} onClick={() => { if (productionReady.length) openWorkshop(productionReady[0].station); else if (sellFirstHaul) setTab('stores'); else if (reviewFirstUpgrade) setBuildings(true); else if (introAvailable) openDispatch('extract', { x: 47, y: 1 }); else openDispatch('explore', null); }}><Pickaxe size={16} aria-hidden="true" />{productionReady.length ? 'Collect production' : introAvailable ? 'Start first shift · 30s' : sellFirstHaul ? 'Sell first haul' : reviewFirstUpgrade ? 'Review camp upgrades' : 'Explore'}</ClaimButton><ClaimButton disabled={!canWrite || productionReady.length > 0 || !introAvailable && !claimTargets(data, 'extract').length} onClick={() => introAvailable ? openDispatch('explore', null) : openDispatch('extract', null)}><Package size={16} aria-hidden="true" />{introAvailable ? 'Explore' : 'Extract'}</ClaimButton></>}</div>
        </div>
        {!sceneVisible && <section className="dcl-pane" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>{tab === 'crew' ? phase2 ? <DeepClaimWorkforce snapshot={data} initialView={crewView} actions={operation} busy={operation.busy} readOnly={operation.readOnly} onConfirmed={managementConfirmed} onQuarters={() => setBuilding('workers_quarters')} /> : <DeepClaimCrew snapshot={data} /> : tab === 'stores' ? phase2 ? <DeepClaimIndustry snapshot={data} view={storesView} onView={setStoresView} station={station} onStation={setStation} busy={operation.busy} readOnly={operation.readOnly} now={now} onRefresh={() => void operation.refresh()} onBuild={setBuilding} onSell={key => { setSale(key); setQuantity(resourceQuantity(data.resources, key)); setLocalError(''); }} onOpenHaul={id => { setHaul(id); setLocalError(''); }} startProduction={operation.startProduction} collectProduction={collectProduction} onConfirmed={managementConfirmed} /> : <DeepClaimStores snapshot={data} readyHauls={ready} onOpenHaul={id => { setHaul(id); setLocalError(''); }} busy={operation.busy} readOnly={operation.readOnly} onSell={key => { setSale(key); setQuantity(resourceQuantity(data.resources, key)); setLocalError(''); }} /> : tab === 'log' ? <DeepClaimLog snapshot={data} /> : <DeepClaimSettings audio={audio} visuals={visuals} onVisualsChange={changeVisuals} onRefresh={() => void operation.refresh()} refreshing={operation.refreshing} serverTime={data.server_now} industry={phase2} />}</section>}
      </div>
      <nav className="dcl-tabs" role="tablist" aria-label="Company views" onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const current = TABS.findIndex(item => item.key === tab); const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length; setTab(TABS[next].key); document.getElementById(`${id}-${TABS[next].key}`)?.focus(); }}>{TABS.map(item => <button type="button" role="tab" id={`${id}-${item.key}`} aria-controls={`${id}-panel`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1} onClick={() => setTab(item.key)} key={item.key}><item.icon size={18} aria-hidden="true" />{item.label}{item.key === 'stores' && ready.length + productionReady.length > 0 && <b aria-label={`${ready.length + productionReady.length} collections ready`}>{ready.length + productionReady.length}</b>}</button>)}</nav>
      {dispatch && <DeepClaimDispatch key={`${dispatch.mode}:${dispatch.target?.x}:${dispatch.target?.y}`} snapshot={data} initialMode={dispatch.mode} initialTarget={dispatch.target} onClose={() => setDispatch(null)} readOnly={operation.readOnly} busy={operation.busy} preview={operation.preview} dispatch={async (input, revision) => { const updated = await operation.dispatch(input, revision); if (active.current) audio.play('dispatch'); return updated; }} />}
      <ClaimDialog open={buildings} onClose={() => setBuildings(false)} title="The surface camp" description="A working frontier camp. Every building changes your operation."><div className="dcl-building-list">{data.buildings.map(item => <button type="button" key={item.key} onClick={() => { setBuildings(false); setBuilding(item.key); setLocalError(''); }}><Building2 size={23} aria-hidden="true" /><span><strong>{BUILDING_INFO[item.key].name}</strong><small>{item.level === 0 ? 'Unbuilt plot' : `Level ${item.level}`} · {item.effect}</small></span><ArrowRight size={16} aria-hidden="true" /></button>)}</div></ClaimDialog>
      <ClaimDialog open={!!building} onClose={() => setBuilding(null)} busy={operation.busy} title={building ? BUILDING_INFO[building].name : 'Camp building'} description={building ? BUILDING_INFO[building].description : undefined}>{chosenBuilding && <><ClaimBadge>{chosenBuilding.level === 0 ? 'Unbuilt plot' : `Level ${chosenBuilding.level} / ${chosenBuilding.max_level}`}</ClaimBadge><p className="dcl-note">{chosenBuilding.effect}</p>{chosenBuilding.upgrade_cost != null ? <><div className="dcl-trade-summary"><span>{chosenBuilding.level === 0 ? 'Build level 1' : `Next level ${chosenBuilding.level + 1}`}<small>{buildingEffect(chosenBuilding.key, chosenBuilding.level + 1)}</small></span><strong>{chosenBuilding.upgrade_cost.toLocaleString()} cr</strong></div><p className="dcl-note">Keep 2 company credits in reserve for future wages.</p>{upgradeShortfall > 0 && <p className="dcl-error">Sell materials to earn {upgradeShortfall} more credits, including the operating reserve.</p>}<ClaimButton primary pending={operation.busy} disabled={!canWrite || upgradeShortfall > 0} onClick={() => void upgrade()}>{chosenBuilding.level === 0 ? 'Confirm build' : 'Confirm upgrade'}</ClaimButton></> : <p className="dcl-note">This building has reached its current maximum level.</p>}{phase2 && chosenBuilding.level > 0 && (chosenBuilding.key === 'smeltery' || chosenBuilding.key === 'gem_workshop' || chosenBuilding.key === 'tool_station') && <ClaimButton onClick={() => openWorkshop(chosenBuilding.key as DeepClaimProductionStation)}>Open workshop<ArrowRight size={14} aria-hidden="true" /></ClaimButton>}{phase2 && chosenBuilding.key === 'mine_office' && <ClaimButton onClick={() => { setBuilding(null); setCrewView('hire'); setTab('crew'); }}>Open hiring office</ClaimButton>}{phase2 && chosenBuilding.key === 'workers_quarters' && chosenBuilding.level > 0 && <ClaimButton onClick={() => { setBuilding(null); setCrewView('staff'); setTab('crew'); }}>Manage crew</ClaimButton>}{localError && <p className="dcl-error" role="alert">{localError}</p>}</>}</ClaimDialog>
      <ClaimDialog open={!!sale} onClose={() => setSale(null)} busy={operation.busy} title={sale ? `Sell ${RESOURCE_BY_ID[sale].name}` : 'Sell materials'} description="Company stock is exchanged for company credits.">{sale && <><div className="dcl-sale-identity"><DeepClaimResourceIcon resourceId={sale} decorative /><strong>{stock.toLocaleString()} in storage</strong></div><label>Quantity<input type="number" min="1" max={stock} step="1" value={Number.isNaN(quantity) ? '' : quantity} disabled={!canWrite} onChange={event => setQuantity(Number(event.target.value))} aria-label="Quantity to sell" /></label><div className="dcl-trade-summary"><span>{RESOURCE_BY_ID[sale].sell_price} cr × {saleValid ? quantity : '—'}</span><strong>{saleValid ? (quantity * RESOURCE_BY_ID[sale].sell_price).toLocaleString() : '—'} cr</strong></div>{!saleValid && <p className="dcl-note">Choose a whole quantity from 1 to {stock}.</p>}{localError && <p className="dcl-error" role="alert">{localError}</p>}<ClaimButton primary pending={operation.busy} disabled={!canWrite || !saleValid} onClick={() => void sell()}>Confirm sale</ClaimButton></>}</ClaimDialog>
      <ClaimDialog open={!!haul} onClose={() => setHaul(null)} busy={operation.busy} title="The haul is home" description="Cargo stays staged until it moves safely into your warehouse.">{chosenHaul && <><ResourceList resources={chosenHaul.cargo ?? {}} /><p className="dcl-note">Warehouse space: {company.warehouse_capacity - company.warehouse_used} units. If the haul is larger, the rest stays staged and blocks new shifts until collected.</p>{localError && <p className="dcl-error" role="alert">{localError}</p>}<ClaimButton primary pending={operation.busy} disabled={!canWrite || company.warehouse_used >= company.warehouse_capacity && resourceTotal(chosenHaul.cargo ?? {}) > 0} onClick={() => void collect()}>Collect into storage</ClaimButton>{company.warehouse_used >= company.warehouse_capacity && <ClaimButton onClick={() => { setHaul(null); setTab('stores'); }}>Make room in Stores</ClaimButton>}</>}</ClaimDialog>
    </>}
    <ClaimDialog open={!!reward} onClose={() => setReward(null)} title={reward?.title ?? 'Company updated'} description={reward?.description} className="is-collect"><div className="dcl-collect-mark"><Check aria-hidden="true" /></div>{reward?.resources && <ResourceList resources={reward.resources} />}{!!reward?.equipment?.length && <div className="dcl-equipment-receipt">{reward.equipment.map(item => <span key={item.id}><DeepClaimEquipmentIcon archetype={item.key} tier={item.tier} decorative /><strong>{item.name}</strong><small>Owned equipment · Tier {item.tier}</small></span>)}</div>}{reward?.cash != null && <strong className="dcl-reward-cash">{reward.cash.toLocaleString()} company credits</strong>}{!!reward?.remaining && <p className="dcl-note">{reward.remaining} units remain staged. Sell stock or add storage space before collecting the rest.</p>}<ClaimButton primary onClick={() => setReward(null)}>Back to the claim</ClaimButton></ClaimDialog>
  </main>;
}

function ExpeditionCard({ job, now, onRefresh, onCollect }: { job: DeepClaimExpedition; now: number; onRefresh: () => void; onCollect: () => void }) {
  const completedLocally = now >= Date.parse(job.completes_at);
  const fraction = Math.max(0, Math.min(100, 100 * (now - Date.parse(job.started_at)) / (Date.parse(job.completes_at) - Date.parse(job.started_at))));
  return <article className="dcl-expedition-card"><header><strong>{job.mode === 'explore' ? 'Survey crew' : 'Extraction crew'}</strong><ClaimBadge tone={job.status === 'ready' ? 'green' : 'blue'}>{job.status === 'ready' ? 'Haul ready' : job.stage}</ClaimBadge></header><p>{job.target.y}m · {job.worker_ids.length} {job.worker_ids.length === 1 ? 'worker' : 'workers'}<span>{job.status === 'ready' ? `${resourceTotal(job.cargo ?? {})} units staged` : claimTimeLeft(job.completes_at, now)}</span></p><ClaimMeter value={fraction} max={100} label="Expedition elapsed time" tone="blue" />{job.status === 'ready' ? <ClaimButton className="is-small" primary onClick={onCollect}>Open haul</ClaimButton> : completedLocally ? <ClaimButton className="is-small" onClick={onRefresh}><RefreshCw size={12} aria-hidden="true" />Check return</ClaimButton> : null}</article>;
}

function ResourceList({ resources }: { resources: DeepClaimResources }) {
  const stock = RESOURCE_CATALOG.filter(resource => resourceQuantity(resources, resource.id) > 0);
  return <div className="dcl-resource-receipt">{stock.length ? stock.map(resource => <span key={resource.id}><DeepClaimResourceIcon resourceId={resource.id} decorative /><strong>{resourceQuantity(resources, resource.id).toLocaleString()}</strong><small>{resource.name}</small></span>) : <p>The confirmed warehouse balance is up to date.</p>}</div>;
}
