import { ArrowRight, BookOpenCheck, Boxes, PackageCheck, Pickaxe, Sparkles } from 'lucide-react';
import { RESOURCE_BY_ID, resourceTotal } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_RESOURCE_IDS, type DeepClaimResources } from '@/lib/deepClaim/types';
import { firstReturnReportAction, type ReturnReportAction, type ReturnReportData } from '@/lib/deepClaim/returnReport';
import { DeepClaimBusinessIcon, DeepClaimDiscoveryIcon, DeepClaimEquipmentIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimBadge, ClaimButton, ClaimDialog } from './DeepClaimPrimitives';
import './deepClaimReturnReport.css';

function Materials({ values }: { values: readonly DeepClaimResources[] }) {
  const totals = DEEP_CLAIM_RESOURCE_IDS.flatMap(id => {
    const quantity = values.reduce((total, resources) => total + (resources[id] ?? 0), 0);
    return quantity > 0 ? [{ id, quantity }] : [];
  });
  return <div className="dcl-return-materials" aria-label="Uncollected materials">{totals.slice(0, 4).map(({ id, quantity }) => <span key={id} aria-label={`${quantity.toLocaleString()} ${RESOURCE_BY_ID[id].name}`}><DeepClaimResourceIcon resourceId={id} decorative /><b>{quantity.toLocaleString()}</b><small>{RESOURCE_BY_ID[id].name}</small></span>)}{totals.length > 4 && <small>+{totals.length - 4} materials</small>}</div>;
}

export function DeepClaimReturnReport({ report, onClose, onAction }: {
  report: ReturnReportData; onClose: () => void; onAction: (action: ReturnReportAction) => void;
}) {
  const first = firstReturnReportAction(report);
  const cargoUnits = report.hauls.reduce((total, job) => total + resourceTotal(job.resources), 0);
  const productionUnits = report.production.reduce((total, job) => total + resourceTotal(job.resources), 0);
  const equipmentCount = report.production.reduce((total, job) => total + job.equipmentOutputs.length, 0);
  const equipment = report.production.flatMap(job => job.equipmentOutputs)[0];
  const workshopSummary = [productionUnits > 0 ? `${productionUnits.toLocaleString()} ${productionUnits === 1 ? 'unit' : 'units'}` : null,
    equipmentCount > 0 ? `${equipmentCount} equipment ${equipmentCount === 1 ? 'item' : 'items'}` : null].filter(Boolean).join(' · ') || 'Order finished';
  const sections = [report.hauls, report.production, report.finds, report.research].filter(items => items.length > 0).length;
  return <ClaimDialog open onClose={onClose} title="Shift report" description="" className="dcl-return-dialog" footer={<div className="dcl-dialog-actions"><ClaimButton onClick={onClose}>Back to camp</ClaimButton>{first && <ClaimButton primary onClick={() => onAction(first)}>Review returns<ArrowRight size={15} aria-hidden="true" /></ClaimButton>}</div>}>
    <div className="dcl-return-summary" data-dc-return-report>
      <header className="dcl-return-heading"><span className="dcl-return-stamp" aria-hidden="true"><BookOpenCheck size={24} /></span><div><strong>Camp ledger</strong><small>{sections} {sections === 1 ? 'update' : 'updates'}</small></div><ClaimBadge tone="green">Ready to review</ClaimBadge></header>
      {!!report.hauls.length && <section className="dcl-return-card" data-dc-return-kind="hauls" aria-label="Returned cargo">
        <header><Pickaxe size={18} aria-hidden="true" /><h3>Cargo returned</h3><span>{report.hauls.length} {report.hauls.length === 1 ? 'crew' : 'crews'}</span></header>
        <strong className="dcl-return-quantity">{cargoUnits.toLocaleString()}<small>units awaiting storage</small></strong>
        <Materials values={report.hauls.map(job => job.resources)} />
        <ClaimButton className="is-small" onClick={() => onAction({ kind: 'haul', id: report.hauls[0].id })}>Review cargo<ArrowRight size={14} aria-hidden="true" /></ClaimButton>
      </section>}
      {!!report.production.length && <section className="dcl-return-card" data-dc-return-kind="production" aria-label="Ready production">
        <header><Boxes size={18} aria-hidden="true" /><h3>Workshop finished</h3><span>{report.production.length} {report.production.length === 1 ? 'order' : 'orders'}</span></header>
        <div className="dcl-return-workshop"><span className="dcl-return-workshop-art" aria-hidden="true">{equipment ? <DeepClaimEquipmentIcon archetype={equipment} decorative /> : <PackageCheck size={28} />}</span><div><strong>{workshopSummary}</strong><small>Awaiting collection</small></div></div>
        {productionUnits > 0 && <Materials values={report.production.map(job => job.resources)} />}
        <ClaimButton className="is-small" onClick={() => onAction({ kind: 'production', station: report.production[0].station })}>Open workshop<ArrowRight size={14} aria-hidden="true" /></ClaimButton>
      </section>}
      {!!report.finds.length && <section className="dcl-return-card" data-dc-return-kind="finds" aria-label="Pending finds">
        <header><Sparkles size={18} aria-hidden="true" /><h3>Finds recovered</h3><span>{report.finds.length} pending</span></header>
        <div className="dcl-return-find"><DeepClaimDiscoveryIcon kind={report.finds[0].kind} quality={report.finds[0].quality} decorative /><div><strong>{report.finds[0].name}</strong><small>{report.finds[0].quality}{report.finds.length > 1 ? ` · +${report.finds.length - 1} finds` : ''}</small></div></div>
        <ClaimButton className="is-small" onClick={() => onAction({ kind: 'finds' })}>Inspect finds<ArrowRight size={14} aria-hidden="true" /></ClaimButton>
      </section>}
      {!!report.research.length && <section className="dcl-return-card" data-dc-return-kind="research" aria-label="Completed research">
        <header><BookOpenCheck size={18} aria-hidden="true" /><h3>Research complete</h3><span>{report.research.length} {report.research.length === 1 ? 'project' : 'projects'}</span></header>
        <div className="dcl-return-find"><DeepClaimBusinessIcon kind="research" decorative /><div><strong>{report.research[0].name}</strong>{report.research.length > 1 && <small>+{report.research.length - 1} completed</small>}</div></div>
        <ClaimButton className="is-small" onClick={() => onAction({ kind: 'research', key: report.research[0].key })}>Review research<ArrowRight size={14} aria-hidden="true" /></ClaimButton>
      </section>}
      {!sections && <p className="dcl-note">No new work to review.</p>}
    </div>
  </ClaimDialog>;
}
