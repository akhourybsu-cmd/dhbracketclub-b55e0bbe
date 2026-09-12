import { useState } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
import { ArrowLeft, Info, Trophy } from 'lucide-react';
import draftEmblem from '@/assets/draft-emblem.png';
import { useCurrentSeason, formatSeasonChip } from '@/hooks/useDraftSeasons';
import { DraftArenaExitDialog } from './DraftArenaExitDialog';
import { openSeasonWelcome } from './seasonWelcomeBus';


/**
 * Sticky in-game HUD for the Draft Arena standalone shell.
 * Replaces the DH Club page header while inside /drafts/*.
 * Mirrors the Pick'em / Nexus / RuneDelve HUD pattern (gold + charcoal skin).
 */
export function DraftArenaHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { season } = useCurrentSeason();
  const [exitOpen, setExitOpen] = useState(false);

  const path = location.pathname;
  const isHub = path === '/drafts';

  // Contextual subtitle per route
  const subtitle = (() => {
    if (path === '/drafts') return 'War Room · All Drafts';
    if (path === '/drafts/create') return 'New Draft · Setup';
    if (path === '/drafts/seasons') return 'Seasons · Archive';
    if (path.startsWith('/drafts/seasons/')) return 'Season · Recap';
    if (path.startsWith('/drafts/')) return 'Draft Room · In Progress';
    return 'Draft Arena';
  })();

  // Season chip — short tag (e.g. "S4")
  const seasonChip = formatSeasonChip(season);

  const handleBack = () => {
    if (isHub) {
      setExitOpen(true);
    } else {
      navigate('/drafts');
    }
  };

  return (
    <>
      <header
        className="da-hud sticky top-0 z-40 w-full border-b backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] lg:max-w-[1100px] mx-auto">
          <button
            type="button"
            onClick={handleBack}
            aria-label={isHub ? 'Exit Draft Arena' : 'Back to Draft Arena'}
            className="w-11 h-11 rounded-xl flex items-center justify-center btn-press text-white/90 active:text-gold"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/drafts" className="flex-1 min-w-0 flex items-center gap-2.5 btn-press">
            <span className="da-hud-emblem relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={draftEmblem}
                alt=""
                width={20}
                height={20}
                className="da-hud-emblem-img w-5 h-5 object-contain"
              />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="da-hud-title text-[12px] font-black uppercase tracking-[0.18em] truncate">
                Draft Arena
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60 truncate">
                {subtitle}
              </p>
            </div>
          </Link>

          {seasonChip && (
            <button
              type="button"
              onClick={openSeasonWelcome}
              aria-label={`Season info — ${seasonChip}`}
              className="da-hud-chip h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-black tabular-nums uppercase btn-press"
            >
              <Info className="w-3.5 h-3.5 opacity-80" />
              {seasonChip}
            </button>
          )}

          {!seasonChip && season && (
            <button
              type="button"
              onClick={openSeasonWelcome}
              aria-label="Season info"
              className="da-hud-action w-9 h-9 rounded-lg flex items-center justify-center btn-press"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          {!isHub && (
            <Link
              to="/drafts?tab=season"
              aria-label="Season standings"
              className="da-hud-action w-9 h-9 rounded-lg flex items-center justify-center btn-press"
            >
              <Trophy className="w-4 h-4" />
            </Link>
          )}

        </div>
      </header>

      <DraftArenaExitDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        onConfirm={() => {
          setExitOpen(false);
          navigate('/compete', { replace: true });
        }}
      />
    </>
  );
}
