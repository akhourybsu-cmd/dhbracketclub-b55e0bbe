import { useState } from 'react';
import { Coins, GraduationCap, HardHat, ShieldCheck, UserPlus, Wrench } from 'lucide-react';
import { SPECIALTY_INFO, STAT_INFO, TRAIT_INFO, RESOURCE_BY_ID, resourceQuantity } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_EQUIPMENT_SLOTS, DEEP_CLAIM_STAT_IDS, type DeepClaimCandidate, type DeepClaimEquipment, type DeepClaimSnapshot, type DeepClaimStatId, type DeepClaimWorker } from '@/lib/deepClaim/types';
import { DeepClaimEquipmentIcon, DeepClaimPortrait, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { DeepClaimCrew } from './DeepClaimPanels';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimEmpty, ClaimMeter } from './DeepClaimPrimitives';

export interface DeepClaimWorkforceActions {
  hire: (id: string) => Promise<DeepClaimSnapshot>;
  train: (id: string, stat: DeepClaimStatId) => Promise<DeepClaimSnapshot>;
  assignEquipment: (id: string, workerId: string | null) => Promise<DeepClaimSnapshot>;
  repairEquipment: (id: string) => Promise<DeepClaimSnapshot>;
  retireEquipment: (id: string) => Promise<DeepClaimSnapshot>;
}
interface WorkforceProps { snapshot: DeepClaimSnapshot; actions: DeepClaimWorkforceActions; busy: boolean; readOnly: boolean; onConfirmed: (title: string, description: string) => void; onQuarters: () => void; initialView?: 'staff' | 'hire' }

