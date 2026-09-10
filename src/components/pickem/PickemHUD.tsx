import { useState } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import pickemEmblem from '@/assets/pickem-emblem.png';
import { useActiveSeason, useCurrentWeek } from '@/hooks/usePickem';
import { PickemExitDialog } from './PickemExitDialog';

/**
 * Sticky in-game HUD for the NFL Game Center standalone shell.
 * Replaces the DH Club page header throughout /nfl/* and legacy /pickem/*.
 * Mirrors the Nexus / RuneDelve HUD pattern.
 */
export function PickemHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ weekNumber?: string }>();
  const { season } = useActiveSeason();
  const { week } = useCurrentWeek(season);
  const [exitOpen, setExitOpen] = useState(false);

  const path = location.pathname;
  const isHub = path === '/nfl';
  const isChain = path.startsWith('/nfl/crazy-chain');
  const isStandings = path.startsWith('/pickem/standings') || path === '/nfl/crazy-chain/leaderboard';

  // Contextual subtitle per route
  const subtitle = (() => {
    const p = path;
    if (p === '/nfl') return 'Scores · Pick’em · Crazy Chain';
    if (p === '/nfl/crazy-chain') return 'Build Your Weekly Run';
    if (p === '/nfl/crazy-chain/leaderboard') return 'Chain Leaders';
    if (p === '/nfl/crazy-chain/history') return 'Your Chain History';
    if (p.startsWith('/nfl/admin/crazy-chain')) return 'Crazy Chain · Commissioner';
    if (p === '/pickem') return 'Weekly Pick’em Slate';
    if (p.startsWith('/pickem/week/') && p.endsWith('/results')) return 'Final Recap';
    if (p.startsWith('/pickem/week/')) return 'Lock Your Picks';
    if (p.startsWith('/pickem/standings')) return 'Standings Race';
    if (p.startsWith('/pickem/history')) return 'Pick History';
    if (p.startsWith('/pickem/rules')) return 'Playbook · How to Play';
    if (p.startsWith('/pickem/admin')) return 'Pick Center · Admin';
    return 'NFL Command Deck';
  })();

  // Week chip — derived from URL when on a week page, otherwise current week
  const weekChip = (() => {
    // The commissioner page owns its week picker; do not show a stale season week.
    if (path.startsWith('/nfl/admin/')) return null;
    const chainWeek = path === '/nfl/crazy-chain' ? new URLSearchParams(location.search).get('week') : null;
    const urlWeek = chainWeek ? Number(chainWeek) : params.weekNumber ? parseInt(params.weekNumber, 10) : null;
    if (urlWeek && Number.isFinite(urlWeek)) return `WK ${urlWeek}`;
    if (week?.week_number) return `WK ${week.week_number}`;
    if (season?.status === 'upcoming') return 'PRE';
    return null;
  })();

  const handleBack = () => {
    if (isHub) {
      setExitOpen(true);
    } else if (path === '/pickem' || path === '/nfl/crazy-chain' || path.startsWith('/nfl/admin/')) {
      navigate('/nfl');
    } else if (path.startsWith('/pickem/')) {
      navigate('/pickem');
    } else if (isChain) {
      navigate('/nfl/crazy-chain');
    } else {
      navigate('/nfl');
    }
  };

  const standingsPath = isChain ? '/nfl/crazy-chain/leaderboard' : '/pickem/standings';

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background:
            'linear-gradient(180deg, hsl(160 45% 6% / 0.96), hsl(160 50% 4% / 0.82))',
          borderColor: 'hsl(45 80% 50% / 0.22)',
          boxShadow:
            '0 1px 0 hsl(45 95% 55% / 0.15), 0 6px 18px -10px hsl(45 95% 55% / 0.4)',
        }}
      >
        <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handleBack}
            aria-label={isHub ? 'Exit NFL Game Center' : 'Back in NFL Game Center'}
            className="w-11 h-11 rounded-xl flex items-center justify-center btn-press text-white/90 active:text-gold"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/nfl" className="flex-1 min-w-0 flex items-center gap-2.5 btn-press">
            <span
              className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, hsl(45 95% 55% / 0.35), hsl(152 72% 36% / 0.22))',
                border: '1px solid hsl(45 95% 55% / 0.45)',
                boxShadow: '0 0 12px hsl(45 95% 55% / 0.35)',
              }}
            >
              <img
                src={pickemEmblem}
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
                style={{ filter: 'drop-shadow(0 0 4px hsl(45 95% 55% / 0.8))' }}
              />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p
                className="text-[12px] font-black uppercase tracking-[0.18em] truncate"
                style={{ color: 'hsl(45 95% 60%)' }}
              >
                NFL Game Center
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60 truncate">
                {subtitle}
              </p>
            </div>
          </Link>

          {weekChip && (
            <span
              className="h-9 px-2.5 rounded-lg flex items-center text-[11px] font-black tabular-nums"
              style={{
                background: 'hsl(152 72% 36% / 0.18)',
                border: '1px solid hsl(152 72% 46% / 0.4)',
                color: 'hsl(152 75% 75%)',
              }}
            >
              {weekChip}
            </span>
          )}

          {!isStandings && !isHub && (
            <Link
              to={standingsPath}
              aria-label="Standings"
              className="w-9 h-9 rounded-lg flex items-center justify-center btn-press"
              style={{
                background: 'hsl(45 95% 55% / 0.12)',
                border: '1px solid hsl(45 95% 55% / 0.28)',
                color: 'hsl(45 95% 60%)',
              }}
            >
              <Trophy className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      <PickemExitDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={() => {
          setExitOpen(false);
          navigate('/compete');
        }}
      />
    </>
  );
}
