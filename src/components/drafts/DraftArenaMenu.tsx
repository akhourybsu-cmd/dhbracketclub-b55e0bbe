import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive, ArrowUpRight, BarChart3, BookOpen, Bookmark, Home, LogOut,
  Menu, MonitorPlay, Palette, Plus, Swords, Trophy,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DraftArenaPaletteList } from './DraftArenaAppearance';

const primaryLinks = [
  { to: '/drafts', label: 'Draft rooms', description: 'Find your next pick', icon: Bookmark, tab: 'drafts' },
  { to: '/drafts?tab=season', label: 'The season', description: 'Standings & playoff picture', icon: Trophy, tab: 'season' },
  { to: '/drafts?tab=stats', label: 'Career stats', description: 'Your league record', icon: BarChart3, tab: 'stats' },
  { to: '/drafts/seasons', label: 'The archives', description: 'Past seasons & champions', icon: Archive, pathPrefix: '/drafts/seasons' },
] as const;

/** One-handed navigation; display choices are a separate, bounded drawer view. */
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
    if (location.pathname !== '/drafts' || !('tab' in link)) return false;
    return activeTab === link.tab || (link.tab === 'drafts' && activeTab === 'misc');
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon"
          className="da-hud-action h-11 w-11 shrink-0" aria-label="Draft Arena menu" title="Draft Arena menu">
          <Menu className="h-[18px] w-[18px]" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="da-mode da-lounge da-appearance-panel da-arena-drawer">
        <SheetHeader className="da-arena-drawer-header">
          <span className="da-arena-drawer-mark" aria-hidden="true"><Swords /></span>
          <div>
            <p className="da-arena-eyebrow">DH · DRAFT LEAGUE</p>
            <SheetTitle>Draft Arena menu</SheetTitle>
            <SheetDescription>Your league. Your next move.</SheetDescription>
          </div>
        </SheetHeader>
        <Tabs defaultValue="arena" className="da-arena-drawer-tabs">
          <TabsList className="da-arena-drawer-switch" aria-label="Arena menu views">
            <TabsTrigger value="arena"><Swords size={15} />Arena</TabsTrigger>
            <TabsTrigger value="display"><Palette size={15} />Display</TabsTrigger>
          </TabsList>
          <TabsContent value="arena" className="da-arena-drawer-body" tabIndex={0}>
            <nav className="da-arena-drawer-links" aria-label="Draft Arena navigation">
              {primaryLinks.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                    aria-current={isActive(item) ? 'page' : undefined}
                    className={cn('da-arena-drawer-link', isActive(item) && 'is-active')}>
                    <span className="da-arena-link-number" aria-hidden="true">0{index + 1}</span>
                    <Icon aria-hidden="true" />
                    <span><b>{item.label}</b><small>{item.description}</small></span>
                    <ArrowUpRight className="da-arena-link-arrow" aria-hidden="true" />
                  </Link>
                );
              })}
            </nav>
            {inDraftRoom && params.draftId && (
              <div className="da-arena-room-shortcuts">
                <p className="da-arena-eyebrow">THIS DRAFT</p>
                <div>
                  <Link to={`/drafts/${params.draftId}/magazine`} onClick={() => setOpen(false)}><BookOpen size={17} />Magazine</Link>
                  <Link to={`/drafts/${params.draftId}/kiosk`} onClick={() => setOpen(false)}><MonitorPlay size={17} />Kiosk</Link>
                </div>
              </div>
            )}
            <Link to="/drafts/create" onClick={() => setOpen(false)} className="da-arena-drawer-create da-cta">
              <Plus size={18} aria-hidden="true" />Create draft<ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </TabsContent>
          <TabsContent value="display" className="da-arena-drawer-body" tabIndex={0}>
            <div className="da-arena-display-mode">
              <span><b>Light & dark</b><small>Set the mood for your arena.</small></span>
              <ThemeToggle className="da-hud-action" />
            </div>
            <div className="da-arena-display-palettes">
              <p className="da-arena-eyebrow">YOUR COLORS</p>
              <DraftArenaPaletteList />
            </div>
            <p className="da-arena-display-note">Your display choices stay saved on this device.</p>
          </TabsContent>
        </Tabs>
        <div className="da-arena-drawer-footer">
          <Button type="button" variant="ghost" onClick={() => { setOpen(false); navigate('/compete'); }}>
            <Home size={17} aria-hidden="true" />Back to Compete<LogOut size={16} aria-hidden="true" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
