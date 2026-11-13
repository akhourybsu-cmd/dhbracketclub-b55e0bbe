import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Info, LayoutGrid, Radio } from 'lucide-react';
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
  const { draftId } = useParams<{ draftId?: string }>();
  const { season } = useCurrentSeason();
  const [exitOpen, setExitOpen] = useState(false);
  useEffect(() => setExitOpen(false), [location.key]);

  const path = location.pathname;
  const isHub = path === '/drafts';
  const isLiveHub = path === '/drafts/live';
  const isLineupHub = path === '/drafts/lineup';
  const isLineup = isLineupHub || path.startsWith('/drafts/lineup/');
  const isLiveMagazine = path.endsWith('/magazine') && new URLSearchParams(location.search).get('live') === '1';
  const isLive = isLiveHub || path.startsWith('/drafts/live/') || isLiveMagazine;

  // Contextual subtitle per route
  const subtitle = (() => {
    if (isLineupHub) return 'Lineup Drafts';
    if (path === '/drafts/lineup/create') return 'Build a lineup';
    if (isLineup) return 'Your lineup room';
    if (isLiveHub) return 'The live arena';
    if (path === '/drafts/live/create') return 'Host a live event';
    if (isLiveMagazine) return 'The event magazine';
    if (isLive) return 'Live event room';
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
    if (isLineup && !isLineupHub) {
      navigate('/drafts/lineup');
    } else if (isLiveMagazine && draftId) {
      navigate(`/drafts/live/${encodeURIComponent(draftId)}`);
    } else if (isLive && !isLiveHub) {
      navigate('/drafts/live');
    } else if (isHub) {
      setExitOpen(true);
    } else {
      navigate('/drafts');
    }
  };

  return (
    <>
      <header
        className={`da-hud da-arena-hud z-40 w-full border-b${isLive ? ' da-live-hud' : ''}`}
        data-da-live={isLive || undefined}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="da-arena-hud-inner">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            aria-label={isLineup && !isLineupHub ? 'Back to Lineup Drafts' : isLiveMagazine ? 'Back to live room' : isLive && !isLiveHub ? 'Back to LIVE arena' : isHub ? 'Exit Draft Arena' : 'Back to Draft Arena'}
            className="da-hud-action w-11 h-11 shrink-0 btn-press"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Link to={isLineup ? '/drafts/lineup' : isLive ? '/drafts/live' : '/drafts'} className="da-arena-brand" aria-label={isLineup ? 'Lineup Drafts lobby' : isLive ? 'Draft Arena LIVE lobby' : 'Draft Arena lobby'}>
            <span className="da-hud-emblem da-arena-emblem">
              <img
                src={draftEmblem}
                alt=""
                width={28}
                height={28}
                draggable={false}
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

          {isLive && <Link to="/drafts/live" className="da-hud-chip da-live-hud-badge shrink-0" aria-label="LIVE arena"><Radio className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span>LIVE</span></Link>}
          {isLineup && <Link to="/drafts/lineup" className="da-hud-chip shrink-0" aria-label="Lineup Drafts"><LayoutGrid className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span>Lineup</span></Link>}

          {!isLive && !isLineup && seasonChip && (
            <button
              type="button"
              onClick={openSeasonWelcome}
              aria-label={`Season info — ${seasonChip}`}
              title={`Season info — ${seasonChip}`}
              className="da-hud-chip da-arena-season-chip max-w-[min(23vw,9rem)] shrink-0"
            >
              <Info className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden="true" />
              <span className="min-w-0 truncate">{seasonChip}</span>
            </button>
          )}

          {!isLive && !isLineup && !seasonChip && season && (
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
