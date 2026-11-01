import { DEEP_CLAIM_CLUB_PROJECT_KEYS } from '@/lib/deepClaim/types';

export type ClaimClubView = 'projects' | 'standings' | 'showcase';
const OFFICE_VIEWS = ['company', 'research', 'contracts', 'records', 'club'] as const;
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
/** Notification targets never switch the active club or select an unrecognized private entity. */
export function deepClaimLink(params: URLSearchParams, currentClubId: string) {
  const club = params.get('club');
  const mismatch = !!club && (!UUID.test(club) || club !== currentClubId);
  const office = OFFICE_VIEWS.find(value => value === params.get('office'));
  const view: ClaimClubView = params.get('view') === 'standings' ? 'standings' : params.get('view') === 'showcase' ? 'showcase' : 'projects';
  const project = DEEP_CLAIM_CLUB_PROJECT_KEYS.find(key => key === params.get('project')) ?? null;
  return { mismatch, office: mismatch ? undefined : office, view, project: mismatch ? null : project };
}
