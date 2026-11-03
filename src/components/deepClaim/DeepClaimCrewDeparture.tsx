import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import type { DeepClaimExpedition, DeepClaimWorker } from '@/lib/deepClaim/types';
import { CLAIM_OPERATION_NAMES } from './fieldLabels';
import { DeepClaimPortrait } from './renderer/DeepClaimIcons';
import { FRONTIER_PALETTE } from './renderer/artManifest';
import './deepClaimDeparture.css';

function systemReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Original decorative lift. It depicts departure, never a private mine location. */
function DepartureLift() {
  const id = `dc-departure-${useId().replace(/:/g, '')}`;
  const p = FRONTIER_PALETTE;
  return <svg viewBox="0 0 96 96" shapeRendering="crispEdges" aria-hidden="true" focusable="false" className="dcl-departure-lift">
    <defs><clipPath id={id}><path d="M20 25H76V80H20Z" /></clipPath></defs>
    <path d="M2 2H94V94H2Z" fill={p.coal} /><path d="M7 7H89V89H7Z" fill={p.soot} />
    <path d="M14 14H82V20H14ZM14 80H82V86H14Z" fill={p.woodDark} />
    <path d="M15 19H23V80H15ZM73 19H81V80H73Z" fill={p.wood} />
    <path d="M18 20H21V79H18ZM75 20H78V79H75Z" fill={p.brass} />
    <path d="M23 20H73V26H23ZM23 74H73V80H23Z" fill={p.slate} />
    <path d="M33 5H63V10H33ZM43 10H53V17H43Z" fill={p.brass} />
    <path d="M43 9H53V13H43Z" fill={p.brassLight} />
    <path d="M30 27H34V77H30ZM62 27H66V77H62Z" fill={p.woodDark} />
    <g clipPath={`url(#${id})`}>
      <g className="dcl-departure-cage">
        <path d="M46 17H50V35H46Z" fill={p.slate} />
        <path d="M27 35H69V40H27ZM27 68H69V73H27Z" fill={p.brass} />
        <path d="M28 40H68V68H28Z" fill={p.woodDark} />
        <path d="M31 43H65V65H31Z" fill={p.moss} />
        <path d="M43 45H53V62H43Z" fill={p.brass} /><path d="M45 49H51V59H45Z" fill={p.lamp} />
        <path d="M45 42H51V45H45ZM42 60H54V63H42Z" fill={p.cream} />
        <path d="M27 40H31V68H27ZM65 40H69V68H65Z" fill={p.brassLight} />
        <g className="dcl-departure-gate-left"><path d="M30 40H47V68H30Z" fill={p.slate} /><path d="M33 42H36V66H33ZM41 42H44V66H41Z" fill={p.coal} /></g>
        <g className="dcl-departure-gate-right"><path d="M49 40H66V68H49Z" fill={p.slate} /><path d="M52 42H55V66H52ZM60 42H63V66H60Z" fill={p.coal} /></g>
      </g>
    </g>
    <path d="M10 33H14V43H10ZM82 33H86V43H82Z" fill={p.brass} />
    <path className="dcl-departure-lamp" d="M10 35H14V39H10ZM82 35H86V39H82Z" fill={p.lamp} />
    <path d="M8 87H88V90H8Z" fill={p.earth} /><path d="M13 88H20V90H13ZM28 88H35V90H28ZM43 88H50V90H43ZM58 88H65V90H58ZM73 88H80V90H73Z" fill={p.brass} />
  </svg>;
}

export function DeepClaimCrewDeparture({ job, workers, onDone, onFollow, reducedMotion }: {
  job: DeepClaimExpedition; workers: DeepClaimWorker[]; onDone: () => void; onFollow: () => void; reducedMotion: boolean;
}) {
  const [systemReduced, setSystemReduced] = useState(systemReducedMotion);
  const reduce = reducedMotion || systemReduced;
  const callbacks = useRef({ onDone, onFollow });
  const settled = useRef({ id: job.id, finished: false });
  const timer = useRef<number | undefined>();
  const crew = useMemo(() => {
    const assigned = new Set(job.worker_ids);
    const seen = new Set<string>();
    return workers.filter(worker => {
      if (!assigned.has(worker.id) || seen.has(worker.id)) return false;
      seen.add(worker.id); return true;
    }).slice(0, 3);
  }, [workers, job.worker_ids]);
  useLayoutEffect(() => { callbacks.current = { onDone, onFollow }; }, [onDone, onFollow]);
  const clearTimer = useCallback(() => { if (timer.current !== undefined) window.clearTimeout(timer.current); timer.current = undefined; }, []);
  const finish = useCallback(() => {
    if (settled.current.finished) return;
    settled.current.finished = true; clearTimer(); callbacks.current.onDone();
  }, [clearTimer]);
  const follow = useCallback(() => {
    if (settled.current.finished) return;
    settled.current.finished = true; clearTimer(); callbacks.current.onFollow();
  }, [clearTimer]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    update();
    if (typeof query.addEventListener === 'function') { query.addEventListener('change', update); return () => query.removeEventListener('change', update); }
    query.addListener?.(update); return () => query.removeListener?.(update);
  }, []);
  useLayoutEffect(() => {
    if (settled.current.id !== job.id) settled.current = { id: job.id, finished: false };
    if (settled.current.finished) return;
    if (job.status !== 'active') { finish(); return; }
    timer.current = window.setTimeout(finish, reduce ? 900 : 1800);
    return clearTimer;
  }, [job.id, job.status, reduce, finish, clearTimer]);

  if (job.status !== 'active') return null;
  const seconds = Number.isSafeInteger(job.duration_seconds) && job.duration_seconds > 0 ? job.duration_seconds : 0;
  const duration = seconds ? seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)} min` : null;
  return <div className={`dcl-departure${reduce ? ' is-reduced' : ''}`} data-dc-departure={job.id} data-dc-departure-stage={job.stage}>
    <section className="dcl-departure-panel" role="status" aria-live="polite" aria-atomic="true" aria-label="Crew departure">
      <div className="dcl-departure-art"><DepartureLift /></div>
      <div className="dcl-departure-content"><small>Deep Claim</small><h2>Shift underway</h2><p>{CLAIM_OPERATION_NAMES[job.mode]} · {job.target.y}m{duration ? ` · ${duration}` : ''}</p>
        <div className="dcl-departure-crew" aria-label="Departing crew">{crew.map(worker => <DeepClaimPortrait key={worker.id} worker={worker} />)}<span>{crew.length ? crew.map(worker => worker.name).join(' · ') : 'Assigned crew'}</span></div>
      </div>
      <div className="dcl-departure-actions"><button type="button" className="dcl-button" aria-label="Dismiss departure" onClick={finish}><X size={15} aria-hidden="true" />Skip</button><button type="button" className="dcl-button is-primary" onClick={follow}><MapPin size={15} aria-hidden="true" />Follow crew</button></div>
    </section>
  </div>;
}
