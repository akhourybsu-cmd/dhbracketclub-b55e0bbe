import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, MapPin, Package, ScrollText, Sparkles, Swords } from 'lucide-react';
import type { RuntimeBlock } from '@/lib/journey/types';
import { DialogueBlock } from './DialogueBlock';
import { Instant, Typewriter } from './Typewriter';

const MAX_BEATS_PER_PANEL = 8;

/** Split a scene at authored dividers and into readable passages. Discovery
 *  Below carries novella-length scenes; keeping each passage compact gives the
 *  dialogue rhythm and gives the player regular moments to act or pause. */
function splitPanels(blocks: RuntimeBlock[]): RuntimeBlock[][] {
  const panels: RuntimeBlock[][] = [];
  let cur: RuntimeBlock[] = [];
  const flush = () => {
    if (cur.length > 0) panels.push(cur);
    cur = [];
  };
  for (const b of blocks) {
    if (b.block_type === 'divider') {
      flush();
      continue;
    }
    cur.push(b);
    if (cur.length >= MAX_BEATS_PER_PANEL) flush();
  }
  flush();
  const nonEmpty = panels.filter((p) => p.length > 0);
  return nonEmpty.length ? nonEmpty : [[]];
}

/**
 * Renders a scene as a sequence of panels. Within a panel the beats narrate one
 * at a time (tap to reveal the rest); a change of place or time (a divider) is a
 * Continue button that carries the reader to the next panel, so a new location
 * never spills into the one before it. `onDone` fires when the final panel has
 * finished, so the scene's choices can follow.
 */
