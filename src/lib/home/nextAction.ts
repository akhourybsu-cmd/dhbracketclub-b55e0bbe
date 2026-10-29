// DH Club — Home next-action ranker
//
// Pure function that takes the user's current state across the club and
// returns a ranked list of "what should I tap next" actions. The Home screen
// shows the top action prominently and may offer expanding access to the
// rest. Adding a new action source is just: add a builder, append to the
// returned array, sort.
//
// Priority guide (higher = more urgent):
//   100   You are blocking a draft turn / a bracket lock is imminent
//    90   A live operation/match needs you
//    80   A daily/weekly engagement window is open (Pick'em, Lockbox)
//    70   A season transition is pending (playoffs starting, season ending)
//    60   A club admin task needs attention
//    50   Generic catch-up (unread feed activity, fresh content)
//    -1   Filtered out
//
// All inputs are optional — missing data sources just contribute nothing.
// The ranker doesn't fetch; callers pass whatever they have.

import type { LucideIcon } from 'lucide-react';
import { Bookmark, Trophy, Lock, Users, Sparkles, Calendar, MessageCircle, Shield, Swords, Target } from 'lucide-react';

export interface NextAction {
  /** Stable id for keying / dedupe. */
  id: string;
  /** Numeric priority — see header. */
  priority: number;
  /** Headline shown bold in the card. */
  label: string;
  /** Optional sub-line shown beneath. */
  sub?: string;
  /** Route to navigate to. */
  to: string;
  /** Lucide icon used in the small icon chip. */
  icon: LucideIcon;
  /** Color token (`'gold'`, `'primary'`, `'destructive'`, etc.) — feeds into the card's accent. */
  accent: 'gold' | 'primary' | 'destructive' | 'success' | 'lore' | 'accent' | 'warning';
  /** Asset slug this action is sourced from (used to drop the action when its asset isn't installed). */
  assetSlug?: string;
  /** Short callsign — e.g. "DRAFT", "PICK'EM" — shown as a tag chip. */
  tag?: string;
}

interface DraftLite {
  id: string;
  topic: string;
  status: string;
  current_pick_user_id?: string | null;
}

interface SeasonLite {
  id: string;
  name: string;
  status: string;
}

interface PoolLite {
  id: string;
  name: string;
  lock_time: string;
  bracket_status: string;
}

interface PickemLite {
  weekLabel: string;
  totalGames: number;
  picksMade: number;
  weekIsLive: boolean;
}

interface OperationLite {
  id: string;
  name: string;
  current_phase: number;
  status: string;
}

interface AdminTaskLite {
  /** Free-text label, e.g. "3 club requests pending". */
  label: string;
  to: string;
}

interface UnreadChannelLite {
  id: string;
  name: string;
}

export interface RankInput {
  userId: string | undefined;
  /** Slugs of assets installed for this club. */
  installedSlugs: Set<string>;
  drafts?: DraftLite[];
  season?: SeasonLite | null;
  draftsRemaining?: number;
  pools?: PoolLite[];
  pickem?: PickemLite | null;
  operation?: OperationLite | null;
  endlessSavedRun?: { missionName: string; waveLabel: string } | null;
  adminTasks?: AdminTaskLite[];
  isClubAdmin?: boolean;
  /** Channels where this user has unread messages AND notifications
   *  are not muted. Drives the "New chat in #X" home surface. */
  unreadChannels?: UnreadChannelLite[];
}

