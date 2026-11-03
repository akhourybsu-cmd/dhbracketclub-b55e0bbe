import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Clock3, Coins, Factory, Package, RefreshCw } from 'lucide-react';
import { BUILDING_INFO, RESOURCE_BY_ID, resourceQuantity, resourceTotal } from '@/lib/deepClaim/catalog';
import type { DeepClaimBuildingId, DeepClaimProductionJob, DeepClaimProductionStation, DeepClaimRecipe, DeepClaimResourceId, DeepClaimResources, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimEquipmentIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { DeepClaimStores } from './DeepClaimPanels';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimEmpty, ClaimMeter } from './DeepClaimPrimitives';
import { claimTimeLeft } from './display';
import { TutorialToolbar, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';
import './deepClaimIndustry.css';

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
  const locationMatches = previousLocation.current.view === view && previousLocation.current.station === station;
  useLayoutEffect(() => {
    if (previousLocation.current.view === view && previousLocation.current.station === station) return;
    previousLocation.current = { view, station };
    setRecipeKey(null); setBatches(1); setReviewed(null); setError('');
  }, [view, station]);
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock'>('in_stock');
  const jobs = snapshot.production_jobs?.filter(job => job.status !== 'collected') ?? [];
  const recipe = locationMatches ? snapshot.recipes?.find(item => item.key === recipeKey && item.station === station) : undefined;
  useLayoutEffect(() => {
    if (!locationMatches || !recipeKey || snapshot.recipes?.some(item => item.key === recipeKey && item.station === station)) return;
    setRecipeKey(null); setBatches(1); setReviewed(null); setError('Recipe unavailable. Choose another recipe.');
  }, [locationMatches, recipeKey, snapshot.recipes, station]);
  useTutorialView('recipe_inspected', recipe ? { recipe_key: recipe.key, view: recipe.station } : null, `recipe:${recipe?.key}`);
  const producedGear = snapshot.equipment_catalog?.find(item => item.key === recipe?.equipment_output);
  const stationBuilding = snapshot.buildings.find(item => item.key === station);
  const equipmentCatalog = snapshot.equipment_catalog ?? [];
  const validBatches = !!recipe && Number.isSafeInteger(batches) && batches >= 1 && batches <= recipe.max_batches;
  const inputs = Object.fromEntries(Object.entries(recipe?.inputs ?? {}).map(([key, count]) => [key, (count ?? 0) * (validBatches ? batches : 1)])) as DeepClaimResources;
  const output = Object.fromEntries(Object.entries(recipe?.outputs ?? {}).map(([key, count]) => [key, (count ?? 0) * (validBatches ? batches : 1)])) as DeepClaimResources;
  const currentBuilding = snapshot.buildings.find(item => item.key === recipe?.station);
  const requiredGear = (snapshot.equipment?.length ?? 0) + jobs.reduce((sum, job) => sum + job.equipment_outputs.length, 0) + (recipe?.equipment_output ? batches : 0);
  const completedResearch = new Set(snapshot.business?.research.filter(item => item.status === 'completed').map(item => item.key));
  const missingResearch = (recipe?.required_research ?? []).filter(key => !completedResearch.has(key));
  const reasons: string[] = [];
  for (const key of missingResearch) reasons.push(`Complete ${snapshot.business_catalog?.research.find(item => item.key === key)?.name ?? key} research first.`);
  if (recipe?.locked && !missingResearch.length) reasons.push('This recipe is locked. Refresh the company to review its requirements.');
  if (recipe && (currentBuilding?.level ?? 0) < recipe.required_station_level) reasons.push(`${BUILDING_INFO[recipe.station].name} level ${recipe.required_station_level} is required.`);
  if (jobs.length >= 3) reasons.push(jobs.some(job => job.status === 'ready') ? 'Collect finished production to free one of the three company queue slots.' : 'All 3 queue slots are in use. Collect an order when it finishes.');
  if (recipe && validBatches && (snapshot.company?.cash ?? 0) < recipe.cash_cost * batches + 2) reasons.push('Keep enough company credits for the batch and the 2-credit operating reserve.');
  if (validBatches) for (const [key, amount] of Object.entries(inputs)) if (resourceQuantity(snapshot.resources, key as DeepClaimResourceId) < (amount ?? 0)) reasons.push(`Need ${amount} ${RESOURCE_BY_ID[key as DeepClaimResourceId].name}; ${resourceQuantity(snapshot.resources, key as DeepClaimResourceId)} stored.`);
  if (recipe?.equipment_output && validBatches && requiredGear > (snapshot.company?.equipment_capacity ?? 48)) reasons.push('Equipment storage is full. Retire unassigned equipment before crafting more.');
  if (readOnly) reasons.push('Reconnect or confirm the saved action before starting production.');
  const stale = reviewed !== null && reviewed < snapshot.revision;
  async function start() {
    if (!recipe || !validBatches || reasons.length || stale || reviewed === null || busy) return;
    setError('');
    try { await startProduction(recipe.key, batches); setRecipeKey(null); onConfirmed('Production queued.', `${recipe.name} · ${batches} ${batches === 1 ? 'batch' : 'batches'}`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Production could not be confirmed. Check the saved action.'); }
  }
  return <>
    <TutorialToolbar lessonId={view === 'stock' ? 'industry.warehouse' : station === 'smeltery' ? 'industry.smeltery' : station === 'gem_workshop' ? 'industry.gems' : 'industry.crafting'} label={view === 'stock' ? 'Stock' : 'Production'}><div className="dcl-segment" role="group" aria-label="Stores view"><button type="button" aria-pressed={view === 'stock'} onClick={() => onView('stock')}>Stock</button><button type="button" aria-pressed={view === 'workshop'} onClick={() => onView('workshop')}>Workshop <small>{jobs.length}/3</small></button></div></TutorialToolbar>
    {view === 'stock' ? <><div className="dcl-stock-filter" role="group" aria-label="Stock filter"><button type="button" aria-pressed={stockFilter === 'in_stock'} onClick={() => setStockFilter('in_stock')}>In stock</button><button type="button" aria-pressed={stockFilter === 'all'} onClick={() => setStockFilter('all')}>All materials</button></div><DeepClaimStores snapshot={snapshot} readOnly={readOnly} busy={busy} onSell={onSell} readyHauls={snapshot.expeditions.filter(job => job.status === 'ready')} onOpenHaul={onOpenHaul} inStockOnly={stockFilter === 'in_stock'} />{jobs.some(job => job.status === 'ready') && <ClaimButton primary onClick={() => onView('workshop')}><Package size={15} aria-hidden="true" />Collect finished production</ClaimButton>}</> : <>
      <div className="dcl-section-heading"><div><h2>Workshop</h2></div><Factory size={23} aria-hidden="true" /></div>
      <section className="dcl-production-queue dcl-industry-queue" data-dc-tutorial="production-queue" aria-label="Production queue"><div className="dcl-industry-queue-heading"><span>WORK ORDERS</span><b>{jobs.length}<small> / 3 slots</small></b></div>{jobs.map(job => {
        const name = snapshot.recipes?.find(item => item.key === job.recipe_key)?.name ?? job.recipe_key;
        const started = Date.parse(job.started_at), completes = Date.parse(job.completes_at);
        const queued = now < started, due = now >= completes;
        const elapsed = completes > started ? 100 * (now - started) / (completes - started) : 0;
        const fraction = job.status === 'ready' ? 100 : Number.isFinite(elapsed) ? Math.max(0, Math.min(100, elapsed)) : 0;
        const outputResource = Object.keys(job.outputs).find(key => resourceQuantity(job.outputs, key as DeepClaimResourceId) > 0) as DeepClaimResourceId | undefined;
        const materialUnits = resourceTotal(job.outputs);
        const warehouseSpace = Math.max(0, (snapshot.company?.warehouse_capacity ?? 0) - (snapshot.company?.warehouse_used ?? 0));
        const needsWarehouseSpace = materialUnits > 0 && warehouseSpace === 0 && !job.equipment_outputs.length;
        const staged = [materialUnits > 0 ? `${materialUnits} material ${materialUnits === 1 ? 'unit' : 'units'}` : '', job.equipment_outputs.length ? `${job.equipment_outputs.length} ${job.equipment_outputs.length === 1 ? 'equipment item' : 'equipment items'}` : ''].filter(Boolean).join(' · ');
        return <article className="dcl-card dcl-production-job dcl-industry-job" key={job.id} data-production-state={job.status === 'ready' ? 'ready' : queued ? 'queued' : due ? 'awaiting-confirmation' : 'working'}>
          <header><div className="dcl-industry-output-art" aria-hidden="true">{job.equipment_outputs[0] ? <DeepClaimEquipmentIcon archetype={job.equipment_outputs[0]} decorative /> : outputResource ? <DeepClaimResourceIcon resourceId={outputResource} decorative /> : <Package size={30} />}</div><div><h3>{name}</h3><p>{BUILDING_INFO[job.station].name} · {job.batches} {job.batches === 1 ? 'batch' : 'batches'}</p></div><ClaimBadge tone={job.status === 'ready' ? 'green' : 'blue'}>{job.status === 'ready' ? 'Ready' : queued ? 'Queued' : 'Processing'}</ClaimBadge></header>
          <div className="dcl-industry-progress-label"><span>{job.status === 'ready' ? 'Ready to collect' : queued ? 'Waiting for this station' : due ? 'Checking completion' : 'Work in progress'}</span><b>{Math.floor(fraction)}%</b></div>
          <ClaimMeter value={fraction} max={100} label={`${name} elapsed time`} tone={job.status === 'ready' ? 'green' : 'blue'} />
          <p>{job.status === 'ready' ? `${staged || 'Finished output'} staged` : queued ? `Starts in ${claimTimeLeft(job.started_at, now)}` : due ? 'Check production to confirm completion.' : `Return in ${claimTimeLeft(job.completes_at, now)}`}</p>
          {job.status === 'ready' && materialUnits > warehouseSpace && <div className="dcl-industry-storage"><p>{warehouseSpace === 0 ? 'Warehouse full' : `${warehouseSpace} ${warehouseSpace === 1 ? 'unit fits' : 'units fit'} now · the rest stays staged`}</p><ClaimButton onClick={() => onView('stock')}>Make room in Stores<ArrowRight size={14} aria-hidden="true" /></ClaimButton></div>}
          {job.status === 'ready' ? <ClaimButton primary disabled={readOnly || busy || needsWarehouseSpace} onClick={() => { setError(''); void collectProduction(job).catch(failure => setError(failure instanceof Error ? failure.message : 'Collection could not be confirmed.')); }} aria-label={`Collect ${name}`}><Package size={14} aria-hidden="true" />Collect</ClaimButton> : due ? <ClaimButton onClick={onRefresh}><RefreshCw size={14} aria-hidden="true" />Check production</ClaimButton> : null}
        </article>;
      })}{!jobs.length && <ClaimEmpty title="No work orders" icon={<Factory aria-hidden="true" />}>{null}</ClaimEmpty>}</section>
      <div className="dcl-segment dcl-station-selector dcl-industry-stations" data-dc-tutorial="production-station" role="group" aria-label="Production station">{(['smeltery', 'gem_workshop', 'tool_station'] as const).map(key => <button type="button" key={key} aria-label={BUILDING_INFO[key].name} aria-pressed={station === key} onClick={() => onStation(key)}><span aria-hidden="true">{key === 'tool_station' ? <DeepClaimEquipmentIcon archetype="copper_pickaxe" decorative /> : <DeepClaimResourceIcon resourceId={key === 'smeltery' ? 'copper_bar' : 'polished_quartz'} decorative />}</span><strong>{BUILDING_INFO[key].name}</strong><small>Lv {snapshot.buildings.find(item => item.key === key)?.level ?? 0}</small></button>)}</div>
      {stationBuilding?.level === 0 && <section className="dcl-card dcl-capacity-callout"><div><strong>{BUILDING_INFO[station].name} is not built</strong><p>{BUILDING_INFO[station].description}</p></div><ClaimButton primary disabled={readOnly || busy} onClick={() => onBuild(station)}>Build {BUILDING_INFO[station].name}</ClaimButton></section>}
      <div className="dcl-recipe-grid dcl-industry-recipes" data-dc-tutorial="production-recipes">{snapshot.recipes?.filter(item => item.station === station).map(item => <article className="dcl-card dcl-recipe-card dcl-industry-recipe" key={item.key}><div className="dcl-industry-recipe-art"><RecipeArtwork recipe={item} /><span>{item.equipment_output ? 'EQUIPMENT' : 'REFINED GOODS'}</span></div><header><div><h3>{item.name}</h3><p><Clock3 size={12} aria-hidden="true" />{productionTime(item.effective_duration_seconds)} / batch <span>·</span><Coins size={12} aria-hidden="true" />{item.cash_cost} cr</p></div></header><Materials resources={item.inputs} />{(item.required_research ?? []).some(key => !completedResearch.has(key)) && <p className="dcl-recipe-lock">Research required</p>}{(item.research_speed_percent ?? 0) > 0 && <p className="dcl-recipe-lock">Processing time −{item.research_speed_percent}%</p>}<ClaimButton onClick={() => { setRecipeKey(item.key); setBatches(1); setReviewed(null); setError(''); }} aria-label={`Review ${item.name}`}>Review recipe<ArrowRight size={13} aria-hidden="true" /></ClaimButton></article>)}</div>
      <p className="dcl-note">3 uncollected jobs maximum · 1 job per station at a time.</p>
    </>}
    {error && !recipeKey && <p className="dcl-error" role="alert">{error}</p>}
    <ClaimDialog open={!!recipe} onClose={() => setRecipeKey(null)} busy={busy} title={recipe?.name ?? 'Production recipe'} description="" footerNote={recipe && <><span>Batch fee · 2 cr reserve</span><strong>{validBatches ? (recipe.cash_cost * batches).toLocaleString() : '—'} cr</strong></>} footer={recipe && <div className="dcl-dialog-actions"><ClaimButton disabled={busy} onClick={() => { if (reviewed !== null) setReviewed(null); else setRecipeKey(null); }}>Back</ClaimButton>{reviewed === null || stale ? <ClaimButton primary disabled={!validBatches || busy} onClick={() => { setReviewed(snapshot.revision); tutorial.emit('recipe_inspected', { recipe_key: recipe.key, view: 'review', quantity: batches }); }}>Review batch</ClaimButton> : <ClaimButton primary pending={busy} disabled={reasons.length > 0 || !validBatches || readOnly} onClick={() => void start()}>Start production</ClaimButton>}</div>}>{recipe && <>
      <div className="dcl-recipe-identity dcl-industry-review-identity" data-dc-tutorial="production-recipe"><div className="dcl-industry-output-art"><RecipeArtwork recipe={recipe} /></div><div><ClaimBadge>{BUILDING_INFO[recipe.station].name}</ClaimBadge><p>Requires station level {recipe.required_station_level}</p></div></div>
      {!!producedGear?.thermal_reduction_percent && <p className="dcl-note">Heat protection: {producedGear.thermal_reduction_percent} percentage points per equipped worker, averaged across the crew. Uses the head slot; requires working condition.</p>}<label>Production batches<input aria-label="Production batches" type="number" min="1" max={recipe.max_batches} step="1" value={Number.isNaN(batches) ? '' : batches} disabled={busy || reviewed !== null} onChange={event => setBatches(Number(event.target.value))} /></label>
      <section className="dcl-batch-review dcl-industry-batch" data-dc-tutorial="production-review"><div className="dcl-industry-conversion"><section><h3>Inputs</h3><Materials resources={inputs} quantitiesKnown={validBatches} /></section><ArrowRight size={20} aria-hidden="true" /><section><h3>Output</h3><Materials resources={output} quantitiesKnown={validBatches} />{recipe.equipment_output && <div className="dcl-industry-equipment-output"><DeepClaimEquipmentIcon archetype={recipe.equipment_output} decorative /><span><b>{validBatches ? batches : '—'} × {equipmentCatalog.find(item => item.key === recipe.equipment_output)?.name ?? recipe.equipment_output}</b></span></div>}</section></div><div className="dcl-trade-summary"><span>Batch cost<small>2 cr operating reserve</small></span><strong>{validBatches ? recipe.cash_cost * batches : '—'} cr</strong></div><p className="dcl-note">Processing: {validBatches ? productionTime(recipe.effective_duration_seconds * batches) : '—'} after queued work. Collect when finished.</p></section>
      {reasons.length > 0 && <ul className="dcl-blocked-reasons">{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}{!validBatches && <p className="dcl-error">Choose a whole batch count from 1 to {recipe.max_batches}.</p>}{stale && <p className="dcl-note">Your company changed. Review this batch again.</p>}{error && <p className="dcl-error" role="alert">{error}</p>}
      {missingResearch.length > 0 && onResearch && <ClaimButton onClick={() => { setRecipeKey(null); onResearch(missingResearch[0]); }}>View required research</ClaimButton>}
      {currentBuilding && currentBuilding.level < recipe.required_station_level && <ClaimButton onClick={() => { setRecipeKey(null); onBuild(recipe.station); }}>{currentBuilding.level === 0 ? 'Build' : 'Upgrade'} {BUILDING_INFO[recipe.station].name}</ClaimButton>}

    </>}</ClaimDialog>
  </>;
}

function RecipeArtwork({ recipe }: { recipe: DeepClaimRecipe }) {
  if (recipe.equipment_output) return <DeepClaimEquipmentIcon archetype={recipe.equipment_output} decorative />;
  const resource = Object.keys(recipe.outputs)[0] as DeepClaimResourceId | undefined;
  return resource ? <DeepClaimResourceIcon resourceId={resource} decorative /> : <Package size={36} aria-hidden="true" />;
}

function Materials({ resources, quantitiesKnown = true }: { resources: DeepClaimResources; quantitiesKnown?: boolean }) {
  return <div className="dcl-material-costs">{Object.entries(resources).map(([key, quantity]) => <span key={key}><DeepClaimResourceIcon resourceId={key as DeepClaimResourceId} decorative /><b>{quantitiesKnown ? quantity : '—'}</b> {RESOURCE_BY_ID[key as DeepClaimResourceId].name}</span>)}</div>;
}

function productionTime(seconds: number) { const minutes = Math.floor(seconds / 60), remainder = seconds % 60; return minutes ? `${minutes} min${remainder ? ` ${remainder}s` : ''}` : `${remainder}s`; }
