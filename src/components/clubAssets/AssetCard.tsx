import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Check, ChevronRight, Crown, FlaskConical, Gem, Loader2,
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star,
  Brackets, EyeOff, Settings, BookOpen, Dumbbell, VenetianMask,
} from 'lucide-react';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { CATEGORY_META } from '@/types/assets';
import { resolveOnboarding } from '@/lib/onboarding/registry';
import { FeatureOnboardingModal } from '@/components/onboarding/FeatureOnboardingModal';
import { StatusPill } from '@/components/ui/status-pill';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star,
  Brackets, Settings, BookOpen, Dumbbell, VenetianMask, Gem,
};

const CATEGORY_BG: Record<string, string> = {
  games:          'from-primary/20 to-primary/8',
  social:         'from-blue-500/20 to-blue-500/8',
  events:         'from-orange-400/20 to-orange-400/8',
  'admin-tools':  'from-yellow-400/20 to-yellow-400/8',
  experimental:   'from-purple-500/20 to-purple-500/8',
};

interface AssetCardProps {
  asset: PlatformAsset;
  installed?: InstalledAsset;
  /**
   * If true, clicking Install should open the InstallAssetSheet so the user
   * can read the full description first. Otherwise the card calls
   * `onQuickInstall` directly for a single-tap install.
   */
  requiresSheet?: boolean;
  /** This asset is currently being installed. */
  isInstalling?: boolean;
  /** This installed row is currently being uninstalled. */
  isUninstalling?: boolean;
  /** This installed row's enable/visible toggle is in flight. */
  isToggling?: boolean;
  onInstall: (asset: PlatformAsset) => void;
  onQuickInstall: (asset: PlatformAsset) => void;
  onUninstall: (installed: InstalledAsset) => void;
  onConfigure: (installed: InstalledAsset) => void;
  onToggleEnabled: (installed: InstalledAsset) => void;
  onToggleVisible: (installed: InstalledAsset) => void;
}

