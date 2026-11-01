import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronLeft, Eye, EyeOff, LoaderCircle, RotateCcw, Send, Sparkles, Trash2, WifiOff } from 'lucide-react';
import { normalizePlacements, updatePlacement, validatePlacements } from '@/lib/showdown/afterimage/engine';
import { AFTERIMAGE_DIFFICULTY_COUNTS, AFTERIMAGE_STUDY_MS, type AfterimagePiece, type AfterimagePlacement, type AfterimageSceneView } from '@/lib/showdown/afterimage/types';
import { AfterimageArt } from './AfterimageArt';
import { AfterimageScene } from './AfterimageScene';
import './afterimageGame.css';

export interface AfterimageGameProps {
  attemptKey: string;
  scene: AfterimageSceneView;
  roundNumber: 1 | 2 | 3;
  opponent: { displayName: string; avatarUrl?: string | null };
  placements: AfterimagePlacement[];
  onPlacementsChange: (placements: AfterimagePlacement[]) => void;
  onStartStudy: () => Promise<void>;
  onStudyExpired: () => Promise<void>;
  onSubmit: () => Promise<void>;
  saveState?: 'saved' | 'saving' | 'offline';
  error?: string | null;
  onRetrySave?: () => void;
  disabled?: boolean;
  onLeave?: () => void;
  bankedScore?: number;
}
interface TouchDrag { id: string; pointerId: number; x: number; y: number; moved: boolean }
interface Ghost { id: string; x: number; y: number }
const DRAG_TYPE = 'application/x-dh-afterimage-piece';
const now = () => performance.now();
const placementKey = (placements: AfterimagePlacement[]) => JSON.stringify(normalizePlacements(placements));

/** One frozen round. Timing observations are received from the server transport. */
export function AfterimageGame(props: AfterimageGameProps) {
  return <AfterimageRound key={`${props.attemptKey}:${props.roundNumber}:${props.scene.id}:${props.scene.version}`} {...props} />;
}

