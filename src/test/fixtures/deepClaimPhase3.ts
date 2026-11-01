import { FIELD_CATALOG } from '@/lib/deepClaim/catalog';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseTwoSnapshot } from './deepClaimPhase2';

/** Current public schema with the same company/workers/terrain as previous versions. */
export function phaseThreeSnapshot(revision=3):DeepClaimSnapshot {
  const snapshot=phaseTwoSnapshot(revision);
  snapshot.schema_version=3;
  snapshot.buildings=snapshot.buildings.map(building=>({...building,max_level:building.key==='mine_shaft'?5:3}));
  snapshot.infrastructure=[];snapshot.discoveries=[];
  snapshot.discovery_summary={pending:0,kept:0,sold:0,salvaged:0};snapshot.field_reports=[];
  snapshot.field_catalog=structuredClone(FIELD_CATALOG);
  snapshot.world!.tiles=snapshot.world!.tiles.map(tile=>({...tile,formation:null}));
  return snapshot;
}
