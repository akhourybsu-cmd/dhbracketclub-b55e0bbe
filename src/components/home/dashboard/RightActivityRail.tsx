// DH Club Home — Right activity rail
//
// Four stacked sub-cards rendered in the right column on desktop
// (and stacked beneath the main feed on tablet/mobile):
//   A. Crew Activity   — recent activity log entries
//   B. Active Now      — online / recently-active members
//   C. Upcoming        — draft deadlines, RPG sessions, events
//   D. Club Stats      — Members / Active Now / Competitions counts
//
// All four are presentational — data is shaped by the parent
// HomeDashboard so this file stays free of query side-effects.

import { Link } from 'react-router-dom';
import { Users, Trophy, Activity, CalendarDays, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatDistanceToNow, format } from 'date-fns';

/* ─── Shared data shapes ────────────────────────────────────────── */

export interface CrewActivityItem {
  id: string;
  text: string;
  at: string;       // ISO
  tint: string;     // HSL triple
  icon: LucideIcon;
}

export interface ActiveMember {
  id: string;
  name: string;
  avatar_url?: string | null;
  /** true → green dot, false → muted dot (recently active) */
  online: boolean;
}

export interface UpcomingItem {
  id: string;
  label: string;
  /** ISO timestamp for the event/deadline. */
  at: string;
  /** Display category (e.g. "Draft", "RPG", "Event"). */
  kind: 'Draft' | 'RPG' | 'Event';
  tint: string;
  to?: string;
}

export interface ClubStats {
  members: number;
  activeNow: number;
  competitions: number;
}

interface Props {
  accent: string;
  crew: CrewActivityItem[];
  members: ActiveMember[];
  upcoming: UpcomingItem[];
  stats: ClubStats;
  loading?: boolean;
  /** Signed-in user — excluded from "Active now" so a solo session
   *  never reads as club activity. */
  currentUserId?: string | null;
}

/* ─── Top-level layout ─────────────────────────────────────────── */

export function RightActivityRail({
  accent, members, upcoming, stats, loading, currentUserId,
}: Props) {
  // Empty modules are hidden rather than stacked as a column of
  // "Nothing recent" panels — that made an active club look dead.
  //
  // Desktop note: the main column already renders the full "Today in the
  // Club" feed, so the rail no longer repeats Crew Activity. The rail is
  // reserved for at-a-glance context (who's around, what's next, club
  // snapshot) instead of a second copy of the same rows.
  const others = members.filter(m => m.id !== currentUserId);
  const showActive = others.length > 0;
  const showUpcoming = loading || upcoming.length > 0;

  return (
    <aside className="space-y-3" aria-label="Activity rail">
      {showActive && <ActiveNowCard members={others} accent={accent} loading={loading} />}
      {showUpcoming && <UpcomingCard items={upcoming} loading={loading} />}
      <ClubStatsCard stats={stats} accent={accent} />
    </aside>
  );
}


/* ─── Card shell ────────────────────────────────────────────────── */

function RailCard({
  title, footerHref, footerLabel, children,
}: { title: string; footerHref?: string; footerLabel?: string; children: React.ReactNode }) {
  return (
    <section
      className="home-dashboard-panel rounded-2xl overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border/25">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">
          {title}
        </p>
      </div>
      <div className="px-2 py-2">{children}</div>
      {footerHref && footerLabel && (
        <div className="px-4 py-2 border-t border-border/25 text-center">
          <Link
            to={footerHref}
            className="text-[10.5px] font-extrabold tracking-tight text-muted-foreground/75 hover:text-foreground transition-colors"
          >
            {footerLabel} →
          </Link>
        </div>
      )}
    </section>
  );
}

/* ─── A. Crew Activity ─────────────────────────────────────────── */

