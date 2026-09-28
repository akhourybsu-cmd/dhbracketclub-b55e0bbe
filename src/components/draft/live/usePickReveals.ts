import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { kioskSound } from '@/lib/draft/kioskSound';

export type RevealPhase = 'locked' | 'confirmed' | 'reveal' | 'landing';

export interface RevealablePick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round?: number | null;
}

export interface PickReveal {
  pick: RevealablePick;
  name: string;
  phase: RevealPhase;
}

interface UsePickRevealsOptions {
  picks: RevealablePick[];
  loading: boolean;
  /** Master switch from live settings — when off, only a soft blip plays. */
  announce: boolean;
  /** Sound switch from live settings. */
  sound: boolean;
  /** Whether this device is muted (projector defaults to muted). */
  muted: boolean;
  nameFor: (userId?: string | null) => string;
}

/**
 * Shared cinematic pick-reveal sequencer used by the projector kiosk and each
 * player's personal kiosk. Watches the pick list, queues fresh picks, and
 * walks each through locked → confirmed → reveal → landing with sound.
 */
export function usePickReveals({ picks, loading, announce, sound, muted, nameFor }: UsePickRevealsOptions) {
  const [reveal, setReveal] = useState<PickReveal | null>(null);
  const [revealQueue, setRevealQueue] = useState<Array<{ pick: RevealablePick; name: string }>>([]);
  const reduceMotion = useReducedMotion();
  const seenPickIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);

  useEffect(() => {
    // Seed on first load so a refresh doesn't replay the whole board.
    if (loading) return;
    const fresh = picks.filter(p => !seenPickIds.current.has(p.id));
    picks.forEach(p => seenPickIds.current.add(p.id));
    if (!hydrated.current) {
      hydrated.current = true; // first paint: don't replay the whole board
      return;
    }
    const latest = fresh[fresh.length - 1];
    if (!latest) return;
    if (!announce) {
      if (!muted && sound) kioskSound.pick();
      return;
    }
    setRevealQueue(queue => [
      ...queue,
      ...fresh.map(pick => ({ pick, name: nameFor(pick.user_id) })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, loading]);

  useEffect(() => {
    if (reveal || revealQueue.length === 0) return;
    const [next, ...rest] = revealQueue;
    setRevealQueue(rest);
    setReveal({ ...next, phase: reduceMotion ? 'reveal' : 'locked' });
  }, [reduceMotion, reveal, revealQueue]);

  useEffect(() => {
    if (!reveal) return;
    const soundOn = !muted && sound;
    const durations: Record<RevealPhase, number> = reduceMotion
      ? { locked: 0, confirmed: 0, reveal: 900, landing: 450 }
      : { locked: 2200, confirmed: 2400, reveal: 2500, landing: 2000 };

    if (soundOn) {
      if (reveal.phase === 'locked') kioskSound.locked();
      if (reveal.phase === 'confirmed') kioskSound.reveal();
      if (reveal.phase === 'landing') kioskSound.land();
    }

    const nextPhase: Record<RevealPhase, RevealPhase | null> = {
      locked: 'confirmed',
      confirmed: 'reveal',
      reveal: 'landing',
      landing: null,
    };
    const timer = window.setTimeout(() => {
      const next = nextPhase[reveal.phase];
      setReveal(next ? { ...reveal, phase: next } : null);
    }, durations[reveal.phase]);
    return () => window.clearTimeout(timer);
  }, [muted, reduceMotion, reveal, sound]);

  const concealedPickId = reveal && reveal.phase !== 'landing' ? reveal.pick.id : null;

  return { reveal, concealedPickId, reduceMotion };
}
