import { useId, useState } from 'react';
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
  const line = scene.lines[Math.max(0, Math.min(scene.lines.length - 1, lineIndex))];
  const transcript = [...new Map([...history, ...(line ? [line] : [])].map(item => [item.id, item])).values()].slice(-80);
  return <section className={`dct-dialogue ${compact ? 'is-compact' : ''}`} data-reduced-motion={reducedMotion} data-dialogue-scene={scene.id} data-dialogue-line={line?.id} aria-label={`${scene.title} dialogue`} tabIndex={0} onKeyDown={event => {
    if ((event.target as HTMLElement).closest('button,input,select,textarea,[contenteditable=true]')) return;
    if (['Enter', ' ', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onAdvance(); }
    else if (event.key === 'ArrowLeft' && onBack) { event.preventDefault(); onBack(); }
    else if (event.key === 'Escape') { event.preventDefault(); onSkip(); }
  }}>
    <div className="dct-dialogue-main"><div className="dct-dialogue-portrait" key={`${line?.speaker}:${line?.expression}`}>{line && <DeepClaimPortrait speaker={line.speaker} expression={line.expression} decorative />}</div><div className="dct-dialogue-copy"><span className="dct-kicker">{scene.title}</span><h2>{line ? NAMES[line.speaker] : 'The claim is waiting'}</h2>{line && <span className="dct-speaker-role">{ROLES[line.speaker]}</span>}<button type="button" className="dct-dialogue-text" onClick={onAdvance} aria-label="Advance dialogue"><span key={line?.id} className="dct-enter">{line?.text ?? 'Continue when you are ready.'}</span><ArrowRight size={15} aria-hidden="true" /></button></div></div>
    <div className="dct-conversation-progress" role="progressbar" aria-label="Conversation progress" aria-valuemin={0} aria-valuemax={scene.lines.length} aria-valuenow={Math.min(scene.lines.length, lineIndex + 1)}><span><i style={{ width: `${scene.lines.length ? Math.min(100, (lineIndex + 1) / scene.lines.length * 100) : 0}%` }} /></span><small>{Math.min(scene.lines.length, lineIndex + 1)} / {scene.lines.length}</small></div>
    {historyOpen && <section id={`${id}-history`} className="dct-dialogue-history" aria-label="Dialogue history"><div><h3>Camp conversations</h3><button type="button" className="dct-icon-button" aria-label="Close dialogue history" onClick={() => setHistoryOpen(false)}><X size={16} aria-hidden="true" /></button></div><ol>{transcript.map(item => <li key={item.id}><strong>{NAMES[item.speaker]}</strong><p>{item.text}</p></li>)}</ol></section>}
    <div className="dct-dialogue-controls"><button type="button" className="dct-button is-subtle" aria-label="Dialogue history" aria-expanded={historyOpen} aria-controls={`${id}-history`} onClick={() => setHistoryOpen(value => !value)}><BookOpen size={16} aria-hidden="true" /><span>History</span></button><button type="button" className="dct-button is-subtle" onClick={onSkip}><SkipForward size={16} aria-hidden="true" />{skipLabel}</button>{onBack && <button type="button" className="dct-icon-button" aria-label="Previous dialogue line" disabled={lineIndex <= 0} onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /></button>}<button type="button" className="dct-button is-primary" onClick={onAdvance}>{lineIndex < scene.lines.length - 1 ? 'Next' : 'Continue'}<ArrowRight size={16} aria-hidden="true" /></button></div>
  </section>;
}
