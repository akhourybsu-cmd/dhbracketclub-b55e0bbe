// DH Club Home — Start Something launcher menu
//
// Centered popover triggered by the header's "Start Something" (or
// the compact Create) button. Offers the user a curated list of
// creation flows the club has actually enabled. Each item routes to
// the relevant page that owns the creation flow (Polls, Drafts,
// Events, Posts, Narrative campaigns, Lore).
//
// Why this lives here instead of a generic dropdown component:
//   • Filters its options by useClubAssets installation gating so
//     non-installed plugins never appear
//   • Knows the right destination per asset (some go to a `/new`
//     route, others to the asset's main page where Create lives)
//   • Uses framer-motion for a tactile entry animation

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Bookmark, CalendarDays, ScrollText, FileText, BookOpen, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Action {
  /** Asset slug used for gating. */
  slug: string;
  label: string;
  /** One-line teaser explaining what this kicks off. */
  hint: string;
  icon: LucideIcon;
  /** HSL triple — gives each action a chip color. */
  tint: string;
  /** Where to navigate when picked. */
  to: string;
}

const ACTIONS: Action[] = [
  { slug: 'polls',         label: 'Start a Poll',         hint: 'Get crew input on a quick question',          icon: MessageCircle, tint: '38 95% 60%',  to: '/polls' },
  { slug: 'draft-arena',   label: 'Run a Draft',          hint: 'Snake-draft any topic with the crew',         icon: Bookmark,      tint: '45 95% 55%',  to: '/drafts/create' },
  { slug: 'events',        label: 'Schedule an Event',    hint: 'Put it on the crew calendar',                 icon: CalendarDays,  tint: '38 100% 60%', to: '/events' },
  { slug: 'narrative-rpg', label: 'New RPG Campaign',     hint: 'Spin up a campaign or scene',                 icon: BookOpen,      tint: '270 70% 65%', to: '/narrative/new' },
  { slug: 'lore',          label: 'Add Lore',             hint: 'Capture a quote, moment, or origin story',    icon: ScrollText,    tint: '270 70% 65%', to: '/lore' },
  { slug: 'posts',         label: 'Start a Discussion',   hint: 'Drop a post for the whole crew',              icon: FileText,      tint: '195 80% 65%', to: '/posts' },
];

interface Props {
  accent: string;
  installedSlugs: Set<string>;
  onClose: () => void;
}

export function StartSomethingMenu({ accent, installedSlugs, onClose }: Props) {
  const navigate = useNavigate();
  const available = ACTIONS.filter(a => installedSlugs.has(a.slug));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      onClick={(e) => e.stopPropagation()}
      className="home-dashboard-panel relative w-full max-w-md rounded-2xl p-3.5"
      style={{
        border: `1px solid hsl(${accent} / 0.35)`,
        boxShadow: `0 24px 60px -16px hsl(${accent} / 0.45), inset 0 1px 0 hsl(${accent} / 0.18)`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-something-title"
    >
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <span id="start-something-title" className="text-[10px] font-extrabold uppercase tracking-[0.22em]" style={{ color: 'hsl(var(--home-accent-ink))' }}>
          Start Something
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close create menu"
          className="w-9 h-9 -mr-1 rounded-xl inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/55 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {available.length === 0 ? (
        <div className="text-center py-8 px-4">
          <p className="text-[13px] font-bold mb-1">No creation flows available</p>
          <p className="text-[11px] text-muted-foreground/70 leading-snug">
            Install a plugin from the Asset Library to unlock things you can start here.
          </p>
          <button
            type="button"
            onClick={() => { onClose(); navigate('/club/assets'); }}
            className="mt-3 h-9 px-3 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5"
            style={{ background: `hsl(${accent} / 0.18)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.4)` }}
          >
            Open Asset Library
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5">
          {available.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.slug}
                type="button"
                onClick={() => { onClose(); navigate(a.to); }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/35 hover:-translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                style={{
                  background: `linear-gradient(135deg, hsl(${a.tint} / 0.12), hsl(${a.tint} / 0.04))`,
                  border: `1px solid hsl(${a.tint} / 0.25)`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `hsl(${a.tint} / 0.18)`, color: `hsl(${a.tint})`, border: `1px solid hsl(${a.tint} / 0.35)` }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold leading-tight">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">{a.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
