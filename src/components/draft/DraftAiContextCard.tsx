import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Pencil, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Props {
  draftId: string;
  aiContext: string | null;
  aiContextOverride: string | null;
  canManage: boolean;
  hasResults: boolean;
  regenerating?: boolean;
  onSaved: () => void | Promise<void>;
  onRegenerate?: () => void | Promise<void>;
}

export function DraftAiContextCard({
  draftId,
  aiContext,
  aiContextOverride,
  canManage,
  hasResults,
  regenerating,
  onSaved,
  onRegenerate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftOverride, setDraftOverride] = useState(aiContextOverride || '');
  const [saving, setSaving] = useState(false);

  const effective = (aiContextOverride || '').trim() || (aiContext || '').trim();
  const hasOverride = !!(aiContextOverride && aiContextOverride.trim());

  const openSheet = () => {
    setDraftOverride(aiContextOverride || '');
    setOpen(true);
  };

  const save = async (alsoRegenerate: boolean) => {
    const trimmed = draftOverride.trim();
    if (trimmed.length > 1000) {
      toast.error('Override must be 1,000 characters or fewer.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('drafts')
        .update({
          ai_context_override: trimmed.length > 0 ? trimmed : null,
          ai_context_updated_at: new Date().toISOString(),
          ai_context_updated_by: user?.id || null,
        } as any)
        .eq('id', draftId);
      if (error) throw error;
      toast.success(trimmed ? 'Override saved.' : 'Override cleared.');
      setOpen(false);
      await onSaved();
      if (alsoRegenerate && onRegenerate && hasResults) {
        await onRegenerate();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save override');
    } finally {
      setSaving(false);
    }
  };

  // Don't render the card at all if there's no scope and the user can't manage.
  if (!effective && !canManage) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-3 mb-3"
      >
        <div className="flex items-start gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: hasOverride
                ? 'hsl(var(--da-gold-bright) / 0.15)'
                : 'hsl(var(--primary) / 0.12)',
            }}
          >
            <Sparkles
              className="w-3.5 h-3.5"
              style={{ color: hasOverride ? 'hsl(var(--da-gold-bright))' : 'hsl(var(--primary))' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {hasOverride ? 'Judging Scope Override' : effective ? 'Judging Scope' : 'Judging Scope'}
            </p>
            {effective ? (
              <p className="text-[12px] leading-snug mt-0.5 whitespace-pre-wrap break-words">
                {effective}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic">
                No scope set. AI will interpret the draft title broadly.
              </p>
            )}
            {hasOverride && (
              <p className="text-[10px] text-muted-foreground/60 mt-1 italic">
                Provided by the commissioner.
              </p>
            )}
          </div>
          {canManage && (
            <button
              onClick={openSheet}
              className="p-2 -m-1 rounded-md text-muted-foreground/60 hover:text-foreground active:text-foreground transition-colors flex-shrink-0"
              aria-label="Adjust AI Context"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'hsl(var(--da-gold-bright))' }} />
              Adjust AI Context
            </SheetTitle>
            <SheetDescription className="text-[12px]">
              Use this if the AI misunderstood the draft topic. The override is used for future AI reports and judging.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            {aiContext && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Original context (read-only)
                </label>
                <div className="mt-1 p-3 rounded-lg bg-muted/30 border border-border/30 text-[12px] whitespace-pre-wrap break-words">
                  {aiContext}
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Commissioner override
              </label>
              <Textarea
                value={draftOverride}
                onChange={(e) => setDraftOverride(e.target.value)}
                placeholder='e.g. "Include video game and TV villains too — not just movie villains."'
                maxLength={1000}
                rows={5}
                className="mt-1 min-h-[120px] resize-none text-[13px] leading-snug"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {draftOverride.length}/1000 — leave blank to clear the override.
              </p>
            </div>

            {!hasResults && (
              <p className="text-[11px] text-muted-foreground/70 italic">
                Saved. Regenerate Report will be available once the draft report has been generated.
              </p>
            )}
          </div>

          <SheetFooter className="flex flex-col gap-2 sm:flex-col">
            {hasResults && onRegenerate && (
              <Button
                onClick={() => save(true)}
                disabled={saving || regenerating}
                className="w-full gap-2"
              >
                {saving || regenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Save & Regenerate Report
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => save(false)}
              disabled={saving}
              className="w-full"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Override'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
