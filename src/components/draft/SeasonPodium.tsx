import { motion } from 'framer-motion';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

type Profile = { display_name: string; avatar_url: string | null };

interface Props {
  champion?: Profile | null;
  runnerUp?: Profile | null;
  thirdPlace?: Profile | null;
  seasonName?: string;
  compact?: boolean;
}

/** Mobile-first commemorative podium for a finalized Draft Season. */
export function SeasonPodium({ champion, runnerUp, thirdPlace, seasonName, compact = false }: Props) {
  if (!champion && !runnerUp && !thirdPlace) return null;

  const Avatar = ({ p, size }: { p?: Profile | null; size: number }) => {
    const initial = (p?.display_name || '?').charAt(0).toUpperCase();
    return (
      <div
        className="rounded-full flex items-center justify-center font-extrabold overflow-hidden"
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.25), hsl(var(--gold) / 0.05))',
          border: '1.5px solid hsl(var(--gold) / 0.35)',
          fontSize: size * 0.42,
          color: 'hsl(var(--gold))',
        }}
      >
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl overflow-hidden"
    >
      {/* Gold halo background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(var(--gold) / 0.18), transparent 70%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card)/0.6))',
        }}
      />
      <div
        className="relative da-glass border-gold/15 p-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            <h3 className="font-extrabold text-[13px] tracking-tight">Season Podium</h3>
          </div>
          {seasonName && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {seasonName}
            </span>
          )}
        </div>

        {/* Podium row — 2 / 1 / 3 visual order */}
        <div className="flex items-end justify-between gap-2 mb-2">
          {/* Runner-up (left, medium) */}
          <PodiumColumn
            place={2}
            profile={runnerUp}
            heightCls="h-14"
            iconColor="hsl(0 0% 75%)"
            label="Runner-up"
            avatarSize={compact ? 44 : 52}
            Avatar={Avatar}
          />
          {/* Champion (center, tallest) */}
          <PodiumColumn
            place={1}
            profile={champion}
            heightCls="h-20"
            iconColor="hsl(var(--gold))"
            label="Champion"
            avatarSize={compact ? 56 : 68}
            Avatar={Avatar}
            highlight
          />
          {/* Third place (right, shortest) */}
          <PodiumColumn
            place={3}
            profile={thirdPlace}
            heightCls="h-10"
            iconColor="hsl(28 65% 55%)"
            label="3rd Place"
            avatarSize={compact ? 40 : 48}
            Avatar={Avatar}
          />
        </div>
      </div>
    </motion.div>
  );
}

function PodiumColumn({
  place,
  profile,
  heightCls,
  iconColor,
  label,
  avatarSize,
  highlight = false,
  Avatar,
}: {
  place: number;
  profile?: Profile | null;
  heightCls: string;
  iconColor: string;
  label: string;
  avatarSize: number;
  highlight?: boolean;
  Avatar: React.FC<{ p?: Profile | null; size: number }>;
}) {
  const Icon = place === 1 ? Trophy : place === 2 ? Medal : Award;
  return (
    <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
      <Avatar p={profile} size={avatarSize} />
      <p className="text-[11px] font-extrabold truncate max-w-full text-center" style={{ color: highlight ? 'hsl(var(--gold))' : undefined }}>
        {profile?.display_name || '—'}
      </p>
      <div
        className={cn('w-full rounded-t-md flex items-center justify-center gap-1', heightCls)}
        style={{
          background: highlight
            ? 'linear-gradient(180deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))'
            : 'linear-gradient(180deg, hsl(var(--muted) / 0.6), hsl(var(--muted) / 0.2))',
          borderTop: highlight ? '1.5px solid hsl(var(--gold) / 0.4)' : '1px solid hsl(var(--border))',
        }}
      >
        <Icon className="w-3 h-3" style={{ color: iconColor }} />
        <span className="text-[9px] font-bold tracking-wide" style={{ color: highlight ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}>
          {label}
        </span>
      </div>
    </div>
  );
}
