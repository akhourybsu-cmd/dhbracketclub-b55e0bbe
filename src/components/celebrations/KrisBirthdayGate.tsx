import { lazy, Suspense, useEffect, useState } from 'react';

const DH_CLUB_ID = '11111111-1111-1111-1111-111111111111';
// Midnight to midnight in America/New_York. Both boundaries fall in EST.
const OPENS = Date.parse('2026-11-26T00:00:00-05:00');
const CLOSES = Date.parse('2026-11-27T00:00:00-05:00');
const MAX_TIMER_DELAY = 2_147_483_647;
const dismissedThisTab = new Set<string>();

const Opening = lazy(() => import('./KrisBirthdayOpening').catch(error => {
  console.warn('Could not load the birthday opening.', error);
  return { default: () => null };
}));

function wasDismissed(key: string) {
  if (dismissedThisTab.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function BirthdaySession({ userId }: { userId: string }) {
  const key = `dh:celebrations:kris-birthday-2026:${userId}`;
  const [dismissed, setDismissed] = useState(() => wasDismissed(key));
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (dismissed || now >= CLOSES) return;
    const refresh = () => setNow(Date.now());
    const boundary = now < OPENS ? OPENS : CLOSES;
    const delay = Math.max(0, Math.min(boundary - Date.now(), MAX_TIMER_DELAY));
    const timer = window.setTimeout(refresh, delay);
    // Background tabs can suspend timers; re-check the actual date on return.
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [dismissed, now]);

  if (dismissed || now < OPENS || now >= CLOSES || Date.now() >= CLOSES) return null;
  function dismiss() {
    dismissedThisTab.add(key);
    try {
      window.sessionStorage.setItem(key, '1');
    } catch {
      // The memory receipt still covers route changes when storage is blocked.
    }
    setDismissed(true);
  }
  return <Suspense fallback={null}><Opening onDismiss={dismiss} /></Suspense>;
}

export function KrisBirthdayGate({ clubId, userId }: { clubId: string; userId: string }) {
  if (clubId !== DH_CLUB_ID || !userId || Date.now() >= CLOSES) return null;
  return <BirthdaySession key={userId} userId={userId} />;
}
