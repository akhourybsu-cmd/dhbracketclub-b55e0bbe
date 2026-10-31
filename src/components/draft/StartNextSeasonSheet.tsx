import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Users2, Swords, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  createSeason,
  formatSeasonTitle,
  type DraftSeason,
} from '@/hooks/useDraftSeasons';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousSeason: DraftSeason;
  onCreated: () => void;
}

export function StartNextSeasonSheet({ open, onOpenChange, previousSeason, onCreated }: Props) {
  const { user } = useAuth();
  const prevTitle = formatSeasonTitle(previousSeason) || previousSeason.name;

  const [nextNumber, setNextNumber] = useState<number>(
    (previousSeason.season_number ?? 0) + 1 || 1,
  );
  const [subtitle, setSubtitle] = useState<string>('');
  const [regularSeasonDrafts, setRegularSeasonDrafts] = useState<number>(previousSeason.regular_season_drafts || 12);
  const [bestOf, setBestOf] = useState<number>(previousSeason.best_of || 10);
  const [busy, setBusy] = useState(false);

  // Compute the next per-club season_number on open so the preview is accurate.
  useEffect(() => {
    if (!open) return;
    setSubtitle('');
    setRegularSeasonDrafts(previousSeason.regular_season_drafts || 12);
    setBestOf(previousSeason.best_of || 10);
    (async () => {
      try {
        const { data: clubId } = await supabase.rpc('current_user_club_id' as any);
        if (!clubId) return;
        const { data } = await supabase
          .from('draft_seasons' as any)
          .select('season_number')
          .eq('club_id', clubId as unknown as string)
          .order('season_number', { ascending: false, nullsFirst: false })
          .limit(1);
        const cur = (data && (data as any[])[0]?.season_number) as number | null | undefined;
        setNextNumber((cur || 0) + 1);
      } catch {
        // keep optimistic guess
      }
    })();
  }, [open, previousSeason]);

  const newTitle = `Season ${nextNumber}`;

  const handleSubmit = async () => {
    if (!Number.isInteger(regularSeasonDrafts) || regularSeasonDrafts < 1 || regularSeasonDrafts > 50 || !Number.isInteger(bestOf) || bestOf < 1 || bestOf > regularSeasonDrafts) {
      toast.error('Choose 1–50 drafts and a best-of count no larger than that total.');
      return;
    }

    setBusy(true);
    try {
      const now = new Date();
      const farFuture = new Date(now);
      farFuture.setFullYear(farFuture.getFullYear() + 1);

      const created: any = await createSeason({
        startsAt: now.toISOString(),
        endsAt: farFuture.toISOString(),
        subtitle: subtitle.trim() || null,
        regularSeasonDrafts,
        bestOf,
        commissionerUserId: previousSeason.commissioner_user_id || user?.id,
      });

      const title = created?.season_number ? `Season ${created.season_number}` : newTitle;
      toast.success(`${title} is live! 🏆`);
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start season');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 max-h-[92vh] overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.05))',
                border: '1px solid hsl(var(--gold) / 0.3)',
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
            </div>
            <div className="text-left">
              <SheetTitle className="text-[16px] font-extrabold leading-tight">Start a New Season</SheetTitle>
              <p className="text-[11px] text-muted-foreground/70 font-medium mt-0.5">
                Wraps {prevTitle} into the archive and opens fresh standings.
              </p>
            </div>
          </div>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 py-4 space-y-4"
        >
          {/* Carry-over banner */}
          <div
            className="rounded-xl p-3 flex items-center gap-2.5"
            style={{ background: 'hsl(var(--gold) / 0.06)', border: '1px solid hsl(var(--gold) / 0.18)' }}
          >
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <p className="text-[11px] font-semibold leading-snug">
              {prevTitle} stays archived with its podium, standings, and full bracket.
            </p>
          </div>

          {/* Auto-assigned title */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
              Season Title
            </Label>
            <div
              className="h-11 px-3 rounded-md flex items-center text-[14px] font-extrabold tracking-tight"
              style={{
                background: 'hsl(var(--gold) / 0.08)',
                border: '1px solid hsl(var(--gold) / 0.25)',
                color: 'hsl(var(--gold))',
              }}
            >
              {newTitle}
            </div>
            <p className="text-[10px] text-muted-foreground/60">
              Seasons are numbered automatically for your club.
            </p>
          </div>

          {/* Optional subtitle */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
              Subtitle <span className="text-muted-foreground/50 font-bold">(optional)</span>
            </Label>
            <Input
              value={subtitle}
              onChange={e => setSubtitle(e.target.value.slice(0, 60))}
              placeholder="e.g. Rookie Year, Summer Cup"
              className="h-11 text-[14px] font-bold"
              maxLength={60}
            />
            <p className="text-[10px] text-muted-foreground/60">
              Shown as a tagline below the season title.
            </p>
          </div>

          {/* Progression note (no dates — driven by draft count) */}
          <div
            className="rounded-xl p-3 flex items-start gap-2.5"
            style={{ background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.5)' }}
          >
            <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-[11px] font-semibold leading-snug text-muted-foreground">
              Seasons advance automatically when all regular-season drafts complete — no calendar dates required.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <Users2 className="w-3 h-3" /> Reg. Drafts
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={regularSeasonDrafts}
                onChange={e => setRegularSeasonDrafts(parseInt(e.target.value, 10) || 12)}
                className="h-11 text-[14px] font-bold tabular-nums text-center"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <Swords className="w-3 h-3" /> Best of N (scoring)
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={bestOf}
                onChange={e => setBestOf(parseInt(e.target.value, 10) || 10)}
                className="h-11 text-[14px] font-bold tabular-nums text-center"
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Standings count each player's best <strong>{bestOf}</strong> finishes from their {regularSeasonDrafts} regular-season drafts.
            Top 5 seeds advance to the playoffs.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1 pb-2">
            <button
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="flex-1 h-11 rounded-xl bg-muted/50 text-[12px] font-bold btn-press"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="flex-[2] h-11 rounded-xl text-[12px] font-extrabold btn-press flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--gold) / 0.85))',
                color: 'hsl(var(--background))',
                boxShadow: '0 6px 18px hsl(var(--gold) / 0.35)',
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? 'Starting…' : `Launch ${newTitle}`}
            </button>
          </div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}