export function SceneBlocks({
  blocks, onDone, instant = false, initialPanel, onPanel,
}: {
  blocks: RuntimeBlock[]; onDone?: () => void; instant?: boolean;
  /** Restore to this panel (revealed) after a reload; undefined = start fresh. */
  initialPanel?: number;
  /** Reports the active panel index as the reader advances, for persistence. */
  onPanel?: (index: number) => void;
}) {
  const panels = useMemo(() => splitPanels(blocks), [blocks]);
  const [panel, setPanel] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [skip, setSkip] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const panelTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Restoring a reading position (initialPanel provided): jump to that panel
    // with everything up to it already revealed. Otherwise, narrate from the top.
    if (initialPanel !== undefined) {
      const start = Math.min(Math.max(0, initialPanel), Math.max(0, splitPanels(blocks).length - 1));
      setPanel(start);
      setRevealed(splitPanels(blocks)[start]?.length ?? 0);
      setSkip(true);
    } else {
      setPanel(0);
      setRevealed(0);
      setSkip(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const cur = panels[panel] ?? [];
  const panelComplete = revealed >= cur.length;
  const isLast = panel >= panels.length - 1;

  // Only the FINAL panel finishing tells the scene it's done (choices follow).
  useEffect(() => {
    if (!instant && panelComplete && isLast) doneRef.current?.();
  }, [instant, panelComplete, isLast]);

  // A finished scene shown as scrollback: every block at once, no typing, no breaks.
  if (instant) {
    return (
      <div className="space-y-5">
        {blocks.filter((b) => b.block_type !== 'divider').map((b, i) => (
          <Fragment key={`${b.block_type}-${b.display_order}-${i}`}>
            {renderBlock(b, { active: false, skip: true, onDone: () => {} })}
          </Fragment>
        ))}
      </div>
    );
  }

  const advancePanel = () => {
    setPanel((p) => { const n = p + 1; onPanel?.(n); return n; });
    setRevealed(0);
    setSkip(false);
    requestAnimationFrame(() => panelTopRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  return (
    <div className="space-y-5">
      {/* Completed passages remain available without forcing a long scroll. */}
      {panel > 0 && (
        <details className="jy-scrollback">
          <summary>Earlier in this scene · {panel} {panel === 1 ? 'passage' : 'passages'}</summary>
          <div className="mt-4 space-y-5">
            {panels.slice(0, panel).map((p, idx) => (
              <div key={`past-${idx}`} className="space-y-5">
                {p.map((b, i) => (
                  <Fragment key={`past-${idx}-${i}`}>
                    {renderBlock(b, { active: false, skip: true, onDone: () => {} })}
                  </Fragment>
                ))}
                {idx < panel - 1 && <div className="jy-rule" />}
              </div>
            ))}
          </div>
        </details>
      )}

      {panels.length > 1 && (
        <div className="jy-passage-progress" aria-label={`Passage ${panel + 1} of ${panels.length}`}>
          <span>Passage {panel + 1}</span>
          <div aria-hidden>{panels.map((_, i) => <i key={i} className={i <= panel ? 'is-read' : ''} />)}</div>
          <span>{panels.length}</span>
        </div>
      )}

      {/* The panel being read now. */}
      <div ref={panelTopRef} className="space-y-5" onClick={() => { if (!panelComplete) setSkip(true); }}>
        {cur.slice(0, revealed + 1).map((b, i) => (
          <Fragment key={`p${panel}-${i}`}>
            {renderBlock(b, {
              active: i === revealed,
              skip: skip || i < revealed,
              onDone: () => setRevealed((n) => Math.max(n, i + 1)),
            })}
          </Fragment>
        ))}
      </div>

      {!panelComplete && (
        <div className="jy-muted text-[0.7rem] tracking-wide">tap to continue</div>
      )}
      {panelComplete && !isLast && (
        <div className="jy-fade-in mt-6 text-center">
          <button type="button" className="jy-btn jy-btn-primary" onClick={advancePanel}>
            Continue the scene · {panel + 2}/{panels.length}
          </button>
        </div>
      )}
    </div>
  );
}

interface Beat { active: boolean; skip: boolean; onDone: () => void }

interface BlockMetadata {
  region?: string;
  title?: string;
  name?: string;
  description?: string;
  speaker_name?: string;
  speaker_key?: string;
  emotion?: string;
  portrait?: string;
  portrait_url?: string;
  src?: string;
  alt?: string;
  caption?: string;
  stat?: string;
  value?: string | number;
}

function renderBlock(b: RuntimeBlock, beat: Beat) {
  const md = (b.metadata ?? {}) as BlockMetadata;
  switch (b.block_type) {
    case 'location_intro':
      return (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <div className="jy-fade-in py-2">
            <div className="jy-eyebrow flex items-center gap-1.5">
              <MapPin className="h-3 w-3" aria-hidden />
              {md.region ?? 'Mesoplasia'}
            </div>
            <h2 className="jy-title mt-1">{b.content}</h2>
            <div className="jy-rule mt-3" />
          </div>
        </Instant>
      );

    case 'character_intro':
      return (
        <div className="jy-panel jy-fade-in p-4">
          <div className="jy-eyebrow">{md.title ?? 'Encounter'}</div>
          <h3 className="jy-display mt-1 text-lg">{md.name ?? b.content}</h3>
          {md.description ? (
            <p className="jy-prose mt-2 text-sm">
              <Typewriter text={String(md.description)} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
            </p>
          ) : (
            <Instant skip={beat.skip} onDone={beat.onDone}>{null}</Instant>
          )}
        </div>
      );

    case 'dialogue':
      return (
        <DialogueBlock
          speaker={String(md.speaker_name ?? md.speaker_key ?? 'Unknown')}
          emotion={md.emotion as string | undefined}
          portrait={(md.portrait ?? md.portrait_url) as string | undefined}
          text={b.content ?? ''}
          active={beat.active}
          skip={beat.skip}
          onDone={beat.onDone}
        />
      );

    case 'image':
      return md.src ? (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <figure className="jy-fade-in text-center">
            <img
              src={md.src}
              alt={md.alt ?? ''}
              loading="lazy"
              decoding="async"
              className="mx-auto max-h-[70vh] w-auto max-w-full rounded-sm"
              style={{ border: '1px solid hsl(var(--jy-border-subtle))' }}
            />
            {md.caption && <figcaption className="jy-muted mt-1.5 text-xs">{md.caption}</figcaption>}
          </figure>
        </Instant>
      ) : <Instant skip={beat.skip} onDone={beat.onDone}>{null}</Instant>;

    case 'discovery':
      return <SystemLine icon={Sparkles} tone="gold" text={b.content ?? ''} beat={beat} />;
    case 'quest_update':
      return <SystemLine icon={ScrollText} tone="gold" text={b.content ?? ''} beat={beat} />;
    case 'item_received':
      return <SystemLine icon={Package} tone="gold" text={b.content ?? ''} beat={beat} />;
    case 'codex_unlock':
      return <SystemLine icon={BookOpen} tone="forest" text={b.content ?? ''} beat={beat} />;
    case 'relationship_update':
    case 'system_message':
      return <SystemLine icon={Sparkles} tone="muted" text={b.content ?? ''} beat={beat} />;

    case 'stat_check':
      return (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <div className="jy-chip jy-chip-gold">{md.stat ?? 'Check'} {md.value ?? ''}</div>
        </Instant>
      );

    case 'combat':
      return (
        <div className="jy-panel jy-fade-in flex items-start gap-3 p-4">
          <Swords className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--jy-blood))' }} aria-hidden />
          <p className="jy-prose text-sm">
            <Typewriter text={b.content ?? ''} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
          </p>
        </div>
      );

    case 'divider':
      return (
        <Instant skip={beat.skip} onDone={beat.onDone}>
          <div className="jy-rule my-6" role="separator" />
        </Instant>
      );

    case 'transition':
      return (
        <p className="jy-muted jy-fade-in text-center text-sm italic">
          <Typewriter text={b.content ?? ''} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
        </p>
      );

    case 'narration':
    default: {
      const paras = (b.content ?? '').split(/\n{2,}/);
      return <Paragraphs paras={paras} beat={beat} />;
    }
  }
}

/** Narration: paragraphs typed in sequence. */
function Paragraphs({ paras, beat }: { paras: string[]; beat: Beat }) {
  const [index, setIndex] = useState(0);
  const paragraphKey = paras.join('\u0000');
  useEffect(() => { setIndex(0); }, [paragraphKey]);
  const shown = beat.skip ? paras.length - 1 : index;

  return (
    <div className="jy-prose jy-fade-in">
      {paras.slice(0, shown + 1).map((para, i) => (
        <p key={i}>
          <Typewriter
            text={para}
            active={beat.active && i === shown}
            skip={beat.skip || i < shown}
            onDone={() => {
              if (i < paras.length - 1) setIndex((n) => Math.max(n, i + 1));
              else beat.onDone();
            }}
          />
        </p>
      ))}
    </div>
  );
}

function SystemLine({
  icon: Icon, text, tone, beat,
}: { icon: typeof Sparkles; text: string; tone: 'gold' | 'forest' | 'muted'; beat: Beat }) {
  const color = tone === 'gold' ? 'hsl(var(--jy-gold))'
    : tone === 'forest' ? 'hsl(150 28% 62%)' : 'hsl(var(--jy-text-muted))';
  return (
    <div className="jy-fade-in flex items-center gap-2 text-sm" style={{ color }}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <Typewriter text={text} active={beat.active} skip={beat.skip} onDone={beat.onDone} />
      </span>
    </div>
  );
}