export const AssetCard = memo(function AssetCard({
  asset, installed, requiresSheet,
  isInstalling, isUninstalling, isToggling,
  onInstall, onQuickInstall, onUninstall, onConfigure, onToggleEnabled, onToggleVisible,
}: AssetCardProps) {
  const Icon = ICON_MAP[asset.icon_name] ?? Star;
  const isInstalled = !!installed;
  const isEnabled = installed?.enabled ?? false;
  const isHidden = installed ? !installed.visible_to_members : false;
  const categoryMeta = CATEGORY_META[asset.category] ?? { label: asset.category, color: 'hsl(var(--muted-foreground))' };
  const bgClass = CATEGORY_BG[asset.category] ?? 'from-muted/40 to-muted/10';
  const busy = !!(isInstalling || isUninstalling);

  // Preview-onboarding modal state — admins can rehearse the user-facing tour.
  const [previewOpen, setPreviewOpen] = useState(false);

  // Detect the install→installed transition so we can play a brief "✓" pulse.
  const prevInstalledRef = useRef(isInstalled);
  const [justInstalled, setJustInstalled] = useState(false);
  useEffect(() => {
    if (!prevInstalledRef.current && isInstalled) {
      setJustInstalled(true);
      const t = setTimeout(() => setJustInstalled(false), 1100);
      prevInstalledRef.current = true;
      return () => clearTimeout(t);
    }
    prevInstalledRef.current = isInstalled;
  }, [isInstalled]);

  const handleInstallClick = () => {
    if (busy) return;
    if (requiresSheet) onInstall(asset);
    else onQuickInstall(asset);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      className={cn(
        'glass-card p-4 flex flex-col gap-3 relative overflow-hidden transition-all',
        !isEnabled && isInstalled && 'opacity-60',
        isUninstalling && 'opacity-50',
      )}
      style={
        justInstalled
          ? {
              boxShadow: `0 0 0 1.5px ${categoryMeta.color}55, 0 0 28px -4px ${categoryMeta.color}55`,
              transition: 'box-shadow 1.1s ease-out',
            }
          : undefined
      }
    >
      {/* Just-installed flash overlay — fades out after ~1s */}
      {justInstalled && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${categoryMeta.color}, transparent 70%)`,
          }}
        />
      )}

      {/* Premium / experimental badges — shared StatusPill family. */}
      {asset.is_premium && (
        <StatusPill variant="premium" size="xs" className="absolute top-3 right-3">
          <Crown className="w-2.5 h-2.5" /> PRO
        </StatusPill>
      )}
      {asset.category === 'experimental' && (
        // Experimental keeps its purple identity via the accent prop —
        // hue is preserved while the shape/weight matches the pill family.
        <StatusPill accent="270 70% 60%" size="xs" className="absolute top-3 right-3">
          <FlaskConical className="w-2.5 h-2.5" /> BETA
        </StatusPill>
      )}

      {/* Header: icon + name */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
          'bg-gradient-to-br', bgClass,
        )}>
          <Icon className="w-5 h-5" style={{ color: categoryMeta.color }} />
        </div>

        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-extrabold text-[14px] tracking-tight leading-tight">{asset.name}</h3>
            {isInstalled && isEnabled && (
              <StatusPill variant="success" size="xs">
                <Check className="w-2.5 h-2.5" /> On
              </StatusPill>
            )}
            {isInstalled && !isEnabled && (
              <StatusPill variant="disabled" size="xs">Disabled</StatusPill>
            )}
            {isHidden && (
              <StatusPill variant="disabled" size="xs">
                <EyeOff className="w-2.5 h-2.5" /> Hidden
              </StatusPill>
            )}
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em] mt-0.5 block"
            style={{ color: categoryMeta.color + 'cc' }}
          >
            {categoryMeta.label}
          </span>
        </div>
      </div>

      {/* Short description */}
      <p className="text-[12px] text-muted-foreground/75 leading-relaxed -mt-1">
        {asset.short_description}
      </p>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-auto pt-1 border-t border-border/10">
        {!isInstalled ? (
          <button
            onClick={handleInstallClick}
            disabled={busy}
            aria-busy={isInstalling || undefined}
            className={cn(
              'flex-1 h-8 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all',
              !busy && 'active:scale-95',
              busy && 'cursor-not-allowed',
            )}
            style={{
              background: `linear-gradient(135deg, ${categoryMeta.color}22, ${categoryMeta.color}10)`,
              border: `1px solid ${categoryMeta.color}33`,
              color: categoryMeta.color,
              opacity: busy ? 0.7 : 1,
            }}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Installing…
              </>
            ) : requiresSheet ? (
              <>
                Install <ChevronRight className="w-3 h-3" />
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" /> Add to Club
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={() => setPreviewOpen(true)}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold bg-muted/30 hover:bg-muted/50 text-foreground/70 transition-colors border border-border/15 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Preview the onboarding members will see"
            >
              <BookOpen className="w-3 h-3" /> Preview
            </button>
            <button
              onClick={() => onConfigure(installed!)}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold bg-muted/30 hover:bg-muted/50 text-foreground/70 transition-colors border border-border/15 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Settings className="w-3 h-3" /> Configure
            </button>
            <button
              onClick={() => onToggleEnabled(installed!)}
              disabled={busy || isToggling}
              aria-busy={isToggling || undefined}
              className={cn(
                'flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold transition-colors border disabled:opacity-50 disabled:cursor-not-allowed',
                isEnabled
                  ? 'bg-destructive/8 hover:bg-destructive/15 text-destructive/80 border-destructive/15'
                  : 'bg-primary/8 hover:bg-primary/15 text-primary border-primary/20',
              )}
            >
              {isToggling ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> …
                </>
              ) : (
                isEnabled ? 'Disable' : 'Enable'
              )}
            </button>
            <button
              onClick={() => onUninstall(installed!)}
              disabled={busy}
              aria-busy={isUninstalling || undefined}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold bg-destructive/8 hover:bg-destructive/15 text-destructive/80 transition-colors border border-destructive/15 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove from club"
            >
              {isUninstalling ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                'Remove'
              )}
            </button>
            <button
              onClick={() => onToggleVisible(installed!)}
              disabled={busy || isToggling}
              className="ml-auto p-1.5 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground/50 hover:text-muted-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isHidden ? 'Show to members' : 'Hide from members'}
              aria-label={isHidden ? 'Show to members' : 'Hide from members'}
            >
              <EyeOff className={cn('w-3.5 h-3.5', !isHidden && 'opacity-30')} />
            </button>
          </>
        )}
      </div>

      {/* Admin preview — same tutorial members will see */}
      {isInstalled && (
        <FeatureOnboardingModal
          open={previewOpen}
          onboarding={resolveOnboarding(asset)}
          accent={asset.category === 'games' ? '152 72% 46%' : '195 80% 55%'}
          onClose={() => setPreviewOpen(false)}
          previewMode
        />
      )}
    </motion.div>
  );
});
