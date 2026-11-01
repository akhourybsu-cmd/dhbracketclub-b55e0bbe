import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { replayActions } from '@/lib/showdown/prism/engine';
import type { BeamColor, Direction, PrismAction, PrismPuzzle, PrismTile } from '@/lib/showdown/prism/types';
import './prismBreak.css';

const PRISM_BEAM_COLORS: Record<BeamColor, string> = {
  cyan: '#51e5ff', magenta: '#f68aff', gold: '#ffd77a', white: '#eaf8ff',
  red: '#ff899a', green: '#8df0bd', blue: '#8eaeff',
};
const COLOR_MARKS: Record<BeamColor, string> = { cyan: 'C', magenta: 'M', gold: 'Au', white: 'W', red: 'R', green: 'G', blue: 'B' };
const DIRECTION_ANGLE: Record<Direction, number> = { N: -90, E: 0, S: 90, W: 180 };
const BEAM_PATTERN: Partial<Record<BeamColor, string>> = { magenta: '.13 .045', gold: '.035 .04', white: '.18 .025', red: '.09 .04', green: '.045 .03', blue: '.18 .04 .035 .04' };

function tileDescription(tile: PrismTile, orientation: string, active: boolean) {
  if (tile.kind === 'empty') return 'Empty space';
  if (tile.kind === 'wall') return 'Wall, blocks light';
  if (tile.kind === 'mirror') return `${tile.rotatable ? 'Rotatable' : 'Fixed'} ${orientation === '/' ? 'slash' : 'backslash'} mirror`;
  if (tile.kind === 'emitter') return `${tile.color} emitter, points ${tile.direction}`;
  if (tile.kind === 'receiver') return `${tile.color} receiver ${tile.label}, ${active ? 'activated' : 'waiting for matching light'}`;
  if (tile.kind === 'filter') return `Color filter, accepts ${tile.accepts.join(' or ')}${tile.output ? ` and outputs ${tile.output}` : ''}`;
  return 'Prism splitter, sends light in the marked directions';
}

