// DH Club Home — QuickBar customization sheet
//
// Bottom sheet that lets users pin / unpin / reorder their dock apps. Two
// sections: Pinned (in user-chosen order, with reorder + remove controls)
// and Available (everything else installed for this club). Tapping an item
// in Available pins it; tapping a remove button in Pinned unpins it.
//
// Rendered through a portal so the sheet escapes any parent transform
// stacking context (PageTransition + framer-motion route wrappers) — the
// same fix applied to the Endless map sheet.

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, X, Pencil, RotateCcw } from 'lucide-react';
import {
  Bookmark, Sparkles, Shield, Target, TrendingUp, Lock, Trophy,
  MessageSquareText, CalendarDays, ScrollText, Newspaper, MessageCircle,
  BarChart3, FileText, Link2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { InstalledAsset } from '@/types/assets';
import draftEmblem from '@/assets/draft-emblem.webp';
import runedelveEmblem from '@/assets/runedelve-emblem.png';
import nexusEmblem from '@/assets/nexus-emblem.png';
import pickemEmblem from '@/assets/pickem-emblem.png';

interface RowMeta { emblem?: string; icon?: LucideIcon; tint: string; }

const META: Record<string, RowMeta> = {
  'draft-arena':    { emblem: draftEmblem,    tint: '45 95% 55%' },
  'rune-delve':     { emblem: runedelveEmblem, tint: '152 70% 55%' },
  'nexus-defense':  { emblem: nexusEmblem,    tint: '195 90% 60%' },
  'nfl-pickem':     { emblem: pickemEmblem,   tint: '0 80% 60%' },
  'portfolio-wars': { icon: TrendingUp,       tint: '152 80% 55%' },
  'brackets':       { icon: Trophy,           tint: '210 80% 60%' },
  'lockbox':        { icon: Lock,             tint: '0 80% 60%' },
  'chat':           { icon: MessageSquareText, tint: '195 80% 65%' },
  'events':         { icon: CalendarDays,     tint: '38 100% 60%' },
  'lore':           { icon: ScrollText,       tint: '270 70% 65%' },
  'feed':           { icon: Newspaper,        tint: '195 80% 65%' },
  'polls':          { icon: MessageCircle,    tint: '38 95% 60%' },
  'rankings':       { icon: BarChart3,        tint: '195 80% 60%' },
  'posts':          { icon: FileText,         tint: '195 80% 65%' },
  'shared-media':   { icon: Link2,            tint: '195 80% 65%' },
};

interface Props {
  pinned: InstalledAsset[];
  available: InstalledAsset[];
  max: number;
  accent: string;
  onPin: (slug: string) => void;
  onUnpin: (slug: string) => void;
  onMove: (slug: string, direction: 'up' | 'down') => void;
  onReset: () => void;
  onClose: () => void;
}

export function QuickBarSheet({
  pinned, available, max, accent,
  onPin, onUnpin, onMove, onReset, onClose,
}: Props) {
  if (typeof document === 'undefined') return null;
  const atMax = pinned.length >= max;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-t-2xl"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--background)))',
          border: `1px solid hsl(${accent} / 0.32)`,
          boxShadow: `0 -10px 30px -8px hsl(${accent} / 0.32)`,
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Sticky header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
            borderColor: `hsl(${accent} / 0.22)`,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pencil className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] truncate" style={{ color: `hsl(${accent})` }}>
              Customize Quick Bar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // Mobile: 40×40 (close to HIG 44 without dominating the
            // sheet header). Desktop: original w-8 h-8 (32×32).
            className="w-10 h-10 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.4)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <p className="text-[11px] text-foreground/65 leading-snug">
            Tap an app below to pin it. Drag-handle reorder uses the arrows on the right. Pinned apps appear in the dock at the top of Home.
          </p>
        </div>

        {/* Pinned section */}
        <section className="px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">
              Pinned · {pinned.length}/{max}
            </p>
            {pinned.length > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="text-[9.5px] font-bold inline-flex items-center gap-1 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            )}
          </div>
          {pinned.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/55 italic py-3 text-center">
              No apps pinned yet — tap any installed app below to add it.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {pinned.map((ia, idx) => (
                <Row
                  key={ia.id}
                  asset={ia}
                  variant="pinned"
                  isFirst={idx === 0}
                  isLast={idx === pinned.length - 1}
                  onAction={() => onUnpin(ia.asset.slug)}
                  onMoveUp={() => onMove(ia.asset.slug, 'up')}
                  onMoveDown={() => onMove(ia.asset.slug, 'down')}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Available section */}
        <section className="px-4 pt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">
              Available · {available.length}
            </p>
            {atMax && (
              <span className="text-[9.5px] font-bold text-foreground/50">Quick Bar full</span>
            )}
          </div>
          {available.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/55 italic py-3 text-center">
              All installed apps are already pinned.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {available.map(ia => (
                <Row
                  key={ia.id}
                  asset={ia}
                  variant={atMax ? 'disabled' : 'available'}
                  onAction={atMax ? undefined : () => onPin(ia.asset.slug)}
                />
              ))}
            </ul>
          )}
        </section>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function Row({
  asset,
  variant,
  isFirst,
  isLast,
  onAction,
  onMoveUp,
  onMoveDown,
}: {
  asset: InstalledAsset;
  variant: 'pinned' | 'available' | 'disabled';
  isFirst?: boolean;
  isLast?: boolean;
  onAction?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const slug = asset.asset.slug;
  const meta = META[slug];
  const Icon = meta?.icon;
  const tint = meta?.tint ?? '195 80% 65%';

  return (
    <li
      className="rounded-xl flex items-center gap-3 px-2.5 py-2"
      style={{
        background: variant === 'disabled' ? 'hsl(var(--muted) / 0.18)' : 'hsl(var(--card) / 0.85)',
        border: `1px solid hsl(${tint} / ${variant === 'disabled' ? '0.12' : '0.24'})`,
        opacity: variant === 'disabled' ? 0.55 : 1,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${tint} / 0.18), hsl(${tint} / 0.04))`,
          border: `1px solid hsl(${tint} / 0.28)`,
          color: `hsl(${tint})`,
        }}
      >
        {meta?.emblem ? (
          <img src={meta.emblem} alt="" aria-hidden="true" className="w-6 h-6 object-contain" />
        ) : Icon ? (
          <Icon className="w-4 h-4" />
        ) : (
          <Bookmark className="w-4 h-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold truncate leading-tight">{asset.asset.name}</p>
        {asset.asset.short_description && (
          <p className="text-[10px] text-muted-foreground/65 truncate leading-tight">
            {asset.asset.short_description}
          </p>
        )}
      </div>

      {/* Controls */}
      {variant === 'pinned' && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-10 h-10 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.35)', color: 'hsl(var(--foreground))' }}
            aria-label={`Move ${asset.asset.name} up`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-10 h-10 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.35)', color: 'hsl(var(--foreground))' }}
            aria-label={`Move ${asset.asset.name} down`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onAction}
            className="w-10 h-10 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center active:scale-90 transition"
            style={{
              background: 'hsl(var(--destructive) / 0.16)',
              color: 'hsl(var(--destructive))',
              border: '1px solid hsl(var(--destructive) / 0.3)',
            }}
            aria-label={`Unpin ${asset.asset.name}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {variant === 'available' && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-3 h-8 rounded-lg text-[10px] font-extrabold uppercase tracking-[0.18em] flex-shrink-0 inline-flex items-center gap-1 active:scale-95 transition"
          style={{
            background: `hsl(${tint} / 0.16)`,
            color: `hsl(${tint})`,
            border: `1px solid hsl(${tint} / 0.32)`,
          }}
        >
          <Plus className="w-3 h-3" /> Pin
        </button>
      )}
      {variant === 'disabled' && (
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground/45 flex-shrink-0 px-2">
          Full
        </span>
      )}
    </li>
  );
}
