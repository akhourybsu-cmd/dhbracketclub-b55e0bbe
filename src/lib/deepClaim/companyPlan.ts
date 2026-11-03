import type { DeepClaimSnapshot } from './types';
import { evaluateCompanyGoal, parseCompanyGoalRef, type CompanyGoalRef } from './companyGoals';

export interface CompanyPlanScope { userId: string; clubId: string; companyId: string }
type PlanStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function companyPlanKey(scope: CompanyPlanScope): string {
  return `dh:deep-claim:company-plan:v1:${[scope.userId, scope.clubId, scope.companyId].map(encodeURIComponent).join(':')}`;
}
function owns(snapshot: DeepClaimSnapshot, scope: CompanyPlanScope): boolean {
  return !!snapshot.company && snapshot.company.id === scope.companyId && snapshot.company.user_id === scope.userId && snapshot.company.club_id === scope.clubId;
}
/** Device planning preference only. Costs, progress and permission never come from storage. */
export function readCompanyPlan(scope: CompanyPlanScope, snapshot: DeepClaimSnapshot, storage?: PlanStorage): CompanyGoalRef | null {
  if (!owns(snapshot, scope)) return null;
  try {
    const raw = (storage ?? localStorage).getItem(companyPlanKey(scope));
    if (!raw || raw.length > 2048) return null;
    const entry = JSON.parse(raw);
    if (entry?.version !== 1 || entry.scope !== companyPlanKey(scope)) return null;
    const ref = parseCompanyGoalRef(entry.goal);
    return ref && evaluateCompanyGoal(snapshot, ref) ? ref : null;
  } catch { return null; }
}
export function saveCompanyPlan(scope: CompanyPlanScope, snapshot: DeepClaimSnapshot, ref: CompanyGoalRef, storage?: PlanStorage): boolean {
  const parsed = parseCompanyGoalRef(ref);
  if (!owns(snapshot, scope) || !parsed || !evaluateCompanyGoal(snapshot, parsed)) return false;
  try {
    (storage ?? localStorage).setItem(companyPlanKey(scope), JSON.stringify({ version: 1, scope: companyPlanKey(scope), goal: parsed }));
    return true;
  } catch { return false; }
}
