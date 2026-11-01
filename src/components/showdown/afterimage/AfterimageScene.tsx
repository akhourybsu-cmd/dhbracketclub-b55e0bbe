import { useId, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import type { AfterimageObject, AfterimagePiece, AfterimageSceneView, AfterimageThemeId } from '@/lib/showdown/afterimage/types';
import { AfterimageArt } from './AfterimageArt';
import './afterimageArt.css';

export interface AfterimageSceneProps {
  scene: AfterimageSceneView;
  placements?: Record<string, string | null>;
  selectedSlotId?: string | null;
  onSlotSelect?: (slotId: string) => void;
  onSlotDrop?: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  onSlotDragOver?: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  onSlotPointerUp?: (slotId: string, event: PointerEvent<HTMLButtonElement>) => void;
  onSlotDragStart?: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  onSlotDragEnd?: (slotId: string, event: DragEvent<HTMLButtonElement>) => void;
  readOnly?: boolean;
  mode?: 'study' | 'reconstruct' | 'results';
  /** The renderer deliberately ignores grading outside completed-match review. */
  feedback?: Record<string, 'correct' | 'wrong' | 'empty'>;
  className?: string;
  label?: string;
}

const ROOM = {
  workshop: { wall: '#ead8b6', light: '#fff2d1', wood: '#b68d66', edge: '#876c52', pane: '#acc7ba', floor: '#ceb28c' },
  greenhouse: { wall: '#dce5cc', light: '#f7f2d5', wood: '#9caa86', edge: '#6f866f', pane: '#b3d0ba', floor: '#c4c9a4' },
  harbor: { wall: '#f1dfc0', light: '#fff4d6', wood: '#c59671', edge: '#947358', pane: '#b2d1ca', floor: '#d8b48b' },
  clockmaker: { wall: '#e1cdb3', light: '#f7e9cb', wood: '#a58367', edge: '#776351', pane: '#afc3b7', floor: '#c5a784' },
  kitchen: { wall: '#e9e1c4', light: '#fff6da', wood: '#b5ae89', edge: '#81907b', pane: '#bed1b2', floor: '#cec2a0' },
  observatory: { wall: '#c8d6ce', light: '#f1e9d1', wood: '#a4aaa0', edge: '#71877e', pane: '#95b8b6', floor: '#babfa7' },
} satisfies Record<AfterimageThemeId, Record<string, string>>;

/** Architecture stays behind the playable miniatures; it never repeats a tray object. */
function RoomBackdrop({ theme, id }: { theme: AfterimageThemeId; id: string }) {
  const p = ROOM[theme];
  let detail: ReactNode;
  switch (theme) {
    case 'workshop': detail = <>
      <path d="M80 208V128Q80 47 160 47Q240 47 240 128V208Z" fill={`url(#${id}-window)`} stroke={p.edge} strokeWidth="10" />
      <path d="M160 52V207M84 135H237" fill="none" stroke={p.light} strokeWidth="8" />
      <path d="M802 0V116Q797 154 821 182M814 71Q861 52 860 92Q827 104 814 71M808 123Q768 112 778 149Q805 158 808 123" fill="#8aab85" opacity=".55" />
      <path d="M338 68H663M366 95H633" stroke={p.edge} strokeWidth="3" opacity=".22" />
    </>; break;
    case 'greenhouse': detail = <>
      <path d="M54 204V100L265 18H735L946 100V204M265 18V204M500 18V204M735 18V204M54 100H946" fill={`url(#${id}-window)`} stroke="#89a18d" strokeWidth="9" />
      <path d="M8 415Q62 289 38 186M23 355Q-24 297 15 276Q54 291 23 355M33 290Q93 249 82 217Q39 216 33 290M972 416Q926 297 961 179M953 314Q903 280 913 242Q958 250 953 314M959 255Q1002 220 987 185Q952 192 959 255" fill="#8eaa83" opacity=".55" />
    </>; break;
    case 'harbor': detail = <>
      <path d="M48 40H952V122Q918 151 886 122Q851 151 816 122Q781 151 746 122Q711 151 676 122Q641 151 606 122Q571 151 536 122Q501 151 466 122Q431 151 396 122Q361 151 326 122Q291 151 256 122Q221 151 186 122Q151 151 116 122Q81 151 48 122Z" fill="#dcb09a" />
      <path d="M116 40V122M256 40V122M396 40V122M536 40V122M676 40V122M816 40V122" stroke="#f8e7c8" strokeWidth="65" />
      <path d="M70 150H930V220H70Z" fill={`url(#${id}-window)`} />
      <path d="M75 194Q166 177 260 194T450 194T640 194T830 194T930 194M65 215H935" fill="none" stroke="#79a69e" strokeWidth="5" opacity=".65" />
    </>; break;
    case 'clockmaker': detail = <>
      <path d="M90 205V95Q90 34 170 34H830Q910 34 910 95V205M113 205V100Q113 56 173 56H827Q887 56 887 100V205" fill="none" stroke={p.edge} strokeWidth="5" opacity=".38" />
      <path d="M304 60V203M697 60V203M115 134H887" stroke={p.edge} strokeWidth="5" opacity=".25" />
      <path d="M47 1V700M953 1V700" stroke={p.wood} strokeWidth="26" opacity=".4" />
    </>; break;
    case 'kitchen': detail = <>
      <path d="M62 50H938V213H62Z" fill="#d3dcbf" />
      <path d="M62 104H938M62 158H938M116 50V213M224 50V213M332 50V213M440 50V213M548 50V213M656 50V213M764 50V213M872 50V213" stroke={p.light} strokeWidth="4" opacity=".8" />
      <path d="M55 46H945M55 216H945" stroke={p.edge} strokeWidth="9" opacity=".5" />
      <path d="M87 243Q95 231 103 243M301 243Q309 231 317 243M515 243Q523 231 531 243M729 243Q737 231 745 243M921 243Q929 231 937 243" stroke={p.edge} fill="none" strokeWidth="4" opacity=".4" />
    </>; break;
    case 'observatory': detail = <>
      <path d="M80 210V160Q80 16 500 16Q920 16 920 160V210Z" fill={`url(#${id}-window)`} stroke={p.edge} strokeWidth="9" />
      <path d="M500 20V208M183 78L269 207M817 78L731 207M97 140H903" stroke={p.light} strokeWidth="7" opacity=".65" />
      <path d="M261 52Q475 191 737 66M197 180Q500 27 812 177" fill="none" stroke={p.light} strokeWidth="2" opacity=".35" />
      <circle cx="348" cy="75" r="3" fill={p.light} /><circle cx="624" cy="112" r="4" fill={p.light} /><circle cx="782" cy="152" r="3" fill={p.light} />
    </>; break;
  }
  return <svg className="ai-scene-backdrop" viewBox="0 0 1000 700" aria-hidden="true" focusable="false" preserveAspectRatio="none">
    <defs>
      <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={p.light} /><stop offset="1" stopColor={p.wall} /></linearGradient>
      <linearGradient id={`${id}-window`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={p.pane} /><stop offset="1" stopColor={p.light} /></linearGradient>
      <linearGradient id={`${id}-ledge`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={p.wood} /><stop offset="1" stopColor={p.edge} /></linearGradient>
      <radialGradient id={`${id}-light`} cx=".4" cy="0" r="1"><stop stopColor="#fff9df" stopOpacity=".4" /><stop offset="1" stopColor="#fff9df" stopOpacity="0" /></radialGradient>
    </defs>
    <path d="M0 0H1000V700H0Z" fill={`url(#${id}-wall)`} />
    {detail}
    <path d="M22 0V700M978 0V700" stroke={p.edge} strokeWidth="9" opacity=".18" />
    <path d="M0 670H1000V700H0Z" fill={p.floor} />
    {[250, 470, 670].map(y => <g key={y}>
      <path d={`M35 ${y + 5}H965V${y + 28}H35Z`} fill={p.edge} opacity=".12" />
      <path d={`M27 ${y}H973V${y + 11}H27Z`} fill={`url(#${id}-ledge)`} />
      <path d={`M30 ${y}H970`} stroke={p.light} strokeWidth="3" opacity=".65" />
    </g>)}
    <path d="M0 0H1000V700H0Z" fill={`url(#${id}-light)`} />
  </svg>;
}

function position(x: number, y: number, width: number, height: number, scene: AfterimageSceneView, layer: number): CSSProperties {
  return { left: `${x * 100 / scene.width}%`, top: `${y * 100 / scene.height}%`, width: `${width * 100 / scene.width}%`, height: `${height * 100 / scene.height}%`, zIndex: layer + 1 };
}

function location(object: AfterimageObject, scene: AfterimageSceneView): string {
  const row = object.y < scene.height / 3 ? 'upper' : object.y > scene.height * 2 / 3 ? 'lower' : 'middle';
  const column = object.x < scene.width / 3 ? 'left' : object.x > scene.width * 2 / 3 ? 'right' : 'center';
  return `${row} ${column}`;
}

function PieceArt({ piece }: { piece: AfterimagePiece }) {
  return <span className="ai-scene-piece-turn" style={{ transform: `rotate(${piece.orientation ?? 0}deg)` }}><AfterimageArt assetId={piece.assetId} decorative /></span>;
}

export function AfterimageScene({ scene, placements = {}, selectedSlotId, onSlotSelect, onSlotDrop, onSlotDragOver, onSlotPointerUp, onSlotDragStart, onSlotDragEnd, readOnly = false, mode, feedback = {}, className = '', label }: AfterimageSceneProps) {
  const id = `ai-room-${useId().replace(/:/g, '')}`;
  const displayMode = mode ?? (scene.phase === 'study' ? 'study' : 'reconstruct');
  const interactive = displayMode === 'reconstruct' && !readOnly;
  const pieces = new Map(scene.tray.map(piece => [piece.id, piece]));
  return <div className={`ai-scene ${className}`} style={{ aspectRatio: `${scene.width} / ${scene.height}` }} role="group" aria-label={label ?? scene.a11y.label} data-afterimage-scene={scene.id} data-afterimage-theme={scene.background} data-afterimage-mode={displayMode}>
    <RoomBackdrop theme={scene.background} id={id} />
    {[...scene.objects].sort((a, b) => a.layer - b.layer).map(object => <span key={object.id} className="ai-scene-object" style={position(object.x, object.y, 140, 130, scene, object.layer)} role="img" aria-label={`${object.label}, ${location(object, scene)}`} data-afterimage-object={object.id}>
      <PieceArt piece={object} />
    </span>)}
    {scene.slots.map((slot, index) => {
      const piece = pieces.get(placements[slot.id] ?? '');
      const grade = displayMode === 'results' ? feedback[slot.id] : undefined;
      const slotLabel = `Position ${index + 1}${piece ? `: ${piece.label}` : ': empty'}`;
      const contents = <>
        {piece ? <span className="ai-scene-slot-art"><PieceArt piece={piece} /></span> : <span className="ai-scene-slot-number" aria-hidden="true">{index + 1}</span>}
        {grade && <span className="ai-scene-slot-grade" aria-hidden="true">{grade === 'correct' ? <svg viewBox="0 0 20 20"><path d="M4 10L8 14L16 5" /></svg> : grade === 'wrong' ? <svg viewBox="0 0 20 20"><path d="M5 5L15 15M15 5L5 15" /></svg> : <svg viewBox="0 0 20 20"><path d="M5 10H15" /></svg>}</span>}
      </>;
      const slotClass = `ai-scene-slot${piece ? ' ai-scene-slot--filled' : ''}${selectedSlotId === slot.id && interactive ? ' ai-scene-slot--selected' : ''}${grade ? ` ai-scene-slot--${grade}` : ''}`;
      const slotStyle = position(slot.x, slot.y, slot.width, slot.height, scene, slot.layer + 1);
      if (!interactive) return <div key={slot.id} className={slotClass} style={slotStyle} role="img" aria-label={`${slotLabel}${grade ? `, ${grade}` : ''}`} data-ai-slot={slot.id} data-afterimage-slot={slot.id}>{contents}</div>;
      return <button key={slot.id} type="button" className={slotClass} style={slotStyle} aria-label={slotLabel} aria-pressed={selectedSlotId === slot.id} data-ai-slot={slot.id} data-afterimage-slot={slot.id} onClick={() => onSlotSelect?.(slot.id)} onDrop={event => onSlotDrop?.(slot.id, event)} onDragOver={event => onSlotDragOver?.(slot.id, event)} onPointerUp={event => onSlotPointerUp?.(slot.id, event)} onDragStart={event => onSlotDragStart?.(slot.id, event)} onDragEnd={event => onSlotDragEnd?.(slot.id, event)} draggable={Boolean(piece && onSlotDragStart)}>{contents}</button>;
    })}
    <div className="ai-scene-vignette" aria-hidden="true" />
  </div>;
}
