// Birthdays & Milestones — Full Celebrations page
//
// Mobile-first list view organized by Today / Upcoming / Birthdays /
// Milestones / Past tabs. Members can add their own birthday; admins
// (or members if settings allow) can add milestones. Hidden assets
// don't reach this page because RLS filters them server-side.

import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Cake, Sparkles, PartyPopper, CalendarHeart,
  ChevronRight, Pencil as Edit, Crown, EyeOff, Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import {
  useClubBirthdays, useClubMilestones, useUpcomingCelebrations,
  useTodayCelebrations, useMyBirthday, useCelebrationSettings,
  partitionMilestonesByTime, type ClubMilestone, type UpcomingCelebration,
} from '@/hooks/useCelebrations';
import {
  formatMonthDay, formatFullDate, formatRelativeUpcoming,
  computeAge, nextOccurrenceOf, daysUntil,
} from '@/lib/celebrations/dates';
import { AddBirthdayModal } from '@/components/celebrations/AddBirthdayModal';
import { AddMilestoneModal } from '@/components/celebrations/AddMilestoneModal';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'birthdays' | 'milestones' | 'past';

const ACCENT = '14 90% 60%'; // celebratory coral — matches the Home widget

export default function CelebrationsPage() {
  const { user } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { isInstalled, loading: assetsLoading } = useClubAssets();
  const installed = isInstalled('birthdays-milestones');

  const { settings, loading: settingsLoading } = useCelebrationSettings();
  const { birthday: myBirthday } = useMyBirthday();
  const { birthdays } = useClubBirthdays();
  const { milestones } = useClubMilestones();
  const { upcoming } = useUpcomingCelebrations(50);
  const { today } = useTodayCelebrations();

  const [tab, setTab] = useState<Tab>('all');
  const [bdayOpen, setBdayOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ClubMilestone | null>(null);

  // ─── Guards
  if (!assetsLoading && !installed) {
    return <Navigate to="/dashboard" replace />;
  }

  const allowAddBirthday = settings?.allow_members_to_add_birthdays !== false;
  const allowAddMilestone = isClubAdmin || (settings?.allow_members_to_create_milestones === true);

  // ─── Derived lists
  const { past } = partitionMilestonesByTime(milestones);
  const futureOrTodayUpcoming = upcoming.filter(c => c.daysAway >= 0);

  return (
    <div className="member-page lg:max-w-5xl lg:mx-auto" aria-busy={assetsLoading || settingsLoading}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header"
      >
        <div
          className="page-header-icon"
          style={{
            background: `linear-gradient(135deg, hsl(${ACCENT} / 0.22), hsl(${ACCENT} / 0.06))`,
            border: `1px solid hsl(${ACCENT} / 0.32)`,
            color: `hsl(${ACCENT})`,
          }}
        >
          <PartyPopper className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="page-header-title">Celebrations</h1>
          <p className="page-header-subtitle">
            Birthdays & milestones for {club?.name ?? 'your club'}
          </p>
        </div>
      </motion.div>

      {/* Add buttons */}
      <div className="flex gap-2 mb-4">
        {allowAddBirthday && (
          <button
            type="button"
            onClick={() => setBdayOpen(true)}
            className="flex-1 min-h-11 rounded-xl px-3 text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            style={{
              background: `linear-gradient(135deg, hsl(${ACCENT}), hsl(${ACCENT} / 0.85))`,
              color: 'hsl(218 50% 6%)',
              boxShadow: `0 4px 14px -4px hsl(${ACCENT} / 0.5)`,
            }}
          >
            <Cake className="w-3.5 h-3.5" /> {myBirthday ? 'Edit My Birthday' : 'Add My Birthday'}
          </button>
        )}
        {allowAddMilestone && (
          <button
            type="button"
            onClick={() => { setEditingMilestone(null); setMilestoneOpen(true); }}
            className="flex-1 min-h-11 rounded-xl px-3 text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
            style={{
              background: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border) / 0.4)',
              color: 'hsl(var(--foreground) / 0.85)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Add Milestone
          </button>
        )}
      </div>

      {/* Today */}
      {today.length > 0 && (
        <section className="mb-5">
          <SectionHeader icon={<PartyPopper className="w-3 h-3" />} label="Today" />
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {today.map(c => <TodayRow key={`${c.kind}-${c.id}`} celebration={c} />)}
          </div>
        </section>
      )}

      {/* Tab strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 mb-4 scrollbar-none" role="tablist" aria-label="Celebration filters">
        {([
          { id: 'all',        label: 'Upcoming', count: futureOrTodayUpcoming.length },
          { id: 'birthdays',  label: 'Birthdays', count: birthdays.length },
          { id: 'milestones', label: 'Milestones', count: milestones.length },
          { id: 'past',       label: 'Past',      count: past.length },
        ] as { id: Tab; label: string; count: number }[]).map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-shrink-0 px-3.5 min-h-11 rounded-xl text-[11px] font-bold flex items-center gap-1 transition',
              )}
              style={
                active
                  ? {
                      background: `linear-gradient(135deg, hsl(${ACCENT}), hsl(${ACCENT} / 0.85))`,
                      color: 'hsl(218 50% 6%)',
                    }
                  : {
                      background: 'hsl(var(--muted) / 0.4)',
                      border: '1px solid hsl(var(--border) / 0.3)',
                      color: 'hsl(var(--foreground) / 0.7)',
                    }
              }
            >
              {t.label}
              <span
                className="text-[9px] font-extrabold px-1 py-0.5 rounded-full min-w-[16px] text-center"
                style={{
                  background: active ? 'hsl(218 50% 6% / 0.18)' : 'hsl(var(--muted) / 0.6)',
                  color: active ? 'hsl(218 50% 6%)' : undefined,
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'all' && (
        <UpcomingList items={futureOrTodayUpcoming} />
      )}
      {tab === 'birthdays' && (
        <BirthdaysList
          birthdays={birthdays}
          myBirthday={myBirthday}
          isAdmin={isClubAdmin}
        />
      )}
      {tab === 'milestones' && (
        <MilestonesList
          milestones={milestones}
          isAdmin={isClubAdmin}
          myUserId={user?.id}
          onEdit={m => { setEditingMilestone(m); setMilestoneOpen(true); }}
        />
      )}
      {tab === 'past' && <PastList milestones={past} />}

      <AddBirthdayModal open={bdayOpen} onClose={() => setBdayOpen(false)} accent={ACCENT} />
      <AddMilestoneModal
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        editing={editingMilestone}
        isAdmin={isClubAdmin}
        accent={ACCENT}
      />
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────── */

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span style={{ color: `hsl(${ACCENT})` }}>{icon}</span>
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${ACCENT})` }}>
        {label}
      </p>
    </div>
  );
}

function TodayRow({ celebration }: { celebration: UpcomingCelebration }) {
  const isBirthday = celebration.kind === 'birthday';
  const title = isBirthday
    ? `Happy birthday, ${celebration.title}!`
    : `Toast — ${celebration.title}`;
  const composerHref = (() => {
    const params = new URLSearchParams({
      title: isBirthday ? `Happy birthday, ${celebration.title}!` : `Celebrating: ${celebration.title}`,
      body:  isBirthday ? `From everyone in the club. 🎉` : (celebration.subline ?? ''),
    });
    return `/posts/create?${params.toString()}`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-3.5 flex items-center gap-3"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 100% 0%, hsl(${ACCENT} / 0.18), transparent 70%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))`,
        border: `1px solid hsl(${ACCENT} / 0.42)`,
        boxShadow: `0 0 18px -8px hsl(${ACCENT} / 0.45)`,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${ACCENT} / 0.24), hsl(${ACCENT} / 0.06))`,
          border: `1px solid hsl(${ACCENT} / 0.32)`,
          color: `hsl(${ACCENT})`,
        }}
      >
        {isBirthday ? <Cake className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold leading-tight">{title}</p>
        <p className="text-[10.5px] text-muted-foreground/75 leading-snug truncate">
          {isBirthday ? celebration.subline : (celebration.subline ?? 'A club milestone')}
        </p>
      </div>
      <Link
        to={composerHref}
        className="h-11 px-3 rounded-xl text-[11px] font-extrabold flex items-center gap-1 active:scale-[0.98] transition flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, hsl(${ACCENT}), hsl(${ACCENT} / 0.85))`,
          color: 'hsl(218 50% 6%)',
        }}
      >
        {isBirthday ? 'Wish' : 'Toast'} <ChevronRight className="w-3 h-3" strokeWidth={3} />
      </Link>
    </motion.div>
  );
}