function TileGlyph({ tile, orientation, active }: { tile: PrismTile; orientation: string; active: boolean }) {
  return <svg className="pb-tile-glyph" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    {tile.kind === 'wall' && <><path d="M17 26 34 16h40l10 14v43L68 85H29L16 69Z" fill="currentColor" opacity=".55" /><path d="m26 31 14 9-4 20 16 12m20-42-12 15 10 19" stroke="currentColor" strokeWidth="4" opacity=".55" /></>}
    {tile.kind === 'mirror' && <g className="pb-mirror-crystal" style={{ transform: `rotate(${orientation === '/' ? 0 : 90}deg)` }}>
      <path d="m19 71 10 10 52-52-10-10Z" fill="currentColor" opacity=".14" />
      <path d="m25 75 50-50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <path d="m29 72 43-43" stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      {!tile.rotatable && <path d="m42 42 16 16m-16 0 16-16" stroke="currentColor" strokeWidth="3" />}
    </g>}
    {tile.kind === 'emitter' && <g style={{ color: PRISM_BEAM_COLORS[tile.color], transform: `rotate(${DIRECTION_ANGLE[tile.direction]}deg)`, transformOrigin: '50px 50px' }}>
      <path d="m18 32 18-12h34l14 18v24L70 80H36L18 68Z" fill="currentColor" opacity=".13" />
      <path d="m18 32 18-12h34l14 18v24L70 80H36L18 68Z" stroke="currentColor" strokeWidth="3" />
      <path d="M30 50h34m-12-12 12 12-12 12" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </g>}
    {tile.kind === 'receiver' && <g className={`pb-receiver${active ? ' is-active' : ''}`} style={{ color: active ? PRISM_BEAM_COLORS.gold : PRISM_BEAM_COLORS[tile.color] }}>
      <circle className="pb-receiver-ring" cx="50" cy="50" r="35" fill="currentColor" fillOpacity={active ? '.2' : '.04'} stroke="currentColor" strokeWidth={active ? '5' : '2'} />
      <path d="M50 20v8m30 22h-8M50 80v-8M20 50h8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <text x="50" y="57" textAnchor="middle" fill="currentColor" fontSize={tile.label.length > 2 ? '17' : '25'} fontWeight="800">{tile.label}</text>
      {active && <path d="m68 75 5 5 10-12" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
    </g>}
    {tile.kind === 'filter' && <g style={{ color: PRISM_BEAM_COLORS[tile.output ?? tile.accepts[0] ?? 'white'] }}>
      <path d="m32 18-9 32 9 32h36l9-32-9-32Z" fill="currentColor" opacity=".16" />
      <path d="m32 18-9 32 9 32h36l9-32-9-32Z" stroke="currentColor" strokeWidth="3" />
      <path d="M32 28h36M29 36h42M29 64h42M32 72h36" stroke="currentColor" strokeWidth="2" opacity=".5" />
      <text x="50" y="56" textAnchor="middle" fill="currentColor" fontSize="19" fontWeight="800">{COLOR_MARKS[tile.output ?? tile.accepts[0] ?? 'white']}</text>
    </g>}
    {tile.kind === 'splitter' && <g className="pb-splitter">
      <path d="m50 13 38 66H12Z" fill="#bfa7ff" fillOpacity=".17" stroke="#d5c2ff" strokeWidth="3" strokeLinejoin="round" />
      <path d="m50 13 1 40-39 26m39-26 37 26" stroke="#d5c2ff" strokeWidth="2" opacity=".6" />
      <circle cx="51" cy="53" r="7" fill="#f0e8ff" />
      {[...new Map(tile.rules.flatMap(rule => rule.outputs).map(output => [output.direction, output])).values()].map(output => <path key={output.direction} d="M64 50h15m-5-5 5 5-5 5" stroke={PRISM_BEAM_COLORS[output.color]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${DIRECTION_ANGLE[output.direction]}deg)`, transformOrigin: '50px 50px' }} />)}
    </g>}
  </svg>;
}

export interface PrismBoardProps {
  puzzle: PrismPuzzle;
  actions?: PrismAction[];
  readOnly?: boolean;
  disabled?: boolean;
  selectedCell?: number;
  onSelectCell?: (cell: number) => void;
  onRotate?: (cell: number) => void;
  /** Fits a gameplay area in both dimensions; inspectors keep their natural aspect ratio. */
  fit?: boolean;
  label?: string;
}

/** Rendering consumes the pure replay trace, never a solver or private puzzle metadata. */
export function PrismBoard({ puzzle, actions = [], readOnly = false, disabled = false, selectedCell, onSelectCell, onRotate, fit = false, label = 'Prism Break puzzle board' }: PrismBoardProps) {
  const replay = useMemo(() => replayActions(puzzle, actions), [puzzle, actions]);
  const activated = new Set(replay.trace.activatedReceivers);
  const box = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const descriptionId = useId();
  useLayoutEffect(() => {
    if (!fit || !box.current) return;
    const element = box.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        const size = Math.floor(Math.min(bounds.width, bounds.height * puzzle.width / puzzle.height, 560));
        setBoardWidth(previous => previous === size ? previous : size);
      }
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [fit, puzzle.width, puzzle.height]);
  const style = {
    '--pb-columns': puzzle.width,
    '--pb-rows': puzzle.height,
    aspectRatio: `${puzzle.width} / ${puzzle.height}`,
    ...(fit && boardWidth ? { width: `${boardWidth}px` } : {}),
  } as CSSProperties;
  return <div className={`pb-board-fit${fit ? ' is-fitting' : ''}`} ref={box}>
    <div className={`pb-board-stage${replay.solved ? ' is-solved' : ''}${readOnly ? ' is-inspector' : ''}`} style={style} data-testid="prism-board" data-prism-puzzle={puzzle.id} data-prism-solved={replay.solved} role="group" aria-label={label} aria-describedby={descriptionId}>
      <p className="sr-only" id={descriptionId}>{readOnly ? 'Final board. ' : 'Tap a mirror to turn it. Keyboard: Tab to a mirror, then Enter or Space to rotate. '}Cyan light is solid; other beam colors use distinct dash patterns. Receivers have named symbols and show a check when active.</p>
      <div className="pb-tile-grid">
        {puzzle.tiles.map((tile, cell) => {
          const orientation = tile.kind === 'mirror' ? replay.orientations[cell] ?? tile.orientation : '';
          const active = activated.has(cell);
          const row = Math.floor(cell / puzzle.width) + 1, column = cell % puzzle.width + 1;
          const text = `Row ${row}, column ${column}: ${tileDescription(tile, orientation, active)}`;
          const className = `pb-tile is-${tile.kind}${tile.kind === 'mirror' && tile.rotatable ? ' is-rotatable' : ''}${selectedCell === cell && !readOnly ? ' is-selected' : ''}${active ? ' is-activated' : ''}`;
          return tile.kind === 'mirror' && tile.rotatable && !readOnly ? <button key={cell} type="button" className={className} data-prism-cell={cell} aria-label={`${text}. Rotate mirror`} aria-pressed={selectedCell === cell} disabled={disabled || replay.solved} onFocus={() => onSelectCell?.(cell)} onClick={() => { onSelectCell?.(cell); onRotate?.(cell); }}><TileGlyph tile={tile} orientation={orientation} active={active} /></button>
            : <div key={cell} className={className} data-prism-cell={cell} role={tile.kind !== 'empty' ? 'img' : undefined} aria-hidden={tile.kind === 'empty' ? true : undefined} aria-label={tile.kind !== 'empty' ? text : undefined}><TileGlyph tile={tile} orientation={orientation} active={active} /></div>;
        })}
      </div>
      <svg className="pb-energy" viewBox={`0 0 ${puzzle.width} ${puzzle.height}`} fill="none" aria-hidden="true">
        {replay.trace.segments.map((segment, index) => <g key={`${index}:${segment.fromCell}:${segment.toCell}:${segment.color}`} style={{ color: PRISM_BEAM_COLORS[segment.color] }} data-beam-color={segment.color}>
          <line className="pb-beam-halo" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke="currentColor" strokeWidth=".16" opacity=".14" strokeLinecap="round" />
          <line className="pb-beam-core" x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke="currentColor" strokeWidth=".045" strokeDasharray={BEAM_PATTERN[segment.color]} strokeLinecap="round" />
        </g>)}
      </svg>
    </div>
  </div>;
}
