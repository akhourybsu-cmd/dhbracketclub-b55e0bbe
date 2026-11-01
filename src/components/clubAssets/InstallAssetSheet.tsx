import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  X, Check, ChevronRight, MapPin, Settings2, Crown, Gem,
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star, Brackets,
  PartyPopper, BookOpen, Dumbbell, VenetianMask,
} from 'lucide-react';
import type { PlatformAsset } from '@/types/assets';
import { CATEGORY_META } from '@/types/assets';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star, Brackets, BookOpen, Dumbbell, VenetianMask, Gem,
};

const PLACEMENT_LABELS: Record<string, string> = {
  games:      'Games section in Compete',
  navigation: 'Main navigation sidebar & drawer',
  community:  'Community section',
  social:     'Social section',
  admin:      'Admin tools area',
};

interface InstallAssetSheetProps {
  asset: PlatformAsset | null;
  open: boolean;
  installing: boolean;
  onClose: () => void;
  onInstall: (asset: PlatformAsset) => Promise<void>;
  onConfigureNow: (asset: PlatformAsset) => void;
}

type Step = 'confirm' | 'success';

export function InstallAssetSheet({
  asset, open, installing, onClose, onInstall, onConfigureNow,
}: InstallAssetSheetProps) {
  const [step, setStep] = useState<Step>('confirm');

  const handleClose = () => {
    onClose();
    setTimeout(() => setStep('confirm'), 300);
  };

  const handleInstall = async () => {
    if (!asset) return;
    await onInstall(asset);
    setStep('success');
  };

  if (!asset) return null;

  const Icon = ICON_MAP[asset.icon_name] ?? Star;
  const categoryMeta = CATEGORY_META[asset.category] ?? { label: asset.category, color: 'hsl(var(--primary))' };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl max-w-lg mx-auto overflow-hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border/50" />
            </div>

            <AnimatePresence mode="wait">
              {step === 'confirm' ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                  className="px-6 pb-6"
                >
                  {/* Close */}
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
                      Add to Club
                    </span>
                    <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
                      <X className="w-4 h-4 text-muted-foreground/70" />
                    </button>
                  </div>

                  {/* Hero */}
                  <div className="flex items-center gap-4 mb-5">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${categoryMeta.color}28, ${categoryMeta.color}10)` }}
                    >
                      <Icon className="w-7 h-7" style={{ color: categoryMeta.color }} />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-[18px] tracking-tight">{asset.name}</h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={{ color: categoryMeta.color }}
                        >
                          {categoryMeta.label}
                        </span>
                        {asset.is_premium && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-yellow-400/15 text-yellow-500 border border-yellow-400/20">
                            <Crown className="w-2.5 h-2.5" /> PRO
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full description */}
                  <p className="text-[13px] text-foreground/80 leading-relaxed mb-5">
                    {asset.full_description}
                  </p>

                  {/* Info pills */}
                  <div className="space-y-2 mb-6">
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/10">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
                      <div>
                        <p className="text-[11px] font-bold text-foreground/80 mb-0.5">Appears in</p>
                        <p className="text-[11px] text-muted-foreground/70">
                          {PLACEMENT_LABELS[asset.placement_area] ?? asset.placement_area}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      'flex items-start gap-2.5 p-3 rounded-xl border',
                      asset.requires_configuration
                        ? 'bg-orange-400/6 border-orange-400/15'
                        : 'bg-muted/20 border-border/10',
                    )}>
                      <Settings2 className={cn(
                        'w-3.5 h-3.5 mt-0.5 flex-shrink-0',
                        asset.requires_configuration ? 'text-orange-400/80' : 'text-muted-foreground/60',
                      )} />
                      <div>
                        <p className="text-[11px] font-bold text-foreground/80 mb-0.5">Setup required</p>
                        <p className="text-[11px] text-muted-foreground/70">
                          {asset.requires_configuration
                            ? 'This asset needs configuration before members can use it.'
                            : 'Ready to use immediately after installation.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Install CTA */}
                  <button
                    onClick={handleInstall}
                    disabled={installing}
                    className={cn(
                      'w-full h-12 rounded-2xl font-extrabold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]',
                      installing ? 'opacity-60 cursor-not-allowed' : '',
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${categoryMeta.color}, ${categoryMeta.color}bb)`,
                      color: 'hsl(220 60% 4%)',
                      boxShadow: `0 4px 20px ${categoryMeta.color}40`,
                    }}
                  >
                    {installing ? 'Installing…' : (
                      <>Install {asset.name} <ChevronRight className="w-4 h-4" strokeWidth={3} /></>
                    )}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="px-6 pb-8 text-center"
                >
                  <div className="flex justify-end mb-2">
                    <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
                      <X className="w-4 h-4 text-muted-foreground/70" />
                    </button>
                  </div>

                  {/* Success icon */}
                  <motion.div
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 14, stiffness: 280, delay: 0.1 }}
                    className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `linear-gradient(135deg, ${categoryMeta.color}28, ${categoryMeta.color}10)` }}
                  >
                    <PartyPopper className="w-9 h-9" style={{ color: categoryMeta.color }} />
                  </motion.div>

                  <h2 className="font-extrabold text-[20px] tracking-tight mb-1">
                    {asset.name} installed!
                  </h2>
                  <p className="text-[13px] text-muted-foreground/70 mb-6 leading-relaxed">
                    {asset.name} is now active for your club.
                    {asset.requires_configuration && ' Configure it to get your members started.'}
                  </p>

                  <div className="flex flex-col gap-2">
                    {asset.requires_configuration && (
                      <button
                        onClick={() => { onConfigureNow(asset); handleClose(); }}
                        className="w-full h-11 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{
                          background: `linear-gradient(135deg, ${categoryMeta.color}, ${categoryMeta.color}bb)`,
                          color: 'hsl(220 60% 4%)',
                        }}
                      >
                        <Settings2 className="w-4 h-4" /> Configure Now
                      </button>
                    )}
                    <button
                      onClick={handleClose}
                      className="w-full h-11 rounded-2xl font-bold text-[13px] bg-muted/30 hover:bg-muted/50 text-foreground/80 transition-colors border border-border/15"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
