import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, ArrowLeft, ChevronRight, Archive, Sparkles, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useAllSeasons, useProfilesByIds, formatSeasonTitle, type DraftSeason } from '@/hooks/useDraftSeasons';
import { cn } from '@/lib/utils';

const STATUS_PRESET: Record<string, { label: string; cls: string; live: boolean }> = {
  upcoming: { label: 'Upcoming', cls: 'da-status-setup', live: false },
  regular_season: { label: 'Active', cls: 'da-status-active', live: true },
  playoffs: { label: 'Playoffs Live', cls: 'da-status-active', live: true },
  complete: { label: 'Complete', cls: 'da-status-complete', live: false },
};

export default function SeasonsArchivePage() {
  const { seasons, loading } = useAllSeasons();

  const championIds = seasons.map(s => s.champion_user_id ?? null);
  const profileMap = useProfilesByIds(championIds);

  const active = seasons.filter(s => s.status === 'regular_season' || s.status === 'playoffs');
  const upcoming = seasons.filter(s => s.status === 'upcoming');
  const archived = seasons.filter(s => s.status === 'complete');

  return (
    <div className="pb-6 da-ledger-page">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link to="/drafts" className="da-back" aria-label="Back to Drafts">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="page-header mb-0 flex-1">
          <div className="da-page-icon">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="page-header-title dl-display">Seasons</h1>
            <p className="page-header-subtitle">Current campaign and past records</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="da-glass p-5">
              <div className="h-4 rounded-lg w-1/3 mb-2.5 da-shimmer" />
              <div className="h-3 rounded-lg w-1/2 da-shimmer" />
            </div>
          ))}
        </div>
      ) : seasons.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
          <div className="da-page-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem' }}>
            <Trophy className="w-7 h-7" />
          </div>
          <p className="empty-state-title">No seasons yet</p>
          <p className="empty-state-desc">Once a season runs, it'll appear here.</p>
        </motion.div>
      ) : (
        <div className="space-y-5">
          {(active.length > 0 || upcoming.length > 0) && (
            <Section title="Active" icon={<Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />}>
              {[...active, ...upcoming].map((s, i) => (
                <SeasonCard key={s.id} season={s} index={i} profileMap={profileMap} />
              ))}
            </Section>
          )}

          {archived.length > 0 && (
            <Section title="Archive" icon={<Archive className="w-3.5 h-3.5 text-muted-foreground/70" />}>
              {archived.map((s, i) => (
                <SeasonCard key={s.id} season={s} index={i} profileMap={profileMap} archived />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
       <div className="da-section-heading">
        {icon}
         <h2 className="dl-display text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/70">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SeasonCard({
  season,
  index,
  profileMap,
  archived = false,
}: {
  season: DraftSeason;
  index: number;
  profileMap: Map<string, { display_name: string; avatar_url: string | null }>;
  archived?: boolean;
}) {
  const st = STATUS_PRESET[season.status] || STATUS_PRESET.upcoming;
  const champion = season.champion_user_id ? profileMap.get(season.champion_user_id) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.04 }}
    >
      <Link to={`/drafts/seasons/${season.id}`} className="block group">
        <div
          className={cn(
             'da-glass da-ledger-row p-4 hover-lift cursor-pointer relative overflow-hidden',
            !archived && 'border-gold/30'
          )}
          style={
            !archived
              ? {
                   background: 'hsl(var(--card))',
                  borderLeft: '3px solid hsl(var(--gold))',
                }
              : { borderLeft: '3px solid hsl(var(--silver) / 0.45)' }
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                 <h3 className="dl-display font-extrabold text-[14px] leading-snug break-words">{formatSeasonTitle(season)}</h3>
              </div>
              {season.subtitle && (
                <p className="text-[11px] font-semibold text-muted-foreground/80 leading-snug break-words mb-1">{season.subtitle}</p>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-medium">
                <Calendar className="w-2.5 h-2.5" />
                <span>
                  {format(new Date(season.starts_at), 'MMM yyyy')} —{' '}
                  {format(new Date(season.ends_at), 'MMM yyyy')}
                </span>
              </div>
              {champion && archived && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Trophy className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
                  <span className="text-[11px] font-bold" style={{ color: 'hsl(var(--gold))' }}>
                    {champion.display_name}
                  </span>
                  <span className="text-[9px] text-muted-foreground/60 font-medium">champion</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn('flex items-center gap-1', st.cls)}>
                {st.live && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                {st.label}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-all" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
