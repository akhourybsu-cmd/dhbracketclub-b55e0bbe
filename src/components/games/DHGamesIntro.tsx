import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { DHGamesLogo } from './DHGamesLogo';
import { DH_GAMES_INTRO_TIMING } from './publisherIntroTiming';
import './dhGamesIntro.css';

export interface DHGamesIntroProps { onComplete: () => void; onReveal?: () => void; reducedMotion?: boolean }
type IntroPhase = 'reveal' | 'hold' | 'fade';

/** Presentation only. No loading, audio, account storage or gameplay authority. */
export function DHGamesIntro({ onComplete, onReveal, reducedMotion = false }: DHGamesIntroProps) {
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reduce = reducedMotion || systemReduced;
  const [phase, setPhase] = useState<IntroPhase>(reduce ? 'hold' : 'reveal');
  const start = useRef<number | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = useRef(false), revealed = useRef(false);
  const callbacks = useRef({ onComplete, onReveal }); callbacks.current = { onComplete, onReveal };
  const surface = useRef<HTMLElement>(null), skip = useRef<HTMLButtonElement>(null);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    callbacks.current.onComplete();
  }, []);

  useLayoutEffect(() => { surface.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemReduced(query.matches);
    query.addEventListener?.('change', changed);
    return () => query.removeEventListener?.('change', changed);
  }, []);
  useEffect(() => {
    // Keep the original deadline through StrictMode and ordinary re-renders.
    if (start.current === null) start.current = performance.now();
    let disposed = false;
    function reconcile() {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      if (disposed || completed.current) return;
      const elapsed = Math.max(0, performance.now() - start.current!);
      const end = reduce ? DH_GAMES_INTRO_TIMING.reducedHold : DH_GAMES_INTRO_TIMING.total;
      if (elapsed >= end) { finish(); return; }
      const nextPhase: IntroPhase = reduce ? 'hold' : elapsed >= DH_GAMES_INTRO_TIMING.reveal + DH_GAMES_INTRO_TIMING.hold ? 'fade' : elapsed >= DH_GAMES_INTRO_TIMING.reveal ? 'hold' : 'reveal';
      setPhase(nextPhase);
      if (nextPhase === 'fade' && !revealed.current) { revealed.current = true; callbacks.current.onReveal?.(); }
      const next = reduce || nextPhase === 'fade' ? end : nextPhase === 'hold' ? DH_GAMES_INTRO_TIMING.reveal + DH_GAMES_INTRO_TIMING.hold : DH_GAMES_INTRO_TIMING.reveal;
      timer.current = setTimeout(reconcile, Math.max(1, next - elapsed));
    }
    function keyboard(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (event.key === 'Tab') { event.preventDefault(); skip.current?.focus({ preventScroll: true }); }
      else if (['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); finish(); }
    }
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('pageshow', reconcile);
    document.addEventListener('keydown', keyboard, true);
    reconcile();
    return () => {
      disposed = true;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      document.removeEventListener('visibilitychange', reconcile);
      window.removeEventListener('pageshow', reconcile);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, [reduce, finish]);

  return <section ref={surface} tabIndex={-1} role="region" aria-label="DH Games" className="dh-games-intro" data-testid="dh-games-intro" data-phase={phase} data-reduced-motion={reduce} style={{ '--dh-games-reveal': `${DH_GAMES_INTRO_TIMING.reveal}ms`, '--dh-games-fade': `${DH_GAMES_INTRO_TIMING.fade}ms` } as CSSProperties}>
    <div className="dh-games-intro-light" aria-hidden="true" />
    <div className="dh-games-intro-art"><DHGamesLogo decorative /><span className="dh-games-intro-rule" aria-hidden="true" /></div>
    <button ref={skip} type="button" className="dh-games-intro-skip" onClick={finish}>Skip intro<ArrowRight size={15} aria-hidden="true" /></button>
  </section>;
}
