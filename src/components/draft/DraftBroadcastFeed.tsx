import { Radio, Sparkles, Timer, Trophy } from 'lucide-react';
import { deriveBroadcastMoments, type BroadcastPick } from '@/lib/draft/broadcast';

export function DraftBroadcastFeed({ picks, totalPicks, limit = 5 }: { picks: BroadcastPick[]; totalPicks: number; limit?: number }) {
  const moments = deriveBroadcastMoments(picks, totalPicks).slice(0, limit);
  if (moments.length === 0) return null;
  const icons = { pick: Radio, round: Sparkles, speed: Timer, complete: Trophy };
  return (
    <section className="da-broadcast" aria-label="Draft broadcast">
      <div className="da-live-zone-label"><span>Live</span> Broadcast desk</div>
      <div className="da-broadcast-list">
        {moments.map(moment => {
          const Icon = icons[moment.kind];
          return <article key={moment.id} className="da-broadcast-item">
            <Icon className="h-4 w-4 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="dl-eyebrow">{moment.eyebrow}</p>
              <p className="dl-display text-sm font-bold leading-tight">{moment.headline}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{moment.detail}</p>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}