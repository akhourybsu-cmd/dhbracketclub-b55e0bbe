import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link, NavLink } from 'react-router-dom';
import { ArrowLeft, Share2, Briefcase, ArrowLeftRight, Star, Clock, Trophy, Rss, Landmark } from 'lucide-react';
import pwEmblem from '@/assets/portfolio-wars-emblem.png';
import { marketState, formatCountdown } from '@/lib/portfolioWars/market';
import { copyShareTextWithLink } from '@/lib/share';
import { PwExitDialog } from './PwExitDialog';

const PW_TABS = [
  { to: '/portfolio-wars', label: 'Portfolio', icon: Briefcase },
  { to: '/portfolio-wars/trade', label: 'Trade', icon: ArrowLeftRight },
  { to: '/portfolio-wars/watchlists', label: 'Watchlists', icon: Star },
  { to: '/portfolio-wars/orders', label: 'Orders', icon: Clock },
  { to: '/portfolio-wars/leaderboard', label: 'Standings', icon: Trophy },
  { to: '/portfolio-wars/activity', label: 'Tape', icon: Rss },
  { to: '/portfolio-wars/history', label: 'History', icon: Landmark },
] as const;

/**
 * Sticky in-game HUD for the Portfolio Wars standalone shell.
 * Replaces the DH Club page header while inside /portfolio-wars.
 * Trading-terminal skin: navy background, bull-green accents, amber highlights.
 */
export function PwHUD() {
  const location = useLocation();
  const navigate = useNavigate();
  const [exitOpen, setExitOpen] = useState(false);
  const [market, setMarket] = useState(() => marketState());

  useEffect(() => {
    const id = window.setInterval(() => setMarket(marketState()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isHub = location.pathname === '/portfolio-wars';

  const marketStatus = market.isOpen
    ? { color: 'hsl(152 80% 55%)', label: 'OPEN' }
    : { color: 'hsl(38 100% 60%)', label: 'CLOSED' };

  const subtitle = market.isOpen
    ? `Market Open · ${formatCountdown(market.msUntilChange)} ${market.changeLabel}`
    : `Market Closed · ${formatCountdown(market.msUntilChange)} ${market.changeLabel}`;

  const weekChip: string | null = null;

  const handleBack = () => {
    if (isHub) setExitOpen(true);
    else navigate('/portfolio-wars');
  };

  const handleShare = async () => {
    const url = 'https://dryhorse.app/portfolio-wars';
    const text = 'Grow $50,000 into the best portfolio in the club — Portfolio Wars on DH Club.';
    if (navigator.share) {
      try { await navigator.share({ title: 'Portfolio Wars', text, url }); return; }
      catch { /* fall through */ }
    }
    await copyShareTextWithLink(text, url);
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b backdrop-blur-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background:
            'linear-gradient(180deg, hsl(220 50% 5% / 0.96), hsl(220 55% 3% / 0.84))',
          borderColor: 'hsl(152 80% 50% / 0.22)',
          boxShadow:
            '0 1px 0 hsl(152 80% 50% / 0.18), 0 6px 18px -10px hsl(152 80% 50% / 0.4)',
        }}
      >
        <div className="flex items-center gap-2 h-12 px-2 max-w-[640px] mx-auto">
          <button
            type="button"
            onClick={handleBack}
            aria-label={isHub ? 'Exit Portfolio Wars' : 'Back to Portfolio Wars'}
            className="w-11 h-11 rounded-xl flex items-center justify-center btn-press text-white/90"
            style={{ transition: 'color 0.15s' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to="/portfolio-wars" className="flex-1 min-w-0 flex items-center gap-2.5 btn-press">
            <span
              className="relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, hsl(152 80% 50% / 0.35), hsl(38 100% 60% / 0.22))',
                border: '1px solid hsl(152 80% 50% / 0.45)',
                boxShadow: '0 0 12px hsl(152 80% 50% / 0.35)',
              }}
            >
              <img
                src={pwEmblem}
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
                style={{ filter: 'drop-shadow(0 0 4px hsl(152 80% 50% / 0.8))' }}
              />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <p
                className="text-[12px] font-black uppercase tracking-[0.18em] truncate"
                style={{ color: 'hsl(152 80% 60%)' }}
              >
                Portfolio Wars
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60 truncate">
                {subtitle}
              </p>
            </div>
          </Link>

          {/* Market status pip */}
          <span
            className="h-9 px-2 rounded-lg flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{
              background: 'hsl(220 40% 10% / 0.7)',
              border: '1px solid hsl(152 80% 50% / 0.22)',
              color: marketStatus.color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: marketStatus.color,
                boxShadow: `0 0 6px ${marketStatus.color}`,
              }}
            />
            {marketStatus.label}
          </span>

          {weekChip && (
            <span
              className="h-9 px-2.5 rounded-lg flex items-center text-[11px] font-black tabular-nums font-mono"
              style={{
                background: 'hsl(152 80% 50% / 0.14)',
                border: '1px solid hsl(152 80% 50% / 0.36)',
                color: 'hsl(152 80% 70%)',
              }}
            >
              {weekChip}
            </span>
          )}

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share Portfolio Wars"
            className="w-9 h-9 rounded-lg flex items-center justify-center btn-press"
            style={{
              background: 'hsl(38 100% 60% / 0.12)',
              border: '1px solid hsl(38 100% 60% / 0.28)',
              color: 'hsl(38 100% 65%)',
            }}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Section tabs */}
        <nav
          aria-label="Portfolio Wars sections"
          className="max-w-[640px] mx-auto px-2 pb-1.5 flex items-center gap-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {PW_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/portfolio-wars'}
              className="btn-press shrink-0 h-9 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]"
              style={({ isActive }) => ({
                background: isActive ? 'hsl(152 80% 50% / 0.16)' : 'transparent',
                border: `1px solid ${isActive ? 'hsl(152 80% 50% / 0.5)' : 'hsl(220 20% 100% / 0.08)'}`,
                color: isActive ? 'hsl(152 80% 65%)' : 'hsl(220 10% 100% / 0.55)',
                boxShadow: isActive ? '0 0 10px hsl(152 80% 50% / 0.25)' : 'none',
              })}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <PwExitDialog
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