export function CrewActivityCard({ items, loading }: { items: CrewActivityItem[]; loading?: boolean }) {
  return (
    <RailCard title="Crew Activity" footerHref="/feed" footerLabel="View all">
      {loading && items.length === 0 ? (
        <RailSkeleton rows={3} />
      ) : items.length === 0 ? (
        <RailEmpty icon={Activity} text="Nothing recent." />
      ) : (
        <div className="space-y-0">
          {items.slice(0, 5).map(it => {
            const Icon = it.icon;
            return (
              <div key={it.id} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: `hsl(${it.tint} / 0.15)`,
                    color: `hsl(${it.tint})`,
                    border: `1px solid hsl(${it.tint} / 0.28)`,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-tight">{it.text}</p>
                  <p className="text-[10px] text-muted-foreground/55 mt-0.5 tabular-nums">
                    {formatDistanceToNow(new Date(it.at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RailCard>
  );
}

/* ─── B. Active Now ────────────────────────────────────────────── */

function ActiveNowCard({ members, accent, loading }: { members: ActiveMember[]; accent: string; loading?: boolean }) {
  const onlineCount = members.filter(m => m.online).length;

  return (
    <RailCard title="Active Now" footerHref="/members" footerLabel="View all members">
      {loading && members.length === 0 ? (
        <RailSkeleton rows={3} />
      ) : members.length === 0 ? (
        <RailEmpty icon={Users} text="No crew online right now." />
      ) : (
        <>
          <div className="px-2.5 pt-1 pb-2">
            <p className="text-[11px] font-extrabold" style={{ color: `hsl(${accent})` }}>
              {onlineCount} online · {members.length - onlineCount} recently active
            </p>
          </div>
          <div className="space-y-0.5">
            {members.slice(0, 6).map(m => (
              <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg">
                <div className="relative w-7 h-7 rounded-full overflow-hidden bg-muted/40 flex-shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-extrabold text-muted-foreground">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2"
                    style={{
                      background: m.online ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.5)',
                      '--tw-ring-color': 'hsl(var(--home-avatar-ring))',
                      boxShadow: m.online ? `0 0 6px hsl(${accent} / 0.7)` : 'none',
                    } as CSSProperties}
                  />
                </div>
                <p className="text-[12px] font-bold truncate flex-1">{m.name}</p>
                {m.online && (
                  <Circle className="w-2 h-2 flex-shrink-0" style={{ color: `hsl(${accent})`, fill: `hsl(${accent})` }} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </RailCard>
  );
}

/* ─── C. Upcoming ──────────────────────────────────────────────── */

function UpcomingCard({ items, loading }: { items: UpcomingItem[]; loading?: boolean }) {
  return (
    <RailCard title="Upcoming" footerHref="/events" footerLabel="View calendar">
      {loading && items.length === 0 ? (
        <RailSkeleton rows={3} />
      ) : items.length === 0 ? (
        <RailEmpty icon={CalendarDays} text="Nothing on the calendar." />
      ) : (
        <div className="space-y-0">
          {items.slice(0, 5).map(it => {
            const inner = (
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/20 transition-colors">
                <div
                  className="w-9 h-9 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                  style={{
                    background: `hsl(${it.tint} / 0.14)`,
                    color: `hsl(${it.tint})`,
                    border: `1px solid hsl(${it.tint} / 0.28)`,
                  }}
                >
                  <span className="text-[8.5px] uppercase font-extrabold tracking-wider leading-none">
                    {format(new Date(it.at), 'MMM')}
                  </span>
                  <span className="text-[12px] font-extrabold leading-none mt-0.5 tabular-nums">
                    {format(new Date(it.at), 'd')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold leading-tight truncate">{it.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{it.kind}</p>
                </div>
              </div>
            );
            return it.to ? (
              <Link key={it.id} to={it.to}>{inner}</Link>
            ) : (
              <div key={it.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </RailCard>
  );
}

/* ─── D. Club Stats ────────────────────────────────────────────── */

function ClubStatsCard({ stats, accent }: { stats: ClubStats; accent: string }) {
  const cells: { label: string; value: number; icon: LucideIcon; to: string }[] = [
    { label: 'Members',      value: stats.members,      icon: Users,    to: '/members' },
    { label: 'Active Now',   value: stats.activeNow,    icon: Activity, to: '/members' },
    { label: 'Competitions', value: stats.competitions, icon: Trophy,   to: '/compete' },
  ];
  return (
    <RailCard title="Club Snapshot">
      <div className="grid grid-cols-3 gap-1.5 px-1.5 py-1">
        {cells.map(c => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              aria-label={`${c.value} ${c.label}`}
              className="rounded-xl p-2.5 text-center transition hover:bg-muted/45 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              style={{
                background: 'hsl(var(--home-panel-muted) / 0.72)',
                border: '1px solid hsl(var(--home-panel-border) / 0.48)',
              }}
            >
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: `hsl(${accent})` }} />
              <p className="text-[18px] font-extrabold tabular-nums leading-none">{c.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/55 font-bold mt-1">
                {c.label}
              </p>
            </Link>
          );
        })}
      </div>
    </RailCard>
  );
}

/* ─── Shared skeleton + empty states ───────────────────────────── */

function RailSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-1 px-1 py-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-7 h-7 rounded-md skeleton-shimmer flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 w-3/4 rounded skeleton-shimmer" />
            <div className="h-2 w-1/3 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RailEmpty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="py-6 text-center">
      <Icon className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground/40" />
      <p className="text-[11px] text-muted-foreground/65 font-bold">{text}</p>
    </div>
  );
}
