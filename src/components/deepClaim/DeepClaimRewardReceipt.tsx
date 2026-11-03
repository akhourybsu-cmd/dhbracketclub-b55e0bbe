import type { CSSProperties } from 'react';
import { ArrowRight, Check, Coins, Package, Pickaxe } from 'lucide-react';
import { RESOURCE_CATALOG, resourceQuantity } from '@/lib/deepClaim/catalog';
import type { DeepClaimBuildingId, DeepClaimResources } from '@/lib/deepClaim/types';
import { ClaimBadge, ClaimButton, ClaimDialog } from './DeepClaimPrimitives';
import { DeepClaimMark } from './DeepClaimMark';
import { DeepClaimBuildingPortrait } from './renderer/DeepClaimBuildingPortrait';
import { DeepClaimEquipmentIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import './deepClaimRewardReceipt.css';

export interface RewardReceiptData {
  title: string;
  description: string;
  resources?: DeepClaimResources;
  remaining?: number;
  cash?: number;
  equipment?: { id: string; key: string; name: string; tier: 1 | 2 | 3 }[];
  buildingChange?: { key: DeepClaimBuildingId; fromLevel: number; toLevel: number; effect: string };
}

/** Original pixel crate: a display frame for a confirmed transfer, never a loot roll. */
function TransferCrate() {
  return <svg className="dcl-receipt-crate" viewBox="0 0 80 64" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <path fill="#171e1c" d="M4 52H76V60H4Z" />
    <path fill="#342d24" d="M8 20H72V54H8Z" />
    <path fill="#795539" d="M10 22H70V51H10Z" />
    <path fill="#b18a55" d="M10 22H70V27H10ZM10 45H70V51H10ZM13 27H18V45H13ZM62 27H67V45H62Z" />
    <path fill="#3d2d27" d="M18 28H62V31H18ZM18 40H62V43H18Z" />
    <path fill="#ac956b" d="M23 22H29V51H23ZM51 22H57V51H51Z" />
    <path fill="#d8c397" d="M24 24H27V27H24ZM52 24H55V27H52ZM24 45H27V48H24ZM52 45H55V48H52Z" />
    <path fill="#3a4b43" d="M15 17H27V21H15ZM30 13H48V21H30ZM51 16H64V21H51Z" />
    <path fill="#a5b2a1" d="M16 17H23V19H16ZM33 13H42V16H33ZM54 16H61V18H54Z" />
    <path fill="#d2b577" d="M5 10H11V12H5ZM8 7H10V15H8ZM66 7H72V9H66ZM68 4H70V12H68Z" />
  </svg>;
}

function LedgerSeal() {
  return <svg className="dcl-receipt-ledger" viewBox="0 0 80 64" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <path fill="#1b2521" d="M15 8H62V57H15Z" />
    <path fill="#a78e60" d="M18 5H59V54H18Z" />
    <path fill="#e3d6ad" d="M23 9H55V49H23Z" />
    <path fill="#795539" d="M18 5H23V54H18Z" />
    <path fill="#8a927b" d="M28 16H48V19H28ZM28 24H48V27H28ZM28 32H40V35H28Z" />
    <path fill="#725332" d="M46 37H63V41H67V54H63V58H46V54H42V41H46Z" />
    <path fill="#c49d50" d="M48 39H61V43H65V52H61V56H48V52H44V43H48Z" />
    <path fill="#f0d38b" d="M49 41H59V44H49ZM47 44H50V50H47Z" />
    <path fill="#725332" d="M54 45H58V49H54Z" />
  </svg>;
}

function BuildingChange({ change }: { change: NonNullable<RewardReceiptData['buildingChange']> }) {
  return <section className="dcl-receipt-building" aria-label="Confirmed building change" data-dc-building-change={change.key} data-from-level={change.fromLevel} data-to-level={change.toLevel}>
    <div className="dcl-receipt-building-track">
      <figure className="dcl-receipt-building-before"><DeepClaimBuildingPortrait buildingId={change.key} level={change.fromLevel} /><figcaption>Before <b>{change.fromLevel === 0 ? 'Unbuilt' : `Level ${change.fromLevel}`}</b></figcaption></figure>
      <span className="dcl-receipt-building-arrow" aria-hidden="true"><ArrowRight size={22} /></span>
      <figure className="dcl-receipt-building-after"><DeepClaimBuildingPortrait buildingId={change.key} level={change.toLevel} /><figcaption>Now <b>Level {change.toLevel}</b></figcaption><span className="dcl-receipt-building-seal" aria-hidden="true"><Check size={14} /></span></figure>
    </div>
    <p className="dcl-receipt-building-effect">{change.effect}</p>
  </section>;
}

/** A ceremony for returned facts. Rendering, closing and planning never award anything. */
export function DeepClaimRewardReceipt({ reward, onClose, onNextShift, nextShiftDisabled = false, reducedMotion = false }: {
  reward: RewardReceiptData; onClose: () => void; onNextShift?: () => void; nextShiftDisabled?: boolean; reducedMotion?: boolean;
}) {
  const stock = RESOURCE_CATALOG.filter(resource => resourceQuantity(reward.resources ?? {}, resource.id) > 0);
  const gear = reward.equipment ?? [];
  const building = reward.buildingChange && Number.isSafeInteger(reward.buildingChange.fromLevel) && Number.isSafeInteger(reward.buildingChange.toLevel)
    && reward.buildingChange.fromLevel >= 0 && reward.buildingChange.toLevel > reward.buildingChange.fromLevel ? reward.buildingChange : null;
  const kind = building ? 'building' : gear.length ? 'equipment' : stock.length ? 'cargo' : reward.cash != null ? 'credits' : 'confirmation';
  return <ClaimDialog open onClose={onClose} title={reward.title} description={reward.description}
    className={`dcl-reward-receipt${reducedMotion ? ' is-reduced' : ''}`} footer={<div className="dcl-dialog-actions">
      <ClaimButton primary onClick={onClose}>Back to the claim</ClaimButton>
      {onNextShift && <ClaimButton disabled={nextShiftDisabled} onClick={onNextShift}><Pickaxe size={15} aria-hidden="true" />Plan next shift</ClaimButton>}
    </div>}>
    <div className="dcl-receipt-body" data-dc-reward-receipt data-dc-reward-kind={kind}>
      {building ? <BuildingChange change={building} /> : !gear.length && <div className={`dcl-receipt-stage is-${kind}`} aria-hidden="true">
        <span className="dcl-receipt-stage-line" />
        {stock.length ? <><TransferCrate /><DeepClaimResourceIcon resourceId={stock[0].id} decorative className="dcl-receipt-featured-ore" /></>
          : reward.cash != null ? <LedgerSeal /> : <DeepClaimMark decorative className="dcl-receipt-confirmed-mark" />}
        <span className="dcl-receipt-stage-check"><Check size={15} /></span>
      </div>}
      {!!stock.length && <div className="dcl-resource-receipt dcl-receipt-materials" role="list" aria-label="Materials added to storage">
        {stock.map((resource, index) => <span role="listitem" key={resource.id} data-dc-receipt-resource={resource.id} data-dc-reward-resource={resource.id} style={{ '--dcl-receipt-order': Math.min(index, 6) } as CSSProperties}>
          <DeepClaimResourceIcon resourceId={resource.id} decorative /><strong>{resourceQuantity(reward.resources ?? {}, resource.id).toLocaleString()}</strong><small>{resource.name}</small>
        </span>)}
      </div>}
      {!!gear.length && <section className="dcl-receipt-equipment-section" aria-label="Equipment added to company">
        <ClaimBadge tone="green">Owned equipment</ClaimBadge>
        <div className="dcl-equipment-receipt dcl-receipt-equipment">{gear.map((item, index) => <span key={item.id} data-dc-receipt-equipment={item.id} style={{ '--dcl-receipt-order': Math.min(index, 6) } as CSSProperties}>
          <span className="dcl-receipt-equipment-art"><DeepClaimEquipmentIcon archetype={item.key} tier={item.tier} decorative /></span>
          <strong>{item.name}</strong><small>Tier {item.tier}</small>
        </span>)}</div>
      </section>}
      {reward.cash != null && <section className="dcl-receipt-balance" aria-label="Company balance"><span><Coins size={16} aria-hidden="true" />Company balance</span><strong className="dcl-reward-cash">{reward.cash.toLocaleString()} company credits</strong></section>}
      {!!reward.remaining && <div className="dcl-receipt-staged" role="status"><Package size={18} aria-hidden="true" /><p><strong>{reward.remaining.toLocaleString()} units remain staged.</strong><span>Sell stock or add storage space before collecting the rest.</span></p></div>}
    </div>
  </ClaimDialog>;
}