function UpcomingList({ items }: { items: UpcomingCelebration[] }) {
  if (items.length === 0) {
    return <EmptyBlock label="Nothing on the horizon — add a birthday or milestone above." />;
  }
  return (
    <ul className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {items.map((c, idx) => {
        const isBirthday = c.kind === 'birthday';
        return (
          <li
            key={`${c.kind}-${c.id}-${idx}`}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
              border: `1px solid hsl(${ACCENT} / 0.20)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${ACCENT} / 0.18), hsl(${ACCENT} / 0.04))`,
                border: `1px solid hsl(${ACCENT} / 0.26)`,
                color: `hsl(${ACCENT})`,
              }}
            >
              {isBirthday ? <Cake className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold leading-tight truncate">{c.title}</p>
              <p className="text-[10.5px] text-muted-foreground/70 leading-snug truncate">
                {isBirthday ? 'Birthday · ' : 'Milestone · '}{c.subline}
              </p>
            </div>
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums"
              style={{
                background: c.daysAway <= 7 ? `hsl(${ACCENT} / 0.16)` : 'hsl(var(--muted) / 0.45)',
                color: c.daysAway <= 7 ? `hsl(${ACCENT})` : 'hsl(var(--muted-foreground))',
                border: c.daysAway <= 7 ? `1px solid hsl(${ACCENT} / 0.32)` : '1px solid hsl(var(--border) / 0.3)',
              }}
            >
              {formatRelativeUpcoming(c.nextDate)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function BirthdaysList({
  birthdays, myBirthday, isAdmin,
}: {
  birthdays: ReturnType<typeof useClubBirthdays>['birthdays'];
  myBirthday: ReturnType<typeof useMyBirthday>['birthday'];
  isAdmin: boolean;
}) {
  if (birthdays.length === 0) {
    return <EmptyBlock label="No birthdays added yet." />;
  }
  // Sort by month/day so January is first.
  const sorted = [...birthdays].sort((a, b) =>
    a.birth_month !== b.birth_month ? a.birth_month - b.birth_month : a.birth_day - b.birth_day,
  );

  return (
    <ul className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {sorted.map(b => {
        const age = b.show_age ? computeAge(b.birth_year, b.birth_month, b.birth_day) : null;
        const isMine = myBirthday?.id === b.id;
        const next = nextOccurrenceOf(b.birth_month, b.birth_day);
        const daysAway = daysUntil(next);
        return (
          <li
            key={b.id}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
              border: `1px solid hsl(${ACCENT} / 0.20)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${ACCENT} / 0.18), hsl(${ACCENT} / 0.04))`,
                border: `1px solid hsl(${ACCENT} / 0.26)`,
                color: `hsl(${ACCENT})`,
              }}
            >
              <Cake className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold leading-tight truncate">
                {b.profile?.display_name ?? 'A member'}{isMine && ' · you'}{age !== null && ` · ${age}`}
              </p>
              <p className="text-[10.5px] text-muted-foreground/70 leading-snug truncate flex items-center gap-1">
                {formatMonthDay(b.birth_month, b.birth_day)}
                {b.visibility === 'admins_only' && (
                  <span className="inline-flex items-center gap-0.5 text-amber-500/80">
                    <Lock className="w-2.5 h-2.5" /> Admins
                  </span>
                )}
              </p>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums"
              style={{
                background: daysAway <= 7 ? `hsl(${ACCENT} / 0.16)` : 'hsl(var(--muted) / 0.45)',
                color: daysAway <= 7 ? `hsl(${ACCENT})` : 'hsl(var(--muted-foreground))',
                border: daysAway <= 7 ? `1px solid hsl(${ACCENT} / 0.32)` : '1px solid hsl(var(--border) / 0.3)',
              }}
            >
              {formatRelativeUpcoming(next)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MilestonesList({
  milestones, isAdmin, myUserId, onEdit,
}: {
  milestones: ClubMilestone[];
  isAdmin: boolean;
  myUserId: string | undefined;
  onEdit: (m: ClubMilestone) => void;
}) {
  if (milestones.length === 0) {
    return <EmptyBlock label="No milestones yet." />;
  }
  const sorted = [...milestones].sort((a, b) => a.milestone_date.localeCompare(b.milestone_date));
  return (
    <ul className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {sorted.map(m => {
        const canEdit = isAdmin || m.created_by === myUserId;
        return (
          <li
            key={m.id}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
              border: `1px solid hsl(${ACCENT} / 0.20)`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                background: `linear-gradient(135deg, hsl(${ACCENT} / 0.18), hsl(${ACCENT} / 0.04))`,
                border: `1px solid hsl(${ACCENT} / 0.26)`,
                color: `hsl(${ACCENT})`,
              }}
            >
              {m.type === 'club_anniversary' ? <PartyPopper className="w-4 h-4" /> :
               m.type === 'achievement'      ? <Crown className="w-4 h-4" /> :
               <Sparkles className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-bold leading-tight">{m.title}</p>
              {m.description && (
                <p className="text-[10.5px] text-muted-foreground/70 leading-snug mt-0.5 line-clamp-2">
                  {m.description}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                {formatFullDate(m.milestone_date)}
                {m.recurrence === 'yearly' && (
                  <span className="font-extrabold uppercase tracking-[0.12em]" style={{ color: `hsl(${ACCENT} / 0.8)` }}>
                    · Yearly
                  </span>
                )}
                {m.visibility === 'admins_only' && (
                  <span className="inline-flex items-center gap-0.5 text-amber-500/80">
                    <Lock className="w-2.5 h-2.5" /> Admins
                  </span>
                )}
                {m.visibility === 'hidden' && (
                  <span className="inline-flex items-center gap-0.5 text-muted-foreground/70">
                    <EyeOff className="w-2.5 h-2.5" /> Hidden
                  </span>
                )}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(m)}
                aria-label="Edit milestone"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground/65 hover:text-foreground active:scale-90 transition flex-shrink-0"
                style={{ background: 'hsl(var(--muted) / 0.35)' }}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PastList({ milestones }: { milestones: ClubMilestone[] }) {
  if (milestones.length === 0) {
    return <EmptyBlock label="No past milestones yet." />;
  }
  const sorted = [...milestones].sort((a, b) => b.milestone_date.localeCompare(a.milestone_date));
  return (
    <ul className="space-y-1.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {sorted.map(m => (
        <li
          key={m.id}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl opacity-80"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--card) / 0.7), hsl(var(--card) / 0.55))',
            border: '1px solid hsl(var(--border) / 0.3)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--muted-foreground))' }}
          >
            <CalendarHeart className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold leading-tight truncate">{m.title}</p>
            <p className="text-[10.5px] text-muted-foreground/60 leading-snug">{formatFullDate(m.milestone_date)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{
        background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))',
        border: '1px dashed hsl(var(--border) / 0.5)',
      }}
    >
      <p className="text-[12px] text-muted-foreground/70">{label}</p>
    </div>
  );
}
