import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import draftEmblem from '@/assets/draft-emblem.webp';
import { useCurrentSeason, formatSeasonChip } from '@/hooks/useDraftSeasons';
import { DraftArenaExitDialog } from './DraftArenaExitDialog';
import { openSeasonWelcome } from './seasonWelcomeBus';
import { Button } from '@/components/ui/button';
import { DraftArenaMenu } from './DraftArenaMenu';


/**
 * Sticky in-game HUD for the Draft Arena standalone shell.
 * Replaces the DH Club page header while inside /drafts/*.
 * Mirrors the Pick'em / Nexus / RuneDelve HUD pattern (gold + charcoal skin).
 */
export function DraftArenaHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const { season } = useCurrentSeason();
  const [exitOpen, setExitOpen] = useState(false);

  const path = location.pathname;
  const isHub = path === '/drafts';

  // Contextual subtitle per route
  const subtitle = (() => {
    if (path === '/drafts') return 'The league lobby';
    if (path === '/drafts/create') return 'Create a draft';
    if (path === '/drafts/seasons') return 'Season archives';
    if (path.startsWith('/drafts/seasons/')) return 'Season recap';
    if (path.endsWith('/magazine')) return 'The draft magazine';
    if (path.startsWith('/drafts/')) return 'The draft room';
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
        className="da-hud da-arena-hud z-40 w-full border-b"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="da-arena-hud-inner">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label={isHub ? 'Exit Draft Arena' : 'Back to Draft Arena'}
            className="da-hud-action w-11 h-11 shrink-0 btn-press"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Link to="/drafts" className="da-arena-brand" aria-label="Draft Arena lobby">
            <span className="da-hud-emblem da-arena-emblem">
              <img
                src={draftEmblem}
                alt=""
                width={28}
                height={28}
                className="da-hud-emblem-img"
              />
            </span>
            <div className="da-arena-brand-copy">
              <p className="da-hud-title">
                Draft Arena
              </p>
              <p className="da-arena-brand-subtitle">
                {subtitle}
              </p>
            </div>
          </Link>

          {seasonChip && (
            <button
              type="button"
              onClick={openSeasonWelcome}
              aria-label={`Season info — ${seasonChip}`}
              className="da-hud-chip da-arena-season-chip"
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
              className="da-hud-action w-11 h-11 rounded-xl flex items-center justify-center btn-press"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          <DraftArenaMenu />

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
