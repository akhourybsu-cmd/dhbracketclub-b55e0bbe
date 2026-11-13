import { Check, Pencil, Plus, Shield, UserRound } from 'lucide-react';
import { DraftPickArtwork } from '@/components/draft/DraftPickArtwork';
import type { DraftArtworkSource } from '@/lib/draft/artwork';
import type { LineupConfig } from '@/lib/draft/lineup';
import type { LineupPick } from '@/hooks/useLineupDraft';

export function LineupRoster({ config, picks, name, artwork, canChoose = false, onChooseSlot, onEditPick, ratings, current = false }: {
  config: LineupConfig; picks: LineupPick[]; name: string; artwork: Map<string, DraftArtworkSource>;
  canChoose?: boolean; onChooseSlot?: (slotId: string) => void; onEditPick?: (pick: LineupPick) => void;
  ratings?: Map<string, { score: number; explanation: string }>; current?: boolean;
}) {
  const filled = new Map(picks.map(pick => [pick.lineup_slot_id, pick]));
  return <section className="da-lineup-roster" aria-label={`${name} lineup`} data-current={current}>
    <header className="da-lineup-roster-header">
      <span className="da-lineup-player-mark" aria-hidden="true"><UserRound /></span>
      <h3>{name === 'Your' ? 'Your lineup' : name}</h3><span className="da-lineup-filled">{filled.size}/{config.slots.length}<span className="sr-only"> slots filled</span></span>
    </header>
    <div className="da-lineup-progress" role="progressbar" aria-label={`${name} filled slots`} aria-valuenow={filled.size} aria-valuemin={0} aria-valuemax={config.slots.length}>
      <span style={{ width: `${filled.size / config.slots.length * 100}%` }} />
    </div>
    <ol className="da-lineup-slot-grid">
      {config.slots.map((slot, index) => {
        const pick = filled.get(slot.id), rating = pick && ratings?.get(pick.id);
        return <li key={slot.id} className="da-lineup-tile" data-filled={!!pick}>
          <div className="da-lineup-tile-role"><span>{String(index + 1).padStart(2, '0')}</span><h4>{slot.label}</h4>{pick && <Check aria-label="Filled" />}</div>
          {pick ? <>
            <div className="da-lineup-tile-art"><DraftPickArtwork artwork={artwork.get(pick.id)} label={pick.pick_text} detail /></div>
            <div className="da-lineup-tile-caption"><strong>{pick.pick_text}</strong><span>Pick #{pick.pick_number}</span></div>
            {rating && <div className="da-lineup-tile-rating"><span><Shield aria-hidden="true" />{Number(rating.score).toFixed(1)}<small>/10</small></span><p>{rating.explanation}</p></div>}
            {onEditPick && <button type="button" className="da-lineup-edit-pick" onClick={() => onEditPick(pick)} aria-label={`Edit ${pick.pick_text}`}><Pencil aria-hidden="true" /><span>Edit pick</span></button>}
          </> : <button type="button" className="da-lineup-empty-slot" disabled={!canChoose} onClick={() => onChooseSlot?.(slot.id)} aria-label={`Draft ${slot.label}`}>
            <span className="da-lineup-empty-mark"><Plus aria-hidden="true" /></span><span>{canChoose ? 'Draft here' : 'Open slot'}</span>
            {slot.description && <small>{slot.description}</small>}
          </button>}
        </li>;
      })}
    </ol>
  </section>;
}
