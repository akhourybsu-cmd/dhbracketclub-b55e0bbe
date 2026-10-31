import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Play, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './live/liveCeremony.css';

interface CeremonyParticipant { user_id: string; pick_order: number; profiles?: { display_name?: string } | null }

export function PreDraftCeremony({ topic, participants, revealIndex, canManage, busy, onRevealNext, onBegin, projector = false }: {
  topic: string; participants: CeremonyParticipant[]; revealIndex: number; canManage: boolean; busy: boolean;
  onRevealNext: () => void; onBegin: () => void; projector?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const ordered = [...participants].sort((a, b) => a.pick_order - b.pick_order);
  const allRevealed = revealIndex >= ordered.length;
  const latest = revealIndex > 0 ? ordered[Math.min(revealIndex, ordered.length) - 1] : null;
  const revealedCount = ordered.filter((_, index) => index < revealIndex).length;
  return <section className={projector ? 'da-ceremony da-ceremony-projector' : 'da-ceremony'} aria-label="Draft order ceremony" data-revealed-count={revealedCount} data-total-positions={ordered.length}>
    <div className="da-ceremony-glow" aria-hidden />
    <div className="da-ceremony-copy">
      <p className="dl-eyebrow flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Draft night</p>
      <h2 className="dl-display" title={topic}>{topic}</h2>
      <p>The room is set. The order is being revealed.</p>
    </div>
    <div className="da-ceremony-progress" role="progressbar" aria-label="Draft positions revealed" aria-valuemin={0} aria-valuemax={ordered.length} aria-valuenow={revealedCount} aria-valuetext={`${revealedCount} of ${ordered.length} positions revealed`}>
      <span>{revealedCount}<small> / {ordered.length} revealed</small></span>
      <i aria-hidden="true"><i style={{ width: `${ordered.length ? revealedCount / ordered.length * 100 : 0}%` }} /></i>
    </div>
    <div className="da-ceremony-current-wrap" role="status" aria-live="polite" aria-atomic="true">
      <motion.div
        key={`${latest?.user_id ?? 'awaiting'}:${revealIndex}`}
        initial={reduceMotion ? false : { opacity: .4, scale: projector ? 1.06 : .98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: projector ? .45 : .25, ease: [0.22, 1, 0.36, 1] }}
        className={projector ? 'da-ceremony-current da-ceremony-projector-reveal' : 'da-ceremony-current'}
      >
        <span className="dl-eyebrow">{latest ? 'Draft position' : 'The reveal begins here'}</span>
        <b className="dl-display" aria-label={latest ? `Position ${revealedCount}` : 'Position not yet revealed'}>{latest ? `#${revealedCount}` : '?'}</b>
        <strong className="dl-display" title={latest?.profiles?.display_name || undefined}>{latest ? latest.profiles?.display_name || 'Unknown' : ordered.length ? 'The first pick awaits' : 'Waiting for the lineup'}</strong>
      </motion.div>
    </div>
    <div className="da-ceremony-lineup" role="region" aria-label="Draft order lineup" tabIndex={0}>
    <ol className="da-ceremony-order">
      {ordered.map((participant, index) => {
        const shown = index < revealIndex;
        const name = participant.profiles?.display_name || 'Unknown';
        return <li key={participant.user_id} className={shown ? 'is-revealed' : ''} data-ceremony-position={index + 1} aria-current={shown && participant === latest ? 'step' : undefined}>
          <span className="dl-display">{index + 1}</span>
          <motion.strong key={`${participant.user_id}:${index}:${shown ? 'revealed' : 'awaiting'}`} initial={!shown || reduceMotion ? false : { opacity: .4, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }} title={shown ? name : undefined}>
            {shown ? name : 'Awaiting reveal'}
          </motion.strong>
          {shown && index === 0 ? <Crown className="h-4 w-4 text-primary" aria-hidden="true" /> : null}
        </li>;
      })}
    </ol>
    </div>
    <footer className="da-ceremony-footer">
    {canManage && !projector ? <div className="da-ceremony-controls">
      {!allRevealed ? <Button type="button" onClick={onRevealNext} disabled={busy} className="min-h-11 gap-2"><SkipForward className="h-4 w-4" aria-hidden="true" /> Reveal pick {revealIndex + 1}</Button> : <Button type="button" onClick={onBegin} disabled={busy} className="min-h-11 gap-2"><Play className="h-4 w-4" aria-hidden="true" /> Begin Draft</Button>}
      {!allRevealed && <Button type="button" variant="outline" onClick={onBegin} disabled={busy} className="min-h-11">Skip ceremony</Button>}
    </div> : <p className="da-ceremony-wait">The host controls the reveal.</p>}
    </footer>
  </section>;
}
