import { useState } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    if (p.startsWith('/pickem/week/') && p.endsWith('/results')) return 'Results Center';
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
        className="nfl-command-hud sticky top-0 z-40 w-full"
      >
        <div className="flex items-center gap-2 h-14 px-3 sm:px-5 max-w-[1180px] mx-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label={isHub ? 'Exit NFL Game Center' : 'Back in NFL Game Center'}
            className="nfl-hud-icon"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Link to="/nfl" className="flex-1 min-w-0 flex items-center gap-2.5 btn-press">
            <span className="nfl-hud-emblem">
              <img
                src={pickemEmblem}
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="nfl-hud-title">
                NFL Game Center
              </p>
              <p className="nfl-hud-subtitle">
                {subtitle}
              </p>
            </div>
          </Link>

          {weekChip && (
            <span className="nfl-hud-week">
              {weekChip}
            </span>
          )}

          {!isStandings && !isHub && (
            <Button asChild variant="ghost" size="icon" className="nfl-hud-icon nfl-hud-standings">
              <Link to={standingsPath} aria-label="Standings"><Trophy className="w-4 h-4" /></Link>
            </Button>
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
