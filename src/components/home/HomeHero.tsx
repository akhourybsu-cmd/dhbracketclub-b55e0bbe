// DH Club Home — Identity Header
//
// Ambient header that anchors the home screen. Larger breathing room
// than the old strip, no border, gradient glow keyed to the club's
// accent color so each club's home looks distinct.

import dhMonogram from '@/assets/dh-monogram.png';
import type { Club } from '@/contexts/ClubContext';

interface Props {
  club: Club | null;
  displayName: string;
  avatarUrl: string | null;
  /** Number of "Right Now" actions awaiting the user. Drives the avatar notification dot. */
  pendingCount: number;
  now?: Date;
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function greetingFor(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Late night';
}

export function HomeHero({ club, displayName, pendingCount, now = new Date() }: Props) {
  const accent = club?.accent_color ?? '152 72% 46%';
  const weekday = WEEKDAY[now.getDay()];
  const firstName = displayName?.split(' ')[0];
  const greeting = greetingFor(now.getHours());

  return (
    <header className="relative pt-1 pb-4 mb-1">
      {/* Ambient accent glow keyed to club color — kept as the premium
          signature, but slimmer so the primary action below dominates. */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-16 h-44 pointer-events-none -z-10"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 50% 0%, hsl(${accent} / 0.22), transparent 72%)`,
        }}
      />

      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{
            background: club?.logo_url ? 'transparent' : `linear-gradient(135deg, hsl(${accent} / 0.24), hsl(${accent} / 0.06))`,
            border: `1px solid hsl(${accent} / 0.30)`,
            boxShadow: `0 0 14px -5px hsl(${accent} / 0.5)`,
          }}
        >
          {club?.logo_url ? (
            <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <img src={dhMonogram} alt={club?.name ?? 'DH'} className="w-7 h-7 object-contain opacity-90" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold tracking-[-0.02em] truncate leading-tight">
            {club?.name ?? 'DH Club'}
          </h1>
          <p className="text-[12.5px] font-medium text-muted-foreground leading-tight truncate mt-0.5">
            {weekday} · {greeting}{firstName ? `, ${firstName}` : ''}
          </p>
        </div>

        {pendingCount > 0 && (
          <span
            className="flex-shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold tabular-nums"
            style={{
              background: `hsl(${accent} / 0.13)`,
              border: `1px solid hsl(${accent} / 0.24)`,
              color: `hsl(${accent})`,
            }}
          >
            {pendingCount} now
          </span>
        )}
      </div>
    </header>
  );
}