export function rankNextActions(input: RankInput): NextAction[] {
  const out: NextAction[] = [];
  const has = (slug: string) => input.installedSlugs.has(slug);

  // ── Draft Arena ──────────────────────────────────────────────────
  if (has('draft-arena')) {
    // Your turn in any draft — the highest-priority signal in the app.
    const yourTurn = (input.drafts ?? []).filter(
      d => d.status === 'in_progress' && d.current_pick_user_id === input.userId,
    );
    yourTurn.forEach(d => {
      out.push({
        id: `turn-${d.id}`,
        priority: 100,
        label: 'Your draft pick is up',
        sub: d.topic,
        to: `/drafts/${d.id}`,
        icon: Bookmark,
        accent: 'gold',
        assetSlug: 'draft-arena',
        tag: 'DRAFT',
      });
    });

    // Season transitions — playoffs live, or last few drafts of regular season.
    if (input.season) {
      if (input.season.status === 'playoffs') {
        out.push({
          id: 'playoffs-live',
          priority: 75,
          label: 'Playoffs are live',
          sub: input.season.name,
          to: '/drafts?tab=season',
          icon: Trophy,
          accent: 'gold',
          assetSlug: 'draft-arena',
          tag: 'SEASON',
        });
      } else if ((input.draftsRemaining ?? 0) > 0 && (input.draftsRemaining ?? 0) <= 2) {
        const n = input.draftsRemaining!;
        out.push({
          id: 'season-ending',
          priority: 70,
          label: `Season ends in ${n} draft${n === 1 ? '' : 's'}`,
          sub: input.season.name,
          to: '/drafts?tab=season',
          icon: Swords,
          accent: 'gold',
          assetSlug: 'draft-arena',
          tag: 'SEASON',
        });
      }
    }
  }

  // ── Brackets ─────────────────────────────────────────────────────
  if (has('brackets') && input.pools?.length) {
    for (const p of input.pools) {
      const lock = new Date(p.lock_time).getTime();
      const now = Date.now();
      const hoursToLock = (lock - now) / (1000 * 60 * 60);
      if (p.bracket_status === 'incomplete' && hoursToLock > 0 && hoursToLock <= 48) {
        out.push({
          id: `bracket-${p.id}`,
          priority: hoursToLock <= 6 ? 95 : 85,
          label: 'Finish your bracket',
          sub: `${p.name} · locks ${hoursToLock <= 1 ? 'this hour' : `in ${Math.ceil(hoursToLock)}h`}`,
          to: `/pools/${p.id}`,
          icon: Lock,
          accent: 'destructive',
          assetSlug: 'brackets',
          tag: 'BRACKET',
        });
      }
    }
  }

  // ── NFL Pick'em ──────────────────────────────────────────────────
  if (has('nfl-pickem') && input.pickem && input.pickem.weekIsLive) {
    const remaining = Math.max(0, input.pickem.totalGames - input.pickem.picksMade);
    if (remaining > 0) {
      out.push({
        id: 'pickem-open',
        priority: 80,
        label: input.pickem.picksMade === 0 ? 'Make your NFL picks' : `${remaining} pick${remaining === 1 ? '' : 's'} left`,
        sub: input.pickem.weekLabel,
        to: '/pickem',
        icon: Target,
        accent: 'destructive',
        assetSlug: 'nfl-pickem',
        tag: "PICK'EM",
      });
    }
  }

  // ── Co-op Operation ──────────────────────────────────────────────
  if (has('nexus-defense') && input.operation && input.operation.status === 'active') {
    out.push({
      id: `op-${input.operation.id}`,
      priority: 90,
      label: `Push the operation · Phase ${input.operation.current_phase}`,
      sub: input.operation.name,
      to: '/nexus/operation',
      icon: Users,
      accent: 'lore',
      assetSlug: 'nexus-defense',
      tag: 'CO-OP',
    });
  }

  // ── Resumable Endless run ────────────────────────────────────────
  if (has('nexus-defense') && input.endlessSavedRun) {
    out.push({
      id: 'endless-resume',
      priority: 65,
      label: 'Resume your run',
      sub: `${input.endlessSavedRun.missionName} · ${input.endlessSavedRun.waveLabel}`,
      to: '/nexus/battle/endless',
      icon: Sparkles,
      accent: 'warning',
      assetSlug: 'nexus-defense',
      tag: 'ENDLESS',
    });
  }

  // ── Chat: unread channels ────────────────────────────────────────
  // Engagement-tier signal (above generic feed catch-up at 50,
  // below all blocking actions, daily windows, and season events).
  // Only emitted when the user has the chat asset installed AND has
  // unread messages in at least one non-muted channel.
  if (has('chat') && input.unreadChannels && input.unreadChannels.length > 0) {
    const channels = input.unreadChannels;
    const single = channels.length === 1;
    out.push({
      id: 'chat-unread',
      priority: 55,
      label: single
        ? `New chat in #${channels[0].name}`
        : `New chats in ${channels.length} channels`,
      sub: single
        ? 'Tap to read'
        // Multi-channel summary — list up to the first three channel
        // names so users can decide whether the unread is somewhere
        // they actually care about.
        : channels.slice(0, 3).map(c => `#${c.name}`).join(' · ')
          + (channels.length > 3 ? ` +${channels.length - 3} more` : ''),
      to: '/chat',
      icon: MessageCircle,
      accent: 'accent',
      assetSlug: 'chat',
      tag: 'CHAT',
    });
  }

  // ── Admin tasks (only when user is a club admin) ─────────────────
  if (input.isClubAdmin && input.adminTasks?.length) {
    input.adminTasks.forEach((task, i) => {
      out.push({
        id: `admin-${i}`,
        priority: 60,
        label: task.label,
        sub: 'Admin · tap to resolve',
        to: task.to,
        icon: Shield,
        accent: 'gold',
        tag: 'ADMIN',
      });
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
