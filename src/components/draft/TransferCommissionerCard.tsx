// Transfer Commissioner card — lives in the Draft Arena Commissioner tab.
//
// The Draft Arena has exactly one commissioner per season. This card lets
// the current commissioner (or a global app admin) hand the role off to
// another member of the club. Backed by draft_seasons.commissioner_user_id
// with RLS "commissioner or admin can update".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Shield, ArrowRightLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { setSeasonCommissioner, type DraftSeason } from '@/hooks/useDraftSeasons';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MemberRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  season: DraftSeason;
  isAppAdmin: boolean;
  onTransferred?: () => void;
}

export function TransferCommissionerCard({ season, isAppAdmin, onTransferred }: Props) {
  const { user } = useAuth();
  const { club } = useClub();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCurrentCommissioner = !!(user && season.commissioner_user_id === user.id);
  const canTransfer = isCurrentCommissioner || isAppAdmin;

  useEffect(() => {
    if (!club?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows } = await (supabase as any)
        .from('club_members')
        .select('user_id')
        .eq('club_id', club.id);
      const ids = ((rows as any[]) ?? []).map((r) => r.user_id);
      if (!ids.length) { if (!cancelled) { setMembers([]); setLoading(false); } return; }
      const { data: profs } = await (supabase as any)
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids);
      const byId = new Map(((profs as any[]) ?? []).map((p) => [p.id, p]));
      const merged: MemberRow[] = ids.map((id) => ({
        user_id: id,
        display_name: byId.get(id)?.display_name ?? null,
        avatar_url: byId.get(id)?.avatar_url ?? null,
      })).sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''));
      if (!cancelled) { setMembers(merged); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [club?.id]);

  const currentCommissioner = useMemo(
    () => members.find((m) => m.user_id === season.commissioner_user_id) ?? null,
    [members, season.commissioner_user_id],
  );
  const selectedMember = useMemo(
    () => members.find((m) => m.user_id === selectedId) ?? null,
    [members, selectedId],
  );

  // Eligible transferees = everyone in the club except the current commissioner
  const candidates = useMemo(
    () => members.filter((m) => m.user_id !== season.commissioner_user_id),
    [members, season.commissioner_user_id],
  );

  const handleConfirm = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await setSeasonCommissioner(season.id, selectedId);
      toast.success(`Commissioner transferred to ${selectedMember?.display_name ?? 'member'}`);
      setConfirmOpen(false);
      setSelectedId('');
      onTransferred?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to transfer commissioner');
    } finally {
      setBusy(false);
    }
  }, [selectedId, season.id, selectedMember, onTransferred]);

  return (
    <div
      className="da-glass p-4 space-y-3"
      style={{ borderColor: 'hsl(var(--gold) / 0.2)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(var(--gold) / 0.15)', border: '1px solid hsl(var(--gold) / 0.3)' }}
        >
          <Crown className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold">Commissioner</p>
          <p className="text-[10px] text-muted-foreground/70 truncate">
            {currentCommissioner?.display_name ?? (season.commissioner_user_id ? 'Member' : 'Unassigned')}
            {isCurrentCommissioner && ' · you'}
          </p>
        </div>
      </div>

      {!canTransfer ? (
        <p className="text-[10.5px] text-muted-foreground/70">
          Only the current commissioner can hand this role off. Ask{' '}
          <span className="font-bold">{currentCommissioner?.display_name ?? 'the commissioner'}</span> to transfer it.
        </p>
      ) : (
        <>
          <p className="text-[10.5px] text-muted-foreground/75">
            The Draft Arena has one commissioner at a time. Transferring hands over season controls,
            playoff seeding, and dispute resolution to the selected member. You&apos;ll lose commissioner access immediately.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loading || candidates.length === 0}
              className="flex-1 h-10 rounded-lg bg-muted/40 border border-border/40 px-3 text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <option value="">
                {loading ? 'Loading members…' : candidates.length === 0 ? 'No other members in club' : 'Select new commissioner…'}
              </option>
              {candidates.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? 'Member'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!selectedId || busy}
              className="h-10 px-3.5 rounded-lg text-[11.5px] font-extrabold btn-press flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold) / 0.95), hsl(var(--gold) / 0.7))',
                color: 'hsl(0 0% 8%)',
              }}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
            </button>
          </div>
          {isAppAdmin && !isCurrentCommissioner && (
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Acting as global admin.
            </p>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!busy) setConfirmOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer commissioner?</DialogTitle>
            <DialogDescription>
              {selectedMember?.display_name ?? 'The selected member'} will become the sole commissioner of
              the Draft Arena{season?.season_number ? ` (Season ${season.season_number})` : ''}.
              {isCurrentCommissioner && ' You will no longer have commissioner controls.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
