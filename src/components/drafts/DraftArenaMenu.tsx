import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  BookOpen,
  Bookmark,
  Home,
  LogOut,
  Menu,
  MonitorPlay,
  Plus,
  Trophy,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DraftArenaPaletteList } from './DraftArenaAppearance';

const primaryLinks = [
  { to: '/drafts', label: 'Rooms', description: 'Draft boards and active turns', icon: Bookmark, tab: 'drafts' },
  { to: '/drafts?tab=season', label: 'Season', description: 'Standings and playoff picture', icon: Trophy, tab: 'season' },
  { to: '/drafts?tab=stats', label: 'Stats', description: 'Career and league performance', icon: BarChart3, tab: 'stats' },
  { to: '/drafts/seasons', label: 'Archive', description: 'Past seasons and champions', icon: Archive, pathPrefix: '/drafts/seasons' },
] as const;

export function DraftArenaMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ draftId?: string; seasonId?: string }>();
  const search = new URLSearchParams(location.search);
  const activeTab = search.get('tab') ?? 'drafts';
  const inDraftRoom = Boolean(params.draftId) && !location.pathname.startsWith('/drafts/seasons');

  const isActive = (link: (typeof primaryLinks)[number]) => {
    if ('pathPrefix' in link && link.pathPrefix) return location.pathname.startsWith(link.pathPrefix);
    if (location.pathname !== '/drafts') return false;
    return activeTab === link.tab || (link.tab === 'drafts' && activeTab === 'misc');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="da-hud-action h-11 w-11 shrink-0 btn-press"
          aria-label="Draft Arena menu"
          title="Draft Arena menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="da-appearance-panel w-[min(22rem,calc(100vw-1rem))] p-2.5">
        <div className="px-1.5 pb-2">
          <p className="dl-display text-sm font-bold">Draft Arena</p>
          <p className="text-[11px] text-muted-foreground">Everything important in one place.</p>
        </div>

        <div className="grid gap-1.5">
          {primaryLinks.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 transition-colors',
                  active ? 'bg-primary/15 text-primary' : 'hover:bg-muted/55 text-foreground/90',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold leading-tight">{item.label}</span>
                  <span className="block truncate text-[10px] font-semibold text-muted-foreground/75">{item.description}</span>
                </span>
              </Link>
            );
          })}

          {inDraftRoom && params.draftId && (
            <div className="mt-1 grid grid-cols-2 gap-1.5 border-t border-border/35 pt-2">
              <Link
                to={`/drafts/${params.draftId}/magazine`}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/55 px-2 text-[11px] font-extrabold hover:bg-muted/45"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Magazine
              </Link>
              <Link
                to={`/drafts/${params.draftId}/kiosk`}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/55 px-2 text-[11px] font-extrabold hover:bg-muted/45"
              >
                <MonitorPlay className="h-3.5 w-3.5" aria-hidden />
                Kiosk
              </Link>
            </div>
          )}

          <Link
            to="/drafts/create"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-[44px] items-center justify-center gap-2 rounded-xl font-extrabold btn-press da-cta"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create Draft
          </Link>
        </div>

        <div className="mt-3 border-t border-border/35 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1.5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/75">Display</p>
              <p className="text-[10px] text-muted-foreground/65">Palette and light mode stay saved.</p>
            </div>
            <ThemeToggle className="da-hud-action" />
          </div>
          <DraftArenaPaletteList />
        </div>

        <div className="mt-3 border-t border-border/35 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              navigate('/compete');
            }}
            className="h-10 w-full justify-start gap-2 rounded-xl px-3 text-[12px] font-extrabold text-muted-foreground hover:text-foreground"
          >
            <Home className="h-4 w-4" aria-hidden />
            Back to Compete
            <LogOut className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}