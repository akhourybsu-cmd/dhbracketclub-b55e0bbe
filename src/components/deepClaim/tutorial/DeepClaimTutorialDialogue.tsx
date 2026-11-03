import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, SkipForward, X } from 'lucide-react';
import type { DialogueLine, DialogueScene } from '@/lib/deepClaim/tutorial/types';
import { DeepClaimPortrait } from './DeepClaimPortrait';
import './tutorial.css';

const ROLES = { gus: 'Retired prospector', mara: 'Miner', ivo: 'Geologist', tessa: 'Hauler' };
const NAMES = { gus: 'Gus “Gravel” Calloway', mara: 'Mara Flint', ivo: 'Ivo Vale', tessa: 'Tessa Pike' };
export interface DeepClaimTutorialDialogueProps {
  scene: DialogueScene; lineIndex: number; onAdvance: () => void; onBack?: () => void; onSkip: () => void;
  history?: readonly DialogueLine[]; reducedMotion?: boolean; compact?: boolean; skipLabel?: string;
}
/** Controlled reading only: finishing a line never confirms an economic action. */
export function DeepClaimTutorialDialogue({ scene, lineIndex, onAdvance, onBack, onSkip, history = [], reducedMotion = false, compact = false, skipLabel = 'Skip dialogue' }: DeepClaimTutorialDialogueProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const previousScene = useRef(scene.id);
  const closeHistory = useCallback(() => { setHistoryOpen(false); historyButton.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (previousScene.current === scene.id) return;
    previousScene.current = scene.id;
    if (root.current?.querySelector('.dct-dialogue-history')?.contains(document.activeElement)) closeHistory();
    else setHistoryOpen(false);
  }, [scene.id, closeHistory]);
  useLayoutEffect(() => { if (historyOpen) historyHeading.current?.focus({ preventScroll: true }); }, [historyOpen]);
  useEffect(() => {
    if (!historyOpen) return;
    // Close the reader before a containing dialog handles Escape as a skip.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !(event.target instanceof Node) || !root.current?.contains(event.target)) return;
      event.preventDefault(); event.stopPropagation(); closeHistory();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [historyOpen, closeHistory]);
  const index = Math.max(0, Math.min(scene.lines.length - 1, Number.isFinite(lineIndex) ? Math.trunc(lineIndex) : 0));
  const progress = scene.lines.length ? index + 1 : 0;
  const line = scene.lines[index];
  const transcript = [...new Map([...history, ...(line ? [line] : [])].map(item => [item.id, item])).values()].slice(-80);
  return <section ref={root} className={`dct-dialogue ${compact ? 'is-compact' : ''}`} data-reduced-motion={reducedMotion} data-dialogue-scene={scene.id} data-dialogue-line={line?.id} aria-label={`${scene.title} dialogue`} tabIndex={0} onKeyDown={event => {
    if (historyOpen) return;
    if ((event.target as HTMLElement).closest('button,input,select,textarea,[contenteditable=true]')) return;
    if (['Enter', ' ', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onAdvance(); }
    else if (event.key === 'ArrowLeft' && onBack) { event.preventDefault(); onBack(); }
    else if (event.key === 'Escape') { event.preventDefault(); onSkip(); }
  }}>
    <div className="dct-dialogue-main"><div className="dct-dialogue-portrait" key={`${line?.speaker}:${line?.expression}`}>{line && <DeepClaimPortrait speaker={line.speaker} expression={line.expression} decorative />}</div><div className="dct-dialogue-copy"><span className="dct-kicker">{scene.title}</span><h2>{line ? NAMES[line.speaker] : 'The claim is waiting'}</h2>{line && <span className="dct-speaker-role">{ROLES[line.speaker]}</span>}<button type="button" className="dct-dialogue-text" onClick={onAdvance} aria-label="Advance dialogue"><span key={line?.id} className="dct-enter">{line?.text ?? 'Continue when you are ready.'}</span><ArrowRight size={15} aria-hidden="true" /></button></div></div>
    <div className="dct-conversation-progress" role="progressbar" aria-label="Conversation progress" aria-valuemin={0} aria-valuemax={scene.lines.length} aria-valuenow={progress}><span><i style={{ width: `${scene.lines.length ? progress / scene.lines.length * 100 : 0}%` }} /></span><small>{progress} / {scene.lines.length}</small></div>
    {historyOpen && <section id={`${id}-history`} className="dct-dialogue-history" aria-label="Dialogue history"><div><h3 ref={historyHeading} tabIndex={-1}>Camp conversations</h3><button type="button" className="dct-icon-button" aria-label="Close dialogue history" onClick={closeHistory}><X size={16} aria-hidden="true" /></button></div><ol>{transcript.map(item => <li key={item.id}><strong>{NAMES[item.speaker]}</strong><p>{item.text}</p></li>)}</ol></section>}
    <div className="dct-dialogue-controls"><button ref={historyButton} type="button" className="dct-icon-button is-subtle" aria-label="Dialogue history" title="Read the conversation" aria-expanded={historyOpen} aria-controls={`${id}-history`} onClick={() => { if (historyOpen) closeHistory(); else setHistoryOpen(true); }}><BookOpen size={16} aria-hidden="true" /></button><button type="button" className="dct-button is-subtle" aria-label={skipLabel} title={skipLabel} onClick={onSkip}><SkipForward size={16} aria-hidden="true" />Skip</button>{onBack && <button type="button" className="dct-icon-button" aria-label="Previous dialogue line" disabled={index <= 0} onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /></button>}<button type="button" className="dct-button is-primary" onClick={onAdvance}>{index < scene.lines.length - 1 ? 'Next' : 'Continue'}<ArrowRight size={16} aria-hidden="true" /></button></div>
  </section>;
}
