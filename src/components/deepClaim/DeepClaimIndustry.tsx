import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Clock3, Factory, Hammer, Package, RefreshCw } from 'lucide-react';
import { BUILDING_INFO, RESOURCE_BY_ID, resourceQuantity, resourceTotal } from '@/lib/deepClaim/catalog';
import type { DeepClaimBuildingId, DeepClaimProductionJob, DeepClaimProductionStation, DeepClaimRecipe, DeepClaimResourceId, DeepClaimResources, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimEquipmentIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { DeepClaimStores } from './DeepClaimPanels';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimEmpty, ClaimMeter } from './DeepClaimPrimitives';
import { claimTimeLeft } from './display';
import { TutorialToolbar, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';

export function DeepClaimIndustry({ snapshot, view, onView, station, onStation, busy, readOnly, now, onRefresh, onBuild, onResearch, onSell, onOpenHaul, startProduction, collectProduction, onConfirmed }: {
  snapshot: DeepClaimSnapshot; view: 'stock' | 'workshop'; onView: (view: 'stock' | 'workshop') => void;
  station: DeepClaimProductionStation; onStation: (station: DeepClaimProductionStation) => void; busy: boolean; readOnly: boolean; now: number;
  onRefresh: () => void; onBuild: (key: DeepClaimBuildingId) => void; onResearch?: (key?: string) => void; onSell: (key: DeepClaimResourceId) => void; onOpenHaul: (id: string) => void;
  startProduction: (recipe: string, batches: number) => Promise<DeepClaimSnapshot>;
  collectProduction: (job: DeepClaimProductionJob) => Promise<void>;
  onConfirmed: (title: string, description: string) => void;
}) {
  const tutorial = useDeepClaimTutorialEvents();
  useTutorialView('tab_opened', { tab: 'stores', view }, `industry:${view}`);
  useTutorialView('production_inspected', view === 'workshop' ? { view: station } : null, `production:${view}:${station}`);
  const [recipeKey, setRecipeKey] = useState<string | null>(null);
  const [batches, setBatches] = useState(1);
  const [reviewed, setReviewed] = useState<number | null>(null);
  const [error, setError] = useState('');
  const previousLocation = useRef({ view, station });
  useLayoutEffect(() => {
    if (previousLocation.current.view === view && previousLocation.current.station === station) return;
    previousLocation.current = { view, station };
    setRecipeKey(null); setBatches(1); setReviewed(null); setError('');
  }, [view, station]);
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock'>('in_stock');
  const jobs = snapshot.production_jobs?.filter(job => job.status !== 'collected') ?? [];
  const recipe = previousLocation.current.view === view && previousLocation.current.station === station ? snapshot.recipes?.find(item => item.key === recipeKey) : undefined;
  useTutorialView('recipe_inspected', recipe ? { recipe_key: recipe.key, view: recipe.station } : null, `recipe:${recipe?.key}`);
  const producedGear = snapshot.equipment_catalog?.find(item => item.key === recipe?.equipment_output);
  const stationBuilding = snapshot.buildings.find(item => item.key === station);
  const equipmentCatalog = snapshot.equipment_catalog ?? [];
  const validBatches = !!recipe && Number.isSafeInteger(batches) && batches >= 1 && batches <= recipe.max_batches;
  const inputs = Object.fromEntries(Object.entries(recipe?.inputs ?? {}).map(([key, count]) => [key, (count ?? 0) * batches])) as DeepClaimResources;
  const output = Object.fromEntries(Object.entries(recipe?.outputs ?? {}).map(([key, count]) => [key, (count ?? 0) * batches])) as DeepClaimResources;
  const currentBuilding = snapshot.buildings.find(item => item.key === recipe?.station);
  const requiredGear = (snapshot.equipment?.length ?? 0) + jobs.reduce((sum, job) => sum + job.equipment_outputs.length, 0) + (recipe?.equipment_output ? batches : 0);
  const completedResearch = new Set(snapshot.business?.research.filter(item => item.status === 'completed').map(item => item.key));
  const missingResearch = (recipe?.required_research ?? []).filter(key => !completedResearch.has(key));
  const reasons: string[] = [];
  for (const key of missingResearch) reasons.push(`Complete ${snapshot.business_catalog?.research.find(item => item.key === key)?.name ?? key} research first.`);
  if (recipe?.locked && !missingResearch.length) reasons.push('This recipe is locked. Refresh the company to review its requirements.');
  if (recipe && (currentBuilding?.level ?? 0) < recipe.required_station_level) reasons.push(`${BUILDING_INFO[recipe.station].name} level ${recipe.required_station_level} is required.`);
  if (jobs.length >= 3) reasons.push('Collect finished production to free one of the three company queue slots.');
  if (recipe && (snapshot.company?.cash ?? 0) < recipe.cash_cost * batches + 2) reasons.push('Keep enough company credits for the batch and the 2-credit operating reserve.');
  for (const [key, amount] of Object.entries(inputs)) if (resourceQuantity(snapshot.resources, key as DeepClaimResourceId) < (amount ?? 0)) reasons.push(`Need ${amount} ${RESOURCE_BY_ID[key as DeepClaimResourceId].name}; ${resourceQuantity(snapshot.resources, key as DeepClaimResourceId)} stored.`);
  if (recipe?.equipment_output && requiredGear > (snapshot.company?.equipment_capacity ?? 48)) reasons.push('Equipment storage is full. Retire unassigned equipment before crafting more.');
  if (readOnly) reasons.push('Reconnect or confirm the saved action before starting production.');
  const stale = reviewed !== null && reviewed < snapshot.revision;
  async function start() {
    if (!recipe || !validBatches || reasons.length || stale || reviewed === null || busy) return;
    setError('');
    try { await startProduction(recipe.key, batches); setRecipeKey(null); onConfirmed('Production queued.', `${recipe.name} · ${batches} ${batches === 1 ? 'batch' : 'batches'}. Materials and the processing fee have been committed once.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Production could not be confirmed. Check the saved action.'); }
  }
  return <>
    <TutorialToolbar lessonId={view === 'stock' ? 'industry.warehouse' : station === 'smeltery' ? 'industry.smeltery' : station === 'gem_workshop' ? 'industry.gems' : 'industry.crafting'} label={view === 'stock' ? 'Stock' : 'Production'}><div className="dcl-segment" role="group" aria-label="Stores view"><button type="button" aria-pressed={view === 'stock'} onClick={() => onView('stock')}>Stock</button><button type="button" aria-pressed={view === 'workshop'} onClick={() => onView('workshop')}>Workshop <small>{jobs.length}/3</small></button></div></TutorialToolbar>
    {view === 'stock' ? <><div className="dcl-stock-filter" role="group" aria-label="Stock filter"><button type="button" aria-pressed={stockFilter === 'in_stock'} onClick={() => setStockFilter('in_stock')}>In stock</button><button type="button" aria-pressed={stockFilter === 'all'} onClick={() => setStockFilter('all')}>All materials</button></div><DeepClaimStores snapshot={snapshot} readOnly={readOnly} busy={busy} onSell={onSell} readyHauls={snapshot.expeditions.filter(job => job.status === 'ready')} onOpenHaul={onOpenHaul} inStockOnly={stockFilter === 'in_stock'} />{jobs.some(job => job.status === 'ready') && <ClaimButton primary onClick={() => onView('workshop')}><Package size={15} aria-hidden="true" />Collect finished production</ClaimButton>}</> : <>
      <div className="dcl-section-heading"><div><h2>Frontier industry</h2><p>Real inputs. Timed batches. Collect the finished goods.</p></div><Factory size={23} aria-hidden="true" /></div>
      <section className="dcl-production-queue" data-dc-tutorial="production-queue" aria-label="Production queue">{jobs.map(job => { const name = snapshot.recipes?.find(item => item.key === job.recipe_key)?.name ?? job.recipe_key; const queued = now < Date.parse(job.started_at); const due = now >= Date.parse(job.completes_at); const fraction = Math.max(0, Math.min(100, 100 * (now - Date.parse(job.started_at)) / (Date.parse(job.completes_at) - Date.parse(job.started_at)))); return <article className="dcl-card dcl-production-job" key={job.id}><header><div><h3>{name}</h3><p>{BUILDING_INFO[job.station].name} · {job.batches} {job.batches === 1 ? 'batch' : 'batches'}</p></div><ClaimBadge tone={job.status === 'ready' ? 'green' : 'blue'}>{job.status === 'ready' ? 'Ready' : queued ? 'Queued' : 'Processing'}</ClaimBadge></header><ClaimMeter value={fraction} max={100} label={`${name} elapsed time`} tone="blue" /><p>{job.status === 'ready' ? `${resourceTotal(job.outputs)} material units${job.equipment_outputs.length ? ` · ${job.equipment_outputs.length} equipment` : ''} staged` : queued ? `Starts in ${claimTimeLeft(job.started_at, now)}` : `Return in ${claimTimeLeft(job.completes_at, now)}`}</p>{job.status === 'ready' ? <ClaimButton primary disabled={readOnly || busy} onClick={() => { setError(''); void collectProduction(job).catch(failure => setError(failure instanceof Error ? failure.message : 'Collection could not be confirmed.')); }} aria-label={`Collect ${name}`}><Package size={14} aria-hidden="true" />Collect</ClaimButton> : due ? <ClaimButton onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />Check production</ClaimButton> : null}</article>; })}{!jobs.length && <ClaimEmpty title="The benches are clear." icon={<Factory aria-hidden="true" />}>Choose a recipe below to start the first batch.</ClaimEmpty>}</section>
      <div className="dcl-segment dcl-station-selector" data-dc-tutorial="production-station" role="group" aria-label="Production station">{(['smeltery', 'gem_workshop', 'tool_station'] as const).map(key => <button type="button" key={key} aria-pressed={station === key} onClick={() => onStation(key)}>{BUILDING_INFO[key].name}</button>)}</div>
      {stationBuilding?.level === 0 && <section className="dcl-card dcl-capacity-callout"><div><strong>{BUILDING_INFO[station].name} is not built</strong><p>{BUILDING_INFO[station].description}</p></div><ClaimButton primary disabled={readOnly || busy} onClick={() => onBuild(station)}>Build {BUILDING_INFO[station].name}</ClaimButton></section>}
      <div className="dcl-recipe-grid" data-dc-tutorial="production-recipes">{snapshot.recipes?.filter(item => item.station === station).map(item => <article className="dcl-card dcl-recipe-card" key={item.key}><header>{item.equipment_output ? <DeepClaimEquipmentIcon archetype={item.equipment_output} decorative /> : <DeepClaimResourceIcon resourceId={Object.keys(item.outputs)[0] as DeepClaimResourceId} decorative />}<div><h3>{item.name}</h3><p><Clock3 size={12} aria-hidden="true" />{productionTime(item.effective_duration_seconds)} / batch · {item.cash_cost} cr</p></div></header><Materials resources={item.inputs} />{(item.required_research ?? []).some(key => !completedResearch.has(key)) && <p className="dcl-recipe-lock">Research required</p>}{(item.research_speed_percent ?? 0) > 0 && <p className="dcl-recipe-lock">Includes {item.research_speed_percent}% research reduction</p>}<ClaimButton onClick={() => { setRecipeKey(item.key); setBatches(1); setReviewed(null); setError(''); }} aria-label={`Review ${item.name}`}>Review recipe<ArrowRight size={13} aria-hidden="true" /></ClaimButton></article>)}</div>
      <p className="dcl-note">Three uncollected jobs across the company. Each station runs one serial lane; different stations work at the same time. Finished goods stay staged until collected.</p>
    </>}
    {error && !recipeKey && <p className="dcl-error" role="alert">{error}</p>}
    <ClaimDialog open={!!recipeKey} onClose={() => setRecipeKey(null)} busy={busy} title={recipe?.name ?? 'Production recipe'} description={reviewed === null ? 'Choose a bounded batch, then review the complete cost.' : 'Confirm the inputs, station and expected output before starting.'}>{recipe && <>
      <div className="dcl-recipe-identity" data-dc-tutorial="production-recipe">{recipe.equipment_output ? <DeepClaimEquipmentIcon archetype={recipe.equipment_output} decorative /> : <Hammer size={45} aria-hidden="true" />}<div><ClaimBadge>{BUILDING_INFO[recipe.station].name}</ClaimBadge><p>Recipe version {recipe.version} · station level {recipe.required_station_level}+</p></div></div>
      {!!producedGear?.thermal_reduction_percent && <p className="dcl-note">Heat protection: up to {producedGear.thermal_reduction_percent} percentage points per working, assigned shield, averaged across the crew. It shares the head slot with helmets. Broken, unassigned or another worker’s gear gives no protection.</p>}<label>Production batches<input aria-label="Production batches" type="number" min="1" max={recipe.max_batches} step="1" value={Number.isNaN(batches) ? '' : batches} disabled={busy || reviewed !== null} onChange={event => setBatches(Number(event.target.value))} /></label>
      <section className="dcl-batch-review" data-dc-tutorial="production-review"><h3>Inputs committed now</h3><Materials resources={inputs} /><div className="dcl-trade-summary"><span>Batch cost<small>Plus 2 credits kept for operating reserve</small></span><strong>{validBatches ? recipe.cash_cost * batches : '—'} cr</strong></div><h3>Finished output</h3><Materials resources={output} />{recipe.equipment_output && <p className="dcl-note">{validBatches ? batches : '—'} × {equipmentCatalog.find(item => item.key === recipe.equipment_output)?.name ?? recipe.equipment_output} · created as owned items on collection</p>}<p className="dcl-note">Processing time: {validBatches ? productionTime(recipe.effective_duration_seconds * batches) : '—'}, after earlier work on this station. Output stays unavailable until collected.</p></section>
      {reasons.length > 0 && <ul className="dcl-blocked-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}{!validBatches && <p className="dcl-error">Choose a whole batch count from 1 to {recipe.max_batches}.</p>}{stale && <p className="dcl-note">Your company changed. Review this batch again.</p>}{error && <p className="dcl-error" role="alert">{error}</p>}
      {missingResearch.length > 0 && onResearch && <ClaimButton onClick={() => { setRecipeKey(null); onResearch(missingResearch[0]); }}>View required research</ClaimButton>}
      {currentBuilding && currentBuilding.level < recipe.required_station_level && <ClaimButton onClick={() => { setRecipeKey(null); onBuild(recipe.station); }}>{currentBuilding.level === 0 ? 'Build' : 'Upgrade'} {BUILDING_INFO[recipe.station].name}</ClaimButton>}
      <div className="dcl-dialog-actions"><ClaimButton disabled={busy} onClick={() => { if (reviewed !== null) setReviewed(null); else setRecipeKey(null); }}>Back</ClaimButton>{reviewed === null || stale ? <ClaimButton primary disabled={!validBatches || busy} onClick={() => { setReviewed(snapshot.revision); tutorial.emit('recipe_inspected', { recipe_key: recipe.key, view: 'review', quantity: batches }); }}>Review batch</ClaimButton> : <ClaimButton primary pending={busy} disabled={reasons.length > 0 || !validBatches || readOnly} onClick={() => void start()}>Start production</ClaimButton>}</div>
    </>}</ClaimDialog>
  </>;
}

function Materials({ resources }: { resources: DeepClaimResources }) {
  return <div className="dcl-material-costs">{Object.entries(resources).map(([key, quantity]) => <span key={key}><DeepClaimResourceIcon resourceId={key as DeepClaimResourceId} decorative /><b>{quantity}</b> {RESOURCE_BY_ID[key as DeepClaimResourceId].name}</span>)}</div>;
}

function productionTime(seconds: number) { const minutes = Math.floor(seconds / 60), remainder = seconds % 60; return minutes ? `${minutes} min${remainder ? ` ${remainder}s` : ''}` : `${remainder}s`; }