export function DeepClaimWorkforce({ snapshot, actions, busy, readOnly, onConfirmed, onQuarters, initialView = 'staff' }: WorkforceProps) {
  const [view, setView] = useState(initialView);
  const [hiring, setHiring] = useState<string | null>(null);
  const [error, setError] = useState('');
  const candidate = snapshot.candidates?.find(value => value.id === hiring);
  const capacity = snapshot.company?.worker_capacity ?? snapshot.workers.length;
  const full = snapshot.workers.length >= capacity;
  const affordable = !!candidate && (snapshot.company?.cash ?? 0) >= candidate.hire_cost + 2;
  async function hire() {
    if (!candidate || full || !affordable || readOnly || busy) return;
    setError('');
    try { await actions.hire(candidate.id); setHiring(null); onConfirmed(`${candidate.name} joined the crew.`, 'A persistent employee with their own daily energy, wage and skills.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The hire could not be confirmed. Check the saved action.'); }
  }
  return <>
    <div className="dcl-segment" role="group" aria-label="Crew view"><button type="button" aria-pressed={view === 'staff'} onClick={() => setView('staff')}>Staff <small>{snapshot.workers.length}/{capacity}</small></button><button type="button" aria-pressed={view === 'hire'} onClick={() => setView('hire')}>Hire</button></div>
    {view === 'staff' ? <DeepClaimCrew snapshot={snapshot} profileRenderer={(worker, onClose) => <WorkerFile worker={worker} snapshot={snapshot} actions={actions} busy={busy} readOnly={readOnly} onClose={onClose} onConfirmed={(title, description) => { onClose(); onConfirmed(title, description); }} />} /> : <>
      <div className="dcl-section-heading"><div><h2>The hiring office</h2><p>Today’s applicants · {snapshot.company?.energy_day}</p></div><ClaimBadge>{snapshot.workers.length}/{capacity} employed</ClaimBadge></div>
      {full && <section className="dcl-card dcl-capacity-callout"><div><strong>Make room for another worker</strong><p>Workers’ Quarters provide permanent housing capacity.</p></div><ClaimButton onClick={onQuarters}>Review quarters</ClaimButton></section>}
      <div className="dcl-candidate-list">{snapshot.candidates?.map(person => <article className="dcl-card dcl-candidate-card" key={person.id}><header><DeepClaimPortrait worker={person} /><div><h3>{person.name}</h3><p>{SPECIALTY_INFO[person.specialty].name}</p><small>{person.wage} cr per energy · wages paid on dispatch</small></div>{person.hired && <ClaimBadge tone="green">Hired</ClaimBadge>}</header><dl className="dcl-worker-stats">{DEEP_CLAIM_STAT_IDS.map(stat => <div key={stat}><dt>{STAT_INFO[stat].name}</dt><dd>{person.stats[stat]}</dd></div>)}</dl><p className="dcl-candidate-traits">{person.traits.map(trait => TRAIT_INFO[trait]?.name ?? trait).join(' · ')}</p><footer><strong><Coins size={13} aria-hidden="true" />{person.hire_cost} cr</strong>{!person.hired && <ClaimButton primary disabled={readOnly || busy || full || (snapshot.company?.cash ?? 0) < person.hire_cost + 2} onClick={() => { setHiring(person.id); setError(''); }} aria-label={`Hire ${person.name}`}><UserPlus size={14} aria-hidden="true" />Hire</ClaimButton>}</footer>{!person.hired && (snapshot.company?.cash ?? 0) < person.hire_cost + 2 && <p className="dcl-note">Need {person.hire_cost + 2 - (snapshot.company?.cash ?? 0)} more credits, including operating reserve.</p>}</article>)}</div>
      {!snapshot.candidates?.length && <ClaimEmpty title="The office is quiet." icon={<UserPlus aria-hidden="true" />}>New applicants arrive with the next company operating day.</ClaimEmpty>}
      <p className="dcl-note">The daily roster is fixed. Refreshing keeps the same applicants. Hiring is permanent; there are no wages while a worker is idle.</p>
    </>}
    <ClaimDialog open={!!hiring} onClose={() => setHiring(null)} busy={busy} title={candidate ? `Hire ${candidate.name}` : 'Applicant unavailable'} description="Review the fee, wage and housing before adding a permanent employee.">{candidate ? <><CandidateIdentity candidate={candidate} /><div className="dcl-trade-summary"><span>One-time hiring fee<small>Keep 2 credits for operating reserve.</small></span><strong>{candidate.hire_cost} cr</strong></div><p className="dcl-note">{candidate.wage} credits per energy used on future shifts. Housing after hire: {snapshot.workers.length + 1}/{capacity}.</p>{candidate.traits.map(key => <p className="dcl-note" key={key}><b>{TRAIT_INFO[key]?.name ?? key}:</b> {TRAIT_INFO[key]?.description}</p>)}{error && <p className="dcl-error" role="alert">{error}</p>}<ClaimButton primary pending={busy} disabled={readOnly || full || !affordable || candidate.hired} onClick={() => void hire()}>Confirm hire</ClaimButton></> : <p className="dcl-note">The operating day changed. Close this view and choose from the current roster.</p>}</ClaimDialog>
  </>;
}

function CandidateIdentity({ candidate }: { candidate: DeepClaimCandidate }) {
  return <div className="dcl-crew-profile"><DeepClaimPortrait worker={candidate} /><div><ClaimBadge>{SPECIALTY_INFO[candidate.specialty].name}</ClaimBadge><p>{candidate.wage} cr per energy on a shift</p></div></div>;
}

