import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Crown, Play, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CeremonyParticipant { user_id: string; pick_order: number; profiles?: { display_name?: string } | null }

export function PreDraftCeremony({ topic, participants, revealIndex, canManage, busy, onRevealNext, onBegin }: {
  topic: string; participants: CeremonyParticipant[]; revealIndex: number; canManage: boolean; busy: boolean;
  onRevealNext: () => void; onBegin: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const ordered = [...participants].sort((a, b) => a.pick_order - b.pick_order);
  const allRevealed = revealIndex >= ordered.length;
  return <section className="da-ceremony" aria-label="Draft order ceremony">
    <div className="da-ceremony-glow" aria-hidden />
    <div className="da-ceremony-copy">
      <p className="dl-eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Draft night</p>
      <h2 className="dl-display">{topic}</h2>
      <p>The room is set. The order is being revealed.</p>
    </div>
    <div className="da-ceremony-order">
      {ordered.map((participant, index) => {
        const shown = index < revealIndex;
        const name = participant.profiles?.display_name || 'Unknown';
        return <div key={participant.user_id} className={shown ? 'is-revealed' : ''}>
          <span className="dl-display">{index + 1}</span>
          <AnimatePresence mode="wait"><motion.strong key={shown ? name : 'hidden'} initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {shown ? name : 'Awaiting reveal'}
          </motion.strong></AnimatePresence>
          {shown && index === 0 ? <Crown className="h-4 w-4 text-primary" /> : null}
        </div>;
      })}
    </div>
    {canManage ? <div className="da-ceremony-controls">
      {!allRevealed ? <Button onClick={onRevealNext} disabled={busy} className="gap-2"><SkipForward className="h-4 w-4" /> Reveal pick {revealIndex + 1}</Button> : <Button onClick={onBegin} disabled={busy} className="gap-2"><Play className="h-4 w-4" /> Begin Draft</Button>}
      {!allRevealed && <Button variant="outline" onClick={onBegin} disabled={busy}>Skip ceremony</Button>}
    </div> : <p className="da-ceremony-wait">The host controls the reveal.</p>}
  </section>;
}