function AfterimageRound({ scene, roundNumber, opponent, placements, onPlacementsChange, onStartStudy, onStudyExpired, onSubmit, saveState = 'saved', error, onRetrySave, disabled = false, onLeave, bankedScore }: AfterimageGameProps) {
  const [prepared, setPrepared] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startAttempted, setStartAttempted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [operationError, setOperationError] = useState('');
  const [concealed, setConcealed] = useState(scene.phase === 'study');
  const [remaining, setRemaining] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [awaitingPiece, setAwaitingPiece] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submission, setSubmission] = useState<'idle' | 'sending' | 'error' | 'sent'>('idle');
  const [announcement, setAnnouncement] = useState('');
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [sceneWidth, setSceneWidth] = useState<number | null>(null);
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden');
  const sceneHost = useRef<HTMLDivElement>(null);
  const boardSpace = useRef<HTMLDivElement>(null);
  const trayHost = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const deadline = useRef<number | null>(null);
  const expiryRequested = useRef(false);
  const refreshInFlight = useRef(false);
  const startInFlight = useRef(false);
  const submitInFlight = useRef(false);
  const hiddenObservation = useRef<number | null>(null);
  const draggedPiece = useRef<string | null>(null);
  const touchDrag = useRef<TouchDrag | null>(null);
  const suppressClickUntil = useRef(0);
  const submittedLayout = useRef<string | null>(null);
  const latest = useRef({ scene, placements, onStudyExpired, onStartStudy, onSubmit });
  latest.current = { scene, placements, onStudyExpired, onStartStudy, onSubmit };
  const isStudy = scene.phase === 'study';
  const isRecall = scene.phase === 'reconstruct';
  const isSealed = scene.phase === 'submitted' || scene.phase === 'review';
  const layoutKey = placementKey(placements);
  const counts = AFTERIMAGE_DIFFICULTY_COUNTS[scene.difficulty];
  const pieces = useMemo(() => new Map(scene.tray.map(piece => [piece.id, piece])), [scene.tray]);
  const placed = useMemo(() => Object.fromEntries(placements.map(item => [item.slot_id, item.object_id])), [placements]);
  let layoutError = '';
  if (isRecall) { try { validatePlacements(placements, scene); } catch { layoutError = 'Your saved layout could not be verified. Refresh it before arranging objects.'; } }
  const locked = disabled || !isRecall || submission !== 'idle' || confirming || !!layoutError;
  const selected = selectedPiece ? pieces.get(selectedPiece) : null;
  const selectedIsPlaced = selectedPiece != null && placements.some(item => item.object_id === selectedPiece);
  const blankScene = useMemo<AfterimageSceneView>(() => ({ ...scene, phase: 'ready', objects: [], slots: [], tray: [], answers: undefined }), [scene]);
  const studyArt = useMemo(() => <AfterimageScene scene={scene} mode="study" readOnly label={`${scene.title}. Memorize the objects and their positions.`} />, [scene]);

  useLayoutEffect(() => {
    active.current = true;
    setPrepared(true); // Art is an already imported inline-SVG module, with no image requests.
    return () => { active.current = false; };
  }, []);
  useLayoutEffect(() => {
    const host = boardSpace.current;
    if (!host) return;
    const measure = () => {
      const box = host.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) {
        const width = Math.floor(Math.min(box.width, box.height * scene.width / scene.height, 1000));
        setSceneWidth(previous => previous === width ? previous : width);
      }
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(host); window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [scene.width, scene.height]);

  const conceal = useCallback(() => {
    // Synchronous concealment runs before a backgrounded page can freeze its
    // React render. The original study art is also removed on the next render.
    sceneHost.current?.setAttribute('data-afterimage-concealed', 'true');
    setConcealed(true);
  }, []);
  const refreshPhase = useCallback(async (_reason: 'expiry' | 'visible' | 'manual' = 'manual') => {
    if (refreshInFlight.current || !active.current) return;
    refreshInFlight.current = true;
    setRefreshing(true); setOperationError('');
    try {
      await latest.current.onStudyExpired();
      if (active.current && latest.current.scene.phase === 'ready') setStartAttempted(false);
    } catch (failure) {
      if (active.current) setOperationError(failure instanceof Error ? failure.message : 'The scene could not be refreshed. Reconnect and try again.');
    } finally {
      refreshInFlight.current = false;
      if (active.current) { setRefreshing(false); setRefreshGeneration(value => value + 1); }
    }
  }, []);

  useLayoutEffect(() => {
    if (!isStudy) return;
    const observed = scene.observation_received_at, duration = scene.observation_remaining_ms;
    const clock = now();
    const trusted = typeof observed === 'number' && Number.isFinite(observed) && observed >= 0 && observed <= clock + 2
      && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0;
    const candidate = trusted ? observed + Math.min(AFTERIMAGE_STUDY_MS, duration) : clock;
    deadline.current = Math.min(deadline.current ?? candidate, candidate);
    const left = Math.max(0, deadline.current - clock);
    setRemaining(left);
    const verifiedAfterHidden = hiddenObservation.current === null || trusted && observed > hiddenObservation.current;
    if (left > 0 && !hidden && document.visibilityState !== 'hidden' && verifiedAfterHidden) {
      setConcealed(false); sceneHost.current?.removeAttribute('data-afterimage-concealed');
    } else conceal();
  }, [isStudy, scene.observation_received_at, scene.observation_remaining_ms, hidden, conceal]);

  useEffect(() => {
    if (!isStudy) return;
    const tick = () => {
      const left = Math.max(0, (deadline.current ?? now()) - now());
      setRemaining(left);
      if (left <= 0) {
        conceal();
        if (!expiryRequested.current && document.visibilityState !== 'hidden') {
          expiryRequested.current = true;
          void refreshPhase('expiry');
        }
      }
    };
    tick(); const timer = window.setInterval(tick, 50);
    return () => window.clearInterval(timer);
  }, [isStudy, conceal, refreshPhase]);

  useEffect(() => {
    // A deliberately early conservative cutoff may precede the server by a
    // fraction of a round trip. Check again without ever revealing the art.
    if (!isStudy || !concealed || !expiryRequested.current || refreshing || operationError || hidden) return;
    const timer = window.setTimeout(() => void refreshPhase('expiry'), 250);
    return () => window.clearTimeout(timer);
  }, [isStudy, concealed, refreshing, refreshGeneration, operationError, hidden, scene.observation_received_at, scene.observation_remaining_ms, refreshPhase]);

  useEffect(() => {
    const visibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      if (isHidden) {
        if (latest.current.scene.phase === 'study' || startInFlight.current) {
          hiddenObservation.current = latest.current.scene.observation_received_at ?? -1;
          conceal();
        }
        touchDrag.current = null; draggedPiece.current = null; setGhost(null);
      }
      setHidden(isHidden);
      if (!isHidden && (latest.current.scene.phase === 'study' || startInFlight.current)) {
        // An observation received while backgrounded is not confirmation that
        // the original window remains open now. Wait for the return-time GET.
        hiddenObservation.current = now();
        void refreshPhase('visible');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [conceal, refreshPhase]);

  useEffect(() => {
    if (submission === 'error' && isRecall && submittedLayout.current !== null && submittedLayout.current !== layoutKey) {
      submittedLayout.current = null; setSubmission('idle'); setOperationError('');
      setAnnouncement('Another saved layout was restored. Review it before submitting.');
    }
  }, [submission, isRecall, layoutKey]);

  async function startStudy() {
    if (startInFlight.current || startAttempted || !prepared || disabled || scene.phase !== 'ready') return;
    startInFlight.current = true; setStarting(true); setStartAttempted(true); setOperationError('');
    try { await latest.current.onStartStudy(); }
    catch (failure) { if (active.current) setOperationError(failure instanceof Error ? failure.message : 'The study request could not be confirmed. Check its saved status before continuing.'); }
    finally { startInFlight.current = false; if (active.current) setStarting(false); }
  }
  async function submitMemory() {
    if (submitInFlight.current || disabled || !isRecall || layoutError) return;
    submitInFlight.current = true; submittedLayout.current = layoutKey;
    setSubmission('sending'); setConfirming(false); setOperationError('');
    try { await latest.current.onSubmit(); if (active.current) setSubmission('sent'); }
    catch (failure) { if (active.current) { setSubmission('error'); setOperationError(failure instanceof Error ? failure.message : 'The memory could not be sealed. Your layout is kept for retry.'); } }
    finally { submitInFlight.current = false; }
  }

  function focusTray() { trayHost.current?.querySelector<HTMLButtonElement>('[data-afterimage-piece]:not([disabled])')?.focus({ preventScroll: true }); }
  function place(pieceId: string, slotId: string) {
    if (locked || !pieces.has(pieceId) || !scene.slots.some(slot => slot.id === slotId)) return;
    const next = updatePlacement(placements, pieceId, slotId);
    try { validatePlacements(next, scene); } catch { return; }
    onPlacementsChange(next); setSelectedSlot(slotId); setSelectedPiece(null); setAwaitingPiece(false);
    setAnnouncement(`${pieces.get(pieceId)!.label} set in position ${scene.slots.findIndex(slot => slot.id === slotId) + 1}. Your layout is checked only after submission.`);
  }
  function selectSlot(slotId: string) {
    if (locked) return;
    if (selectedPiece) { place(selectedPiece, slotId); return; }
    const current = placements.find(item => item.slot_id === slotId);
    setSelectedSlot(slotId); setSelectedPiece(current?.object_id ?? null); setAwaitingPiece(!current);
    setAnnouncement(current ? `${pieces.get(current.object_id)?.label ?? 'Object'} selected. Choose another position or return it to the tray.` : 'Position selected. Choose an object from the tray.');
    if (!current) focusTray();
  }
  function selectPiece(piece: AfterimagePiece, keyboard = false) {
    if (locked) return;
    if (!keyboard && now() < suppressClickUntil.current) { suppressClickUntil.current = 0; return; }
    if (awaitingPiece && selectedSlot) { place(piece.id, selectedSlot); return; }
    setSelectedPiece(piece.id); setSelectedSlot(null); setAwaitingPiece(false);
    setAnnouncement(`${piece.label} selected. Choose a position.`);
    if (keyboard) sceneHost.current?.querySelector<HTMLButtonElement>('[data-ai-slot]')?.focus({ preventScroll: true });
  }
  function removeSelected() {
    if (locked || !selectedPiece || !selectedIsPlaced) return;
    onPlacementsChange(updatePlacement(placements, selectedPiece, null)); setSelectedSlot(null); setAwaitingPiece(false);
    setAnnouncement(`${selected?.label ?? 'Object'} returned to the tray.`);
  }
  function resetLayout() {
    if (locked) return;
    onPlacementsChange([]); setSelectedPiece(null); setSelectedSlot(null); setAwaitingPiece(false); setAnnouncement('All objects returned to the tray.');
  }
  function beginDrag(id: string, event: DragEvent<HTMLElement>) {
    if (locked || !pieces.has(id)) { event.preventDefault(); return; }
    draggedPiece.current = id; setSelectedPiece(id); setSelectedSlot(null); setAwaitingPiece(false);
    event.dataTransfer.setData(DRAG_TYPE, id); event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move';
  }
  function drop(slotId: string, event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData('text/plain') || draggedPiece.current;
    if (id) place(id, slotId);
    draggedPiece.current = null; setGhost(null);
  }
  function touchDown(id: string, event: PointerEvent<HTMLButtonElement>) {
    if (locked || !event.isPrimary || !['touch', 'pen'].includes(event.pointerType)) return;
    touchDrag.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }
  function touchMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = touchDrag.current;
    if (!drag || drag.pointerId !== event.pointerId || locked) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    if (!drag.moved) { drag.moved = true; event.currentTarget.setPointerCapture?.(event.pointerId); setSelectedPiece(drag.id); setSelectedSlot(null); }
    event.preventDefault(); setGhost({ id: drag.id, x: event.clientX, y: event.clientY });
  }
  function touchEnd(event: PointerEvent<HTMLButtonElement>) {
    const drag = touchDrag.current; touchDrag.current = null; setGhost(null);
    if (!drag || drag.pointerId !== event.pointerId || !drag.moved) return;
    event.preventDefault(); suppressClickUntil.current = now() + 400;
    const target = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-ai-slot]');
    if (target?.dataset.aiSlot) place(drag.id, target.dataset.aiSlot);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  const visibleStudy = isStudy && !concealed && !hidden && remaining > 0;
  const publicPhase = isStudy && !visibleStudy ? 'concealed' : scene.phase;
  const opponentName = opponent.displayName || 'Your rival';
  const syncText = saveState === 'offline' ? 'Layout kept on this device' : saveState === 'saving' ? 'Saving layout…' : 'Layout saved';
  const boardStyle = sceneWidth ? { width: `${sceneWidth}px` } as CSSProperties : undefined;
  const ghostPiece = ghost ? pieces.get(ghost.id) : null;
  return <section className="ai-game" data-testid="afterimage-game" data-afterimage-phase={publicPhase} data-afterimage-round={roundNumber} aria-label={`Afterimage, round ${roundNumber} of 3`}>
    <header className="ai-game-header"><button className="ai-game-icon" type="button" aria-label="Leave Afterimage and return to Showdown" onClick={onLeave ?? (() => { window.location.assign('/showdown'); })}><ChevronLeft size={20} aria-hidden="true" /></button><div className="ai-game-brand"><Eye size={23} aria-hidden="true" /><div><small>DH SHOWDOWN</small><h1>Afterimage</h1></div></div><div className="ai-game-opponent">{opponent.avatarUrl ? <img src={opponent.avatarUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} /> : <span aria-hidden="true">{opponentName.trim().slice(0, 1).toUpperCase()}</span>}<div><small>vs</small><strong>{opponentName}</strong></div></div></header>
    <div className="ai-game-progress"><div><span>ROUND {roundNumber}<small> / 3</small></span><div aria-hidden="true">{[1, 2, 3].map(number => <i key={number} className={number < roundNumber ? 'is-done' : number === roundNumber ? 'is-current' : ''} />)}</div></div><span className="ai-phase-label">{scene.phase === 'ready' ? 'Get ready' : isStudy ? visibleStudy ? 'Take it in' : 'Study ended' : isRecall ? 'Rebuild the scene' : 'Memory sealed'}</span>{typeof bankedScore === 'number' && <span className="ai-banked"><b key={bankedScore}>{bankedScore}</b><small>banked</small></span>}</div>
    <div className="ai-game-board-zone" ref={boardSpace}>
      <div className="ai-game-board-fit"><div className="ai-game-scene-surface" style={boardStyle} ref={sceneHost} data-testid="afterimage-board" data-afterimage-concealed={isStudy && !visibleStudy ? 'true' : undefined}>
        {visibleStudy ? <div className="ai-study-content" data-testid="afterimage-study">{studyArt}</div> : isRecall || isSealed ? <div data-testid="afterimage-recall"><AfterimageScene scene={scene} placements={placed} selectedSlotId={selectedSlot} readOnly={locked} mode="reconstruct" label={`${scene.title}. Reconstruct the missing objects.`} onSlotSelect={selectSlot} onSlotDrop={drop} onSlotDragOver={(_slotId, event) => { if (!locked) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onSlotDragStart={(slotId, event) => { const id = placed[slotId]; if (id) beginDrag(id, event); else event.preventDefault(); }} onSlotDragEnd={() => { draggedPiece.current = null; setGhost(null); }} /></div> : <>
          <AfterimageScene scene={blankScene} mode="study" readOnly label={`${scene.title} backdrop. Study objects are concealed.`} />
          <div className={`ai-scene-cover${scene.phase === 'ready' ? ' is-ready' : ''}`}>
            {scene.phase === 'ready' ? <><span className="ai-cover-mark"><Eye size={40} strokeWidth={1.35} aria-hidden="true" /></span><small>A LITTLE SCENE. A LASTING IMPRESSION.</small><h2>{scene.title}</h2><p>Notice {counts.objects} objects.<br />Then put the missing {counts.missing} back.</p></> : <><span className="ai-cover-mark"><EyeOff size={34} strokeWidth={1.4} aria-hidden="true" /></span><h2>{remaining <= 0 ? 'Hold that picture.' : 'Scene concealed.'}</h2><p>{remaining <= 0 ? 'Bringing back the missing scene…' : 'Checking the original study window. The clock keeps running.'}</p></>}
          </div>
        </>}
      </div></div>
    </div>
    <footer className="ai-game-footer">
      {scene.phase === 'ready' ? <>
        <div className="ai-ready-note"><Sparkles size={15} aria-hidden="true" /><p>No rush yet. Ready gives you one seven-second look.<small>Leaving the page does not pause its clock.</small></p></div>
        {operationError && <p className="ai-operation-error" role="alert">{operationError}</p>}
        {startAttempted && !starting ? <button className="ai-game-primary" type="button" disabled={refreshing || disabled} onClick={() => void refreshPhase('manual')}>{refreshing ? <LoaderCircle size={17} className="ai-operation-spin" aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}Check study status</button> : <button className="ai-game-primary" type="button" disabled={!prepared || starting || disabled} onClick={() => void startStudy()}>{starting ? <LoaderCircle size={18} className="ai-operation-spin" aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}{starting ? 'Opening your study…' : 'Ready to study'}<ArrowRight size={16} aria-hidden="true" /></button>}
      </> : isStudy ? <div className="ai-study-note">
        {visibleStudy && <div className="ai-study-clock" role="timer" aria-label={`${Math.ceil(remaining / 1000)} seconds of study remaining`}><span>{Math.ceil(remaining / 1000)}</span><div><b>Look closely</b><small>The scene changes in seven seconds.</small><i><span style={{ width: `${Math.min(100, remaining / AFTERIMAGE_STUDY_MS * 100)}%` }} /></i></div></div>}
        <p>{visibleStudy ? 'Remember what belongs where.' : operationError || 'Your original study time continues. No replay, no extra peek.'}</p>{operationError && <button className="ai-game-primary" type="button" disabled={refreshing || disabled} onClick={() => void refreshPhase('manual')}>{refreshing ? 'Checking…' : 'Retry scene refresh'}</button>}{!visibleStudy && !operationError && refreshing && <span><LoaderCircle size={15} className="ai-operation-spin" aria-hidden="true" />Checking the saved phase…</span>}
      </div> : isRecall ? <>
        <div className="ai-tray-heading"><p>{selected ? `${selected.label} selected · choose a position` : awaitingPiece ? 'Position selected · choose an object' : 'Drag an object, or tap it and then a position.'}</p><span>{placements.length}/{scene.slots.length} placed</span></div>
        <div className="ai-game-tray" role="group" aria-label="Objects to place" ref={trayHost}>{scene.tray.map(piece => {
          const hasPlacement = placements.some(item => item.object_id === piece.id);
          return <button key={piece.id} type="button" className={`ai-tray-piece${selectedPiece === piece.id ? ' is-selected' : ''}${hasPlacement ? ' is-placed' : ''}`} data-afterimage-piece={piece.id} aria-label={`Select ${piece.label}${hasPlacement ? ', already placed' : ''}`} aria-pressed={selectedPiece === piece.id} disabled={locked} draggable={!locked} onClick={event => selectPiece(piece, event.detail === 0)} onDragStart={event => beginDrag(piece.id, event)} onDragEnd={() => { draggedPiece.current = null; setGhost(null); }} onPointerDown={event => touchDown(piece.id, event)} onPointerMove={touchMove} onPointerUp={touchEnd} onPointerCancel={() => { touchDrag.current = null; setGhost(null); }}><span className="ai-tray-art" style={{ transform: `rotate(${piece.orientation ?? 0}deg)` }}><AfterimageArt assetId={piece.assetId} decorative /></span><span>{piece.label}</span>{hasPlacement && <i aria-hidden="true">set</i>}</button>;
        })}</div>
        <div className="ai-layout-status"><span className={saveState === 'offline' ? 'is-offline' : ''}>{saveState === 'offline' ? <WifiOff size={12} aria-hidden="true" /> : saveState === 'saving' ? <LoaderCircle size={12} className="ai-operation-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}{syncText}</span><small>No hints until you seal it.</small></div>
        {(operationError || error || layoutError) && <div className="ai-game-error" role="alert"><p>{operationError || layoutError || error}</p>{submission === 'error' ? <button className="ai-game-secondary" type="button" disabled={submitInFlight.current || disabled} onClick={() => void submitMemory()}>Retry memory submission</button> : onRetrySave && <button className="ai-game-secondary" type="button" disabled={disabled} onClick={onRetrySave}>Refresh saved layout</button>}</div>}
        {confirming ? <div className="ai-submit-confirm" role="group" aria-label="Confirm final memory"><p>Seal {placements.length} of {scene.slots.length} positions? This round cannot be changed afterward.</p><div><button className="ai-game-secondary" type="button" onClick={() => setConfirming(false)}>Keep arranging</button><button className="ai-game-primary" type="button" disabled={disabled || submitInFlight.current} onClick={() => void submitMemory()}>Seal this memory</button></div></div> : <div className="ai-layout-actions"><button className="ai-game-icon" type="button" aria-label="Reset placements" title="Return every object to the tray" disabled={locked || placements.length === 0} onClick={resetLayout}><RotateCcw size={18} aria-hidden="true" /></button><button className="ai-game-icon" type="button" aria-label="Return selected object to tray" disabled={locked || !selectedIsPlaced} onClick={removeSelected}><Trash2 size={17} aria-hidden="true" /></button><button className="ai-game-primary" type="button" disabled={locked} onClick={() => setConfirming(true)}>{submission === 'sending' ? <LoaderCircle size={16} className="ai-operation-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}{submission === 'sending' ? 'Sealing memory…' : submission === 'sent' ? 'Memory sealed' : 'Submit memory'}</button></div>}
      </> : <div className="ai-sealed-note"><Check size={23} aria-hidden="true" /><strong>Memory sealed.</strong><p>Opening your next saved scene…</p><button className="ai-game-secondary" type="button" disabled={refreshing || disabled} onClick={() => void refreshPhase('manual')}>Continue to saved progress</button></div>}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </footer>
    {ghost && ghostPiece && createPortal(<div className="ai-drag-preview" style={{ left: ghost.x, top: ghost.y }} data-testid="afterimage-drag-preview" aria-hidden="true"><AfterimageArt assetId={ghostPiece.assetId} decorative /></div>, document.body)}
  </section>;
}
