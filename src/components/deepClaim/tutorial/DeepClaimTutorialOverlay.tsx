import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, BookOpen, Crosshair, LocateFixed, Package, SkipForward, X } from 'lucide-react';
import { placeTutorialPanel, tutorialIntersection, type TutorialRect } from './spotlightLayout';
import './tutorial.css';

export interface DeepClaimTutorialOverlayProps {
  target: string | null; fallbackTargets?: readonly string[]; title: string; instruction: string; stepLabel: string; children?: ReactNode;
  onBack?: () => void; onNext?: () => void; onSkip: () => void; onExit: () => void; onMore?: () => void;
  onKeepMaterials?: () => void;
  concise?: boolean;
  lessonId?: string; stepId?: string; reducedMotion?: boolean;
  onTargetState?: (state: 'found' | 'missing' | 'offscreen' | 'no_room') => void;
}
interface Anchor { target: HTMLElement | null; targetId: string | null; host: HTMLElement; occluded: boolean; bounds: TutorialRect; rect: TutorialRect | null; origin: { left: number; top: number } }
const same = (a: Anchor | null, b: Anchor) => a?.target === b.target && a.targetId === b.targetId && a.host === b.host && a.occluded === b.occluded && JSON.stringify([a.bounds, a.rect, a.origin]) === JSON.stringify([b.bounds, b.rect, b.origin]);
/** A pointer-through guide. Dialog targets keep their guide within Radix's focus scope. */
export function DeepClaimTutorialOverlay(props: DeepClaimTutorialOverlayProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const stateCallback = useRef(props.onTargetState); stateCallback.current = props.onTargetState;
  const targetKeys = JSON.stringify([props.target, ...(props.fallbackTargets ?? [])]);
  const [measuring, setMeasuring] = useState(0);
  useLayoutEffect(() => { setMeasuring(value => value + 1); }, [anchor?.host]);
  useEffect(() => {
    let stopped = false; let frame = 0; let observed: HTMLElement | null = null; let observedHost: HTMLElement | null = null;
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule());
    function measure() {
      frame = 0; if (stopped) return;
      const vv = window.visualViewport;
      const screen = { left: vv?.offsetLeft ?? 0, top: vv?.offsetTop ?? 0, width: vv?.width ?? innerWidth, height: vv?.height ?? innerHeight };
      const activeDialog = [...document.querySelectorAll<HTMLElement>('[role=dialog][data-state=open]')].filter(node => !node.closest('[hidden],[aria-hidden=true],[inert]')).pop() ?? null;
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-dc-tutorial]')];
      let target: HTMLElement | null = null;
      // A future-only view (for example the quote) can explicitly protect the
      // real control which opens it. Never infer success from that fallback.
      for (const key of JSON.parse(targetKeys) as (string | null)[]) {
        if (!key) continue;
        const candidates = nodes.filter(node => { const box = node.getBoundingClientRect(); return node.getAttribute('data-dc-tutorial') === key && (!activeDialog || activeDialog.contains(node)) && !node.closest('[hidden],[aria-hidden=true],[inert],[role=dialog][data-state=closed]') && box.width > 0 && box.height > 0; });
        target = candidates.find(node => tutorialIntersection(node.getBoundingClientRect(), screen)) ?? candidates[0] ?? null;
        if (target) break;
      }
      const host = activeDialog ?? document.body;
      const box = activeDialog?.getBoundingClientRect();
      const visibleHost = box ? tutorialIntersection(box, screen) ?? screen : screen;
      const styles = root.current ? getComputedStyle(root.current) : null;
      const left = Math.max(8, Number.parseFloat(styles?.paddingLeft ?? '0') || 0), top = Math.max(8, Number.parseFloat(styles?.paddingTop ?? '0') || 0), right = Math.max(8, Number.parseFloat(styles?.paddingRight ?? '0') || 0), bottom = Math.max(8, Number.parseFloat(styles?.paddingBottom ?? '0') || 0);
      const bounds = { left: visibleHost.left + left, top: visibleHost.top + top, width: Math.max(0, visibleHost.width - left - right), height: Math.max(0, visibleHost.height - top - bottom) };
      const t = target?.getBoundingClientRect(); const rect = t && t.width > 0 && t.height > 0 ? { left: t.left - 5, top: t.top - 5, width: t.width + 10, height: t.height + 10 } : null;
      const originBox = root.current?.parentElement === host ? root.current.getBoundingClientRect() : box;
      const next = { target, targetId: target?.getAttribute('data-dc-tutorial') ?? null, host, occluded: !!activeDialog && !target, bounds, rect, origin: { left: originBox?.left ?? 0, top: originBox?.top ?? 0 } };
      setAnchor(current => same(current, next) ? current : next);
      if (host !== observedHost) { if (observedHost) resize?.unobserve(observedHost); resize?.observe(host); observedHost = host; }
      if (target !== observed) { if (observed) resize?.unobserve(observed); if (target) resize?.observe(target); observed = target; }
    }
    function schedule() { if (!stopped && !frame) frame = requestAnimationFrame(measure); }
    const mutations = new MutationObserver(schedule); mutations.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-dc-tutorial', 'hidden', 'aria-hidden', 'data-state'] });
    window.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, true); document.addEventListener('animationend', schedule, true); document.addEventListener('transitionend', schedule, true); window.visualViewport?.addEventListener('resize', schedule); window.visualViewport?.addEventListener('scroll', schedule);
    measure();
    return () => { stopped = true; if (frame) cancelAnimationFrame(frame); resize?.disconnect(); mutations.disconnect(); window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true); document.removeEventListener('animationend', schedule, true); document.removeEventListener('transitionend', schedule, true); window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule); };
  }, [targetKeys, measuring]);
  const inline = !!props.concise && !!anchor && anchor.host !== document.body;
  const placement = anchor ? placeTutorialPanel(anchor.bounds, anchor.rect, props.concise ? 86 : props.children ? 250 : 215) : null;
  const status = !anchor?.target || !anchor.rect ? 'missing' : !placement?.targetVisible ? 'offscreen' : !inline && placement.noRoom ? 'no_room' : 'found';
  useEffect(() => { stateCallback.current?.(status); }, [status]);
  // Receipts and unrelated confirmations own their own controls. Do not move a
  // missing-target guide into them; keep observing until the player closes them.
  if (!anchor || !placement || anchor.occluded) return null;
  const showingTarget = status === 'found';
  const compact = !!props.concise || placement.compact || (!!props.children && placement.height < 190 && !!props.onMore);
  const condensed = !compact && !!props.children && placement.height < 245;
  const showKeep = !!props.onKeepMaterials && !props.onNext;
  const showLocate = compact && status === 'offscreen' && !!anchor.target && !showKeep && !props.onNext;
  const showMore = !!props.onMore && !showLocate && (!compact || !showKeep && !props.onNext);
  const stepCount = props.stepLabel.match(/(\d+)\s*\/\s*(\d+)\s*$/);
  const currentStep = stepCount ? Number(stepCount[1]) : 0, totalSteps = stepCount ? Number(stepCount[2]) : 0;
  return createPortal(<div ref={root} className={`dct-overlay ${anchor.host !== document.body ? 'in-dialog' : ''} ${inline ? 'is-inline' : ''} ${props.concise ? 'is-concise' : ''}`} data-lesson-id={props.lessonId} data-step-id={props.stepId} data-target-state={status} data-target-id={anchor.targetId ?? undefined} data-reduced-motion={props.reducedMotion}>
    {showingTarget && anchor.rect && <div className="dct-spotlight" aria-hidden="true" style={{ left: anchor.rect.left - anchor.origin.left, top: anchor.rect.top - anchor.origin.top, width: anchor.rect.width, height: anchor.rect.height }} />}
    <section className={`dct-guidance ${compact ? 'is-compact' : ''} ${condensed ? 'is-condensed' : ''}`} role="region" aria-label="Tutorial guidance" style={inline ? undefined : { left: placement.left - anchor.origin.left, top: placement.top - anchor.origin.top, width: placement.width, maxHeight: placement.height }}>
      <div className="dct-guidance-heading"><span className="dct-task-mark" aria-hidden="true"><Crosshair size={19} /></span><div><small>{props.stepLabel}</small><h2 tabIndex={compact ? 0 : undefined}>{compact ? props.instruction : props.title}</h2></div>{showMore && <button type="button" className="dct-icon-button" aria-label="More lesson information" onClick={props.onMore}><BookOpen size={17} aria-hidden="true" /></button>}{showLocate && <button type="button" className="dct-icon-button" aria-label="Locate tutorial control" onClick={() => anchor.target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })}><LocateFixed size={17} aria-hidden="true" /></button>}</div>
      {!compact && totalSteps > 0 && <div className="dct-task-progress" role="progressbar" aria-label="Lesson step" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={Math.min(currentStep, totalSteps)}><span style={{ width: `${Math.min(100, currentStep / totalSteps * 100)}%` }} /></div>}
      {!compact && <div className="dct-guidance-copy"><p>{props.instruction}</p>{status !== 'found' && props.target && <p role="status">{status === 'offscreen' ? 'Scroll to the highlighted control, or use Locate.' : status === 'no_room' ? 'Keep using the controls. You can pause the guide if you need more room.' : 'This control isn’t open yet. Use Show me, or open the notes for help.'}</p>}</div>}{!compact && props.children && <div className="dct-guidance-context">{props.children}</div>}
      <div className="dct-guidance-controls">{!compact && props.onBack && <button type="button" className="dct-icon-button" aria-label="Previous tutorial step" onClick={props.onBack}><ArrowLeft size={17} aria-hidden="true" /></button>}{!compact && status === 'offscreen' && anchor.target && <button type="button" className="dct-icon-button" aria-label="Locate tutorial control" onClick={() => anchor.target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })}><LocateFixed size={17} aria-hidden="true" /></button>}{!compact && <button type="button" className="dct-button is-subtle" aria-label="Skip lesson" onClick={props.onSkip}><SkipForward size={15} aria-hidden="true" /><span>Skip lesson</span></button>}{showKeep && <button type="button" className="dct-button dct-keep-materials" aria-label="Keep materials" onClick={props.onKeepMaterials}><Package size={17} aria-hidden="true" /><span className="dct-keep-label-full">Keep materials</span><span className="dct-keep-label-short" aria-hidden="true">Keep</span></button>}<button type="button" className="dct-icon-button" aria-label="Exit tutorial" title="Pause the guide" onClick={props.onExit}><X size={17} aria-hidden="true" /></button>{props.onNext && <button type="button" className="dct-button is-primary" aria-label="Next tutorial step" onClick={props.onNext}>Next<ArrowRight size={16} aria-hidden="true" /></button>}</div>
    </section>
  </div>, anchor.host);
}
