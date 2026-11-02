import { useMemo } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { createTutorialProgress } from '@/lib/deepClaim/tutorial/progress';
import type { TutorialScope } from '@/lib/deepClaim/tutorial/types';

/**
 * Legacy company-component suites already isolate the economic transport.
 * Keep education equally isolated, with a real empty journal for this exact
 * account/club/company. Hook persistence and campaign integration have their
 * own QueryClient-backed suites; this fixture never completes a lesson.
 */
export function useDeepClaimTutorialMock({ scope }: { scope: TutorialScope; enabled: boolean }) {
  const { user_id, club_id, company_id } = scope;
  return useMemo(() => ({
    progress: createTutorialProgress({ user_id, club_id, company_id }, '2026-11-02T12:00:00Z'),
    update: () => {},
    loading: false,
    saving: false,
    pending: 0,
    synced: true,
    error: null,
    refresh: async () => {},
  }), [user_id, club_id, company_id]);
}

/** Enter through the same title control as a returning player. */
export function continueDeepClaimCompany() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}
