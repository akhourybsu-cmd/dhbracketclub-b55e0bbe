import { useEffect, useId, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, Coins, Gem, Layers3, Package } from 'lucide-react';
import { resourceCatalogForSchema, resourceQuantity } from '@/lib/deepClaim/catalog';
import type { DeepClaimExpedition, DeepClaimResourceId, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimEmpty, ClaimMeter } from './DeepClaimPrimitives';
import { TutorialHelp, useDeepClaimTutorialEvents, useTutorialView } from './tutorial/events';
import './inventory.css';

type MaterialGroup = 'all' | 'raw' | 'refined' | 'crystals';
const GROUPS = [{ id: 'all', label: 'All', icon: Package }, { id: 'raw', label: 'Raw', icon: Layers3 }, { id: 'refined', label: 'Refined', icon: Coins }, { id: 'crystals', label: 'Crystals', icon: Gem }] as const;
const PAGE_SIZE = 6;
function materialGroup(id: DeepClaimResourceId): Exclude<MaterialGroup, 'all'> {
  if (['quartz', 'amethyst', 'polished_quartz', 'cut_amethyst'].includes(id)) return 'crystals';
  return id.endsWith('_bar') || id === 'nickel_alloy' ? 'refined' : 'raw';
}

/** Presentation of disclosed warehouse stock. All sales still use the existing confirmed server operation. */
export function DeepClaimStores({ snapshot, readOnly, busy, onSell, readyHauls = [], onOpenHaul, inStockOnly = false }: {
  snapshot: DeepClaimSnapshot; readOnly: boolean; busy: boolean; onSell: (resource: DeepClaimResourceId) => void;
  readyHauls?: DeepClaimExpedition[]; onOpenHaul?: (id: string) => void; inStockOnly?: boolean;
}) {
  const tutorial = useDeepClaimTutorialEvents();
  useTutorialView('stock_inspected', { view: 'stock' }, 'warehouse-stock');
  const [group, setGroup] = useState<MaterialGroup>('all');
  const [page, setPage] = useState(0);
  const [inspectedId, setInspectedId] = useState<DeepClaimResourceId | null>(null);
  const itemsId = useId();
  useEffect(() => { setPage(0); }, [group, inStockOnly]);
  const company = snapshot.company!;
  const resources = resourceCatalogForSchema(snapshot.schema_version);
  const stored = resources.filter(resource => resourceQuantity(snapshot.resources, resource.id) > 0);
  const available = inStockOnly ? stored : resources;
  const filtered = available.filter(resource => group === 'all' || materialGroup(resource.id) === group);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const inspected = resources.find(resource => resource.id === inspectedId);
  const inspectedQuantity = inspected ? resourceQuantity(snapshot.resources, inspected.id) : 0;
  const uses = inspected ? (snapshot.recipes ?? []).filter(recipe => resourceQuantity(recipe.inputs, inspected.id) > 0) : [];
  const full = company.warehouse_used >= company.warehouse_capacity;
  function sell(id: DeepClaimResourceId) {
    if (readOnly || busy || resourceQuantity(snapshot.resources, id) <= 0) return;
    tutorial.emit('stock_inspected', { view: 'stock', resource_key: id });
    setInspectedId(null);
    onSell(id);
  }
  return <section className="dcl-inventory" aria-label="Warehouse inventory">
    <div className="dcl-section-heading"><div><h2>The warehouse</h2></div><TutorialHelp lessonId="industry.warehouse" label="Warehouse" /><Package size={23} aria-hidden="true" /></div>
    {readyHauls.length > 0 && <section className="dcl-staged-hauls" aria-label="Staged hauls">{readyHauls.map(job => <ClaimButton key={job.id} onClick={() => onOpenHaul?.(job.id)}><Package size={16} aria-hidden="true" />Open haul from {job.target.y}m</ClaimButton>)}</section>}
    <section className="dcl-card dcl-storage-summary dcl-inventory-capacity" data-dc-tutorial="stores-capacity">
      <div><span className="dcl-inventory-capacity-icon" aria-hidden="true"><Package size={26} /></span><strong>{company.warehouse_used.toLocaleString()}<small> / {company.warehouse_capacity.toLocaleString()} units</small></strong><ClaimBadge tone={full ? 'red' : 'green'}>{full ? 'Full' : `${company.warehouse_capacity - company.warehouse_used} space`}</ClaimBadge></div>
      <ClaimMeter value={company.warehouse_used} max={company.warehouse_capacity} label="Warehouse capacity" tone={full ? 'red' : 'green'} />
      <p>{stored.length} material {stored.length === 1 ? 'type' : 'types'} stored · Excess cargo stays staged.</p>
    </section>
    <div className="dcl-inventory-categories" role="group" aria-label="Material category">{GROUPS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={group === id} aria-controls={itemsId} onClick={() => setGroup(id)}><Icon size={15} aria-hidden="true" /><span>{label}</span><small>{available.filter(resource => id === 'all' || materialGroup(resource.id) === id).length}</small></button>)}</div>
    <div id={itemsId} className="dcl-resource-grid dcl-inventory-grid" data-dc-tutorial="stores-stock" aria-label="Materials">
      {visible.map(resource => {
        const quantity = resourceQuantity(snapshot.resources, resource.id);
        return <article className="dcl-card dcl-resource-card dcl-inventory-slot" key={resource.id} data-dc-tutorial="stores-resource" data-empty={quantity === 0} style={{ '--dcl-item-color': resource.color } as CSSProperties}>
          <button className="dcl-inventory-inspect" type="button" aria-label={`Inspect ${resource.name}`} onClick={() => { setInspectedId(resource.id); tutorial.emit('stock_inspected', { view: 'stock', resource_key: resource.id }); }}>
            <span className="dcl-inventory-quantity" aria-label={`${quantity.toLocaleString()} in storage`}>×{quantity.toLocaleString()}</span>
            <span className="dcl-inventory-item-art"><DeepClaimResourceIcon resourceId={resource.id} decorative /></span>
            <h3>{resource.name}</h3>
          </button>
          <footer><span>{resource.sell_price}<Coins size={11} aria-hidden="true" /><small>/ unit</small></span>{quantity > 0 ? <button type="button" className="dcl-inventory-sell" disabled={readOnly || busy} onClick={() => sell(resource.id)} aria-label={`Sell ${resource.name}`}><Coins size={13} aria-hidden="true" /><span>Sell</span></button> : <span className="dcl-stock-empty">No stock yet</span>}</footer>
        </article>;
      })}
    </div>
    {filtered.length > 0 && <nav className="dcl-inventory-pages" aria-label="Inventory pages"><ClaimButton className="is-small" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous materials"><ArrowLeft size={15} aria-hidden="true" /></ClaimButton><span role="status" aria-live="polite">{currentPage * PAGE_SIZE + 1}–{Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} <small>/ {filtered.length} materials</small></span><ClaimButton className="is-small" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)} aria-label="Next materials"><ArrowRight size={15} aria-hidden="true" /></ClaimButton></nav>}
    {!filtered.length && <ClaimEmpty title={inStockOnly && !stored.length ? 'Your stores are clear.' : 'No materials in this section.'} icon={<Package aria-hidden="true" />}>{inStockOnly && !stored.length ? 'Collect a haul or a finished batch to add stored materials.' : 'Choose another category or browse all materials.'}</ClaimEmpty>}
    <ClaimDialog open={!!inspected} onClose={() => setInspectedId(null)} title={inspected?.name ?? 'Material'} description={inspected?.description} className="dcl-inventory-dialog" footer={inspected && <div className="dcl-dialog-actions"><ClaimButton onClick={() => setInspectedId(null)}>Back to inventory</ClaimButton><ClaimButton primary disabled={readOnly || busy || inspectedQuantity <= 0} onClick={() => sell(inspected.id)} aria-label={`Sell ${inspected.name}`}><Coins size={15} aria-hidden="true" />Sell</ClaimButton></div>}>
      {inspected && <>
        <div className="dcl-inventory-detail" style={{ '--dcl-item-color': inspected.color } as CSSProperties}>
          <span className="dcl-inventory-detail-art"><DeepClaimResourceIcon resourceId={inspected.id} decorative /></span>
          <div><ClaimBadge>{GROUPS.find(category => category.id === materialGroup(inspected.id))?.label}</ClaimBadge><strong>{inspectedQuantity.toLocaleString()}<small> in storage</small></strong><span>{inspected.sell_price} cr / unit</span></div>
        </div>
        <div className="dcl-trade-summary"><span>Stock sale value<small>At the current unit price</small></span><strong>{(inspectedQuantity * inspected.sell_price).toLocaleString()} cr</strong></div>
        {uses.length > 0 && <section className="dcl-inventory-uses" aria-label="Used in production"><h3>Workshop uses</h3>{uses.slice(0, 3).map(recipe => <span key={recipe.key}><b>{resourceQuantity(recipe.inputs, inspected.id)}×</b>{recipe.name}</span>)}{uses.length > 3 && <small>+{uses.length - 3} more recipes</small>}</section>}
        {inspectedQuantity === 0 && <p className="dcl-note">No collected stock. Materials become available after a haul or finished batch is collected.</p>}

      </>}
    </ClaimDialog>
  </section>;
}
