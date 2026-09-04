import { Link } from 'react-router-dom';
import { ChevronRight, Settings, Sparkles } from 'lucide-react';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { APP_NAV_SECTIONS } from '@/lib/appNavigation';
import { ScreenHeader } from '@/components/mobile/ScreenHeader';
import { AppSurface } from '@/components/mobile/AppSurface';

export default function ClubPage() {
  const { club, isClubAdmin } = useClub();
  const { filterNavPaths } = useClubAssets();
  const community = APP_NAV_SECTIONS.find(section => section.label === 'Club life')?.items ?? [];
  const visibleItems = community.filter(item => filterNavPaths([item.path]).length > 0);
  const accent = club?.accent_color ?? '152 72% 46%';

  return (
    <div className="member-page lg:max-w-5xl lg:mx-auto">
      <ScreenHeader
        eyebrow="Together"
        title={club?.name ?? 'Your club'}
        description="Everything your group is sharing, planning, and celebrating."
        action={isClubAdmin ? (
          <Link
            to="/club/settings"
            aria-label="Club settings"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted/70"
          >
            <Settings className="h-5 w-5" />
          </Link>
        ) : undefined}
      />

      {visibleItems.length > 0 ? (
        <AppSurface className="overflow-hidden lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:border-0 lg:bg-transparent lg:shadow-none">
          {visibleItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex min-h-[76px] items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/30 active:bg-muted/55 lg:rounded-2xl lg:!border lg:border-border/45 lg:bg-card lg:shadow-[var(--shadow-card)] ${index > 0 ? 'border-t border-border/30 lg:border-t' : ''}`}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    color: `hsl(${accent})`,
                    background: `linear-gradient(135deg, hsl(${accent} / 0.16), hsl(${accent} / 0.05))`,
                    boxShadow: `inset 0 0 0 1px hsl(${accent} / 0.14)`,
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold tracking-tight text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">Open {item.label.toLowerCase()}</span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-transform group-active:translate-x-0.5" />
              </Link>
            );
          })}
        </AppSurface>
      ) : (
        <AppSurface className="px-6 py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-[16px] font-extrabold">Your club space is ready</h2>
          <p className="mx-auto mt-1 max-w-[280px] text-[13px] leading-relaxed text-muted-foreground">
            Community features will appear here as they are added to your club.
          </p>
          {isClubAdmin && (
            <Link to="/club/assets" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground active:scale-[0.98]">
              Browse club apps
            </Link>
          )}
        </AppSurface>
      )}
    </div>
  );
}
