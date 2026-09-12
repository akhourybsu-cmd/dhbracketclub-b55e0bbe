import { useEffect, useRef, useState } from 'react';

interface VisitRecord {
  /** pick count at last visit */
  c: number;
  /** ISO timestamp of last visit */
  t: string;
}

/**
 * Tracks "since your last visit" for a draft room.
 * On first ready load, diffs the current picks against the stored snapshot
 * (per user+draft in localStorage) and returns the IDs of picks made since.
 * The snapshot is then updated so the next visit measures from here.
 */
export function useDraftLastVisit(
  draftId: string | undefined,
  userId: string | undefined,
  picks: { id: string; pick_number: number; picked_at?: string }[],
  ready: boolean,
): Set<string> {
  const [newPickIds, setNewPickIds] = useState<Set<string>>(new Set());
  const recorded = useRef(false);

  useEffect(() => {
    if (!ready || !draftId || !userId || recorded.current) return;
    recorded.current = true;
    const key = `da_last_visit_v1:${userId}:${draftId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const prev = JSON.parse(raw) as VisitRecord;
        const prevTime = new Date(prev.t).getTime();
        const fresh = picks.filter((p) => {
          if (p.picked_at) return new Date(p.picked_at).getTime() > prevTime;
          return p.pick_number > prev.c;
        });
        if (fresh.length > 0) setNewPickIds(new Set(fresh.map((p) => p.id)));
      }
      localStorage.setItem(
        key,
        JSON.stringify({ c: picks.length, t: new Date().toISOString() } satisfies VisitRecord),
      );
    } catch {
      // localStorage unavailable — skip silently
    }
  }, [ready, draftId, userId, picks]);

  return newPickIds;
}