function WorkerFile({ worker, snapshot, actions, busy, readOnly, onConfirmed, onClose }: { worker: DeepClaimWorker; snapshot: DeepClaimSnapshot; actions: DeepClaimWorkforceActions; busy: boolean; readOnly: boolean; onConfirmed: (title: string, description: string) => void; onClose: () => void }) {
  const [view, setView] = useState<'overview' | 'training' | 'gear'>('overview');
  const [stat, setStat] = useState<DeepClaimStatId>('mining');
  const [confirm, setConfirm] = useState<{ kind: 'train' | 'equip' | 'unequip' | 'repair' | 'detail' | 'retire'; itemId?: string } | null>(null);
  const [error, setError] = useState('');
  const catalog = snapshot.equipment_catalog ?? [];
  const equipment = snapshot.equipment ?? [];
  const assigned = equipment.filter(item => item.worker_id === worker.id);
  const free = equipment.filter(item => item.worker_id === null);
  const pendingGear = snapshot.production_jobs?.filter(job => job.status !== 'collected').reduce((sum, job) => sum + job.equipment_outputs.length, 0) ?? 0;
  const item = equipment.find(item => item.id === confirm?.itemId);
  const definition = catalog.find(value => value.key === item?.definition_key);
  const idle = !worker.assigned_job_id;
  const trainedToday = worker.trained_day === snapshot.company?.energy_day;
  const base = worker.base_stats?.[stat] ?? worker.stats[stat];
  const gain = Math.min(worker.training_gain ?? 0, 100 - base);
  const trainingKnown = worker.training_cost != null && worker.training_gain != null;
  const enough = (cost: number) => (snapshot.company?.cash ?? 0) >= cost + 2;
  const materialShortage = !!item && Object.entries(item.repair_materials).some(([key, count]) => resourceQuantity(snapshot.resources, key as keyof DeepClaimEquipment['repair_materials']) < (count ?? 0));
  const blocked = readOnly || busy || !idle;
  async function perform() {
    if (!confirm || readOnly || busy || confirm.kind !== 'retire' && !idle || confirm.kind === 'detail') return;
    setError('');
    try {
      if (confirm.kind === 'train') { await actions.train(worker.id, stat); onConfirmed('Course completed.', `${worker.name} finished today’s ${STAT_INFO[stat].name} training.`); }
      else if (item && definition) {
        if (confirm.kind === 'retire') { if (item.worker_id !== null) return; await actions.retireEquipment(item.id); onConfirmed('Equipment retired.', `${definition.name} was permanently removed without a refund.`); }
        else if (confirm.kind === 'repair') { await actions.repairEquipment(item.id); onConfirmed('Equipment repaired.', `${definition.name} is ready for future shifts.`); }
        else { await actions.assignEquipment(item.id, confirm.kind === 'unequip' ? null : worker.id); onConfirmed(confirm.kind === 'unequip' ? 'Equipment returned to stores.' : 'Equipment assigned.', `${definition.name} · ${worker.name}`); }
      }
      setConfirm(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The change could not be confirmed. Check the saved action.'); }
  }
  function gearCard(piece: DeepClaimEquipment, owned: boolean) {
    const info = catalog.find(value => value.key === piece.definition_key);
    if (!info) return null;
    const occupied = assigned.some(value => catalog.find(entry => entry.key === value.definition_key)?.slot === info.slot);
    return <article className="dcl-equipment-card" key={piece.id}><DeepClaimEquipmentIcon archetype={info.key} tier={info.tier} durability={piece.durability} decorative /><div><button type="button" className="dcl-equipment-title" onClick={() => { setConfirm({ kind: 'detail', itemId: piece.id }); setError(''); }} aria-label={`View ${info.name}`}>{info.name}</button><small>{info.slot} · Tier {info.tier}</small><p>{DEEP_CLAIM_STAT_IDS.filter(key => info.bonuses[key]).map(key => `+${info.bonuses[key]} ${STAT_INFO[key].name}`).join(' · ')}</p>{!!info.thermal_reduction_percent && <p className="dcl-heat-perk">Heat protection: {piece.durability > 0 && owned ? `${info.thermal_reduction_percent} points for this worker` : piece.durability === 0 ? 'inactive · broken' : 'inactive · assign to a worker'}</p>}<ClaimMeter value={piece.durability} max={piece.max_durability} label={`${info.name} condition`} tone={piece.durability === 0 ? 'red' : 'green'} /><small>{piece.durability}/{piece.max_durability} condition{piece.durability === 0 ? ' · broken, bonuses inactive' : ''}</small></div><div className="dcl-equipment-actions"><ClaimButton className="is-small" disabled={blocked} onClick={() => { setConfirm({ kind: owned ? 'unequip' : 'equip', itemId: piece.id }); setError(''); }} aria-label={`${owned ? 'Unequip' : 'Equip'} ${info.name}`}>{owned ? 'Unequip' : occupied ? 'Replace slot' : 'Equip'}</ClaimButton>{piece.durability < piece.max_durability && <ClaimButton className="is-small" disabled={blocked || !enough(piece.repair_cost) || Object.entries(piece.repair_materials).some(([key, amount]) => resourceQuantity(snapshot.resources, key as keyof DeepClaimEquipment['repair_materials']) < (amount ?? 0))} onClick={() => { setConfirm({ kind: 'repair', itemId: piece.id }); setError(''); }} aria-label={`Repair ${info.name}`}><Wrench size={12} aria-hidden="true" />Repair</ClaimButton>}</div></article>;
  }
  return <>
    <div className="dcl-crew-profile"><DeepClaimPortrait worker={worker} /><div><ClaimBadge>Level {worker.level}</ClaimBadge><p>{worker.energy}/6 energy · {worker.wage} cr per energy</p></div></div>
    <div className="dcl-segment" role="group" aria-label="Worker file views">{(['overview', 'training', 'gear'] as const).map(key => <button type="button" aria-pressed={view === key} onClick={() => setView(key)} key={key}>{key === 'overview' ? 'Overview' : key === 'training' ? 'Training' : 'Gear'}</button>)}</div>
    {!idle && <p className="dcl-note">This worker is on a shift. Training, equipment changes and repairs are available after returning.</p>}
    {view === 'overview' ? <><dl className="dcl-stat-descriptions">{DEEP_CLAIM_STAT_IDS.map(key => <div key={key}><dt><b>{STAT_INFO[key].name}</b><strong>{worker.stats[key]}</strong></dt><dd>{STAT_INFO[key].description}</dd></div>)}</dl><div className="dcl-trait-list">{worker.traits.map(key => <section key={key}><ClaimBadge tone={TRAIT_INFO[key]?.positive ? 'green' : 'red'}>{TRAIT_INFO[key]?.name ?? key}</ClaimBadge><p>{TRAIT_INFO[key]?.description}</p></section>)}</div></> : view === 'training' ? <><p className="dcl-note">One paid course per operating day. Training improves the base skill; effective stats include experience and usable equipment.</p><label>Training skill<select aria-label="Training skill" value={stat} disabled={blocked || trainedToday} onChange={event => { setStat(event.target.value as DeepClaimStatId); setConfirm(null); }}>{DEEP_CLAIM_STAT_IDS.map(key => <option key={key} value={key}>{STAT_INFO[key].name} · base {worker.base_stats?.[key] ?? worker.stats[key]}</option>)}</select></label><div className="dcl-trade-summary"><span>{STAT_INFO[stat].name}<small>Base {base} → {base + gain} · effective {worker.stats[stat]}</small></span><strong>{worker.training_cost ?? '—'} cr</strong></div>{trainedToday && <p className="dcl-note">Today’s course is complete. Next opportunity: the next company operating day.</p>}{gain === 0 && <p className="dcl-note">This base skill is at its training cap.</p>}<ClaimButton primary disabled={blocked || trainedToday || !trainingKnown || gain <= 0 || !enough(worker.training_cost ?? 0)} onClick={() => { setConfirm({ kind: 'train' }); setError(''); }}><GraduationCap size={15} aria-hidden="true" />Review training</ClaimButton></> : <><p className="dcl-note">Company equipment: {equipment.length + pendingGear}/{snapshot.company?.equipment_capacity ?? 48} slots · {equipment.length} owned{pendingGear ? ` · ${pendingGear} crafting or staged` : ''}. Open an unassigned item’s details to retire it without a refund.</p><div className="dcl-gear-slots">{DEEP_CLAIM_EQUIPMENT_SLOTS.map(slot => <span key={slot}><HardHat size={13} aria-hidden="true" /><b>{slot}</b><small>{assigned.some(value => catalog.find(info => info.key === value.definition_key)?.slot === slot) ? 'Equipped' : 'Empty'}</small></span>)}</div>{assigned.map(piece => gearCard(piece, true))}<h3 className="dcl-subheading">Available equipment</h3>{free.length ? free.map(piece => gearCard(piece, false)) : <ClaimEmpty title="No spare equipment." icon={<HardHat aria-hidden="true" />}>Craft an item at the Tool Station, collect it, then assign it to an idle worker.</ClaimEmpty>}<p className="dcl-note">One item per slot. Replacements return the previous item to available equipment. Broken equipment supplies no bonus; repairs restore condition for future shifts.</p></>}
    <ClaimButton onClick={onClose}>Back to crew</ClaimButton>
    <ClaimDialog open={!!confirm} onClose={() => setConfirm(null)} busy={busy} title={confirm?.kind === 'train' ? `Train ${worker.name}` : confirm?.kind === 'repair' ? `Repair ${definition?.name ?? 'equipment'}` : confirm?.kind === 'detail' ? definition?.name ?? 'Equipment details' : confirm?.kind === 'retire' ? `Retire ${definition?.name ?? 'equipment'}` : 'Confirm equipment'} description={confirm?.kind === 'train' ? 'A permanent skill course for this operating day.' : 'Changes apply to future shifts. The worker must be idle.'}>{confirm?.kind === 'train' ? <><div className="dcl-trade-summary"><span>{STAT_INFO[stat].name} base {base} → {base + gain}</span><strong>{worker.training_cost} cr</strong></div><p className="dcl-note">Preserves 2 credits for operating reserve.</p></> : item && definition ? <><div className="dcl-sale-identity"><DeepClaimEquipmentIcon archetype={definition.key} tier={definition.tier} decorative /><strong>{definition.name}</strong></div><p className="dcl-note">{confirm?.kind === 'retire' ? 'Retiring permanently removes this unassigned item. There is no refund.' : confirm?.kind === 'detail' ? `Tier ${definition.tier} · ${definition.slot} · condition ${item.durability}/${item.max_durability}. ${DEEP_CLAIM_STAT_IDS.filter(key => definition.bonuses[key]).map(key => `+${definition.bonuses[key]} ${STAT_INFO[key].name}`).join(' · ')}` : confirm?.kind === 'repair' ? `Restore ${item.durability}/${item.max_durability} condition to full condition for ${item.repair_cost} credits.` : confirm?.kind === 'unequip' ? `Return this item from ${worker.name} to the company’s available equipment.` : `Assign this ${definition.slot} item to ${worker.name}.`}</p>{!!definition.thermal_reduction_percent && <p className="dcl-note">{definition.thermal_reduction_percent} percentage points heat protection for the equipped worker, averaged across the dispatched crew. Requires working condition and the head slot; broken or unassigned gear gives none.</p>}{confirm?.kind === 'repair' && <div className="dcl-material-costs">{Object.entries(item.repair_materials).map(([key, count]) => <span key={key}><DeepClaimResourceIcon resourceId={key as keyof DeepClaimEquipment['repair_materials']} decorative />{count} {RESOURCE_BY_ID[key as keyof DeepClaimEquipment['repair_materials']].name}</span>)}</div>}</> : <p className="dcl-note">Equipment details changed. Refresh the camp before continuing.</p>}{confirm?.kind === 'detail' && item?.worker_id === null && <ClaimButton danger disabled={readOnly || busy} onClick={() => { setConfirm({ kind: 'retire', itemId: item.id }); setError(''); }}>Retire item</ClaimButton>}{error && <p className="dcl-error" role="alert">{error}</p>}{confirm?.kind !== 'detail' && <ClaimButton primary pending={busy} disabled={readOnly || busy || confirm?.kind !== 'retire' && !idle || confirm?.kind === 'retire' && (!item || item.worker_id !== null) || confirm?.kind === 'train' && (trainedToday || gain <= 0 || !trainingKnown || !enough(worker.training_cost ?? 0)) || confirm?.kind === 'repair' && (!item || !enough(item.repair_cost) || materialShortage) || confirm?.kind !== 'train' && !definition} onClick={() => void perform()}><ShieldCheck size={15} aria-hidden="true" />{confirm?.kind === 'train' ? 'Confirm training' : confirm?.kind === 'repair' ? 'Confirm repair' : confirm?.kind === 'retire' ? 'Confirm retirement' : 'Confirm equipment'}</ClaimButton>}</ClaimDialog>
  </>;
}
