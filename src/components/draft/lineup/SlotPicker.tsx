import { Check, LockKeyhole } from 'lucide-react';
import type { LineupConfig } from '@/lib/draft/lineup';
import type { LineupPick } from '@/hooks/useLineupDraft';

export function SlotPicker({ config, picks, selected, onSelect, disabled = false }: {
  config: LineupConfig; picks: LineupPick[]; selected: string; onSelect: (slotId: string) => void; disabled?: boolean;
}) {
  const occupied = new Set(picks.map(pick => pick.lineup_slot_id));
  return <fieldset className="da-lineup-slot-picker" disabled={disabled}>
    <legend>Choose a slot</legend>
    <div className="da-lineup-slot-options" role="group" aria-label="Lineup slots">
      {config.slots.map(slot => {
        const taken = occupied.has(slot.id);
        return <button type="button" key={slot.id} disabled={taken || disabled} aria-pressed={selected === slot.id}
          aria-label={`${slot.label}${taken ? ', filled' : ''}`} title={taken ? 'This slot is filled' : slot.description}
          className="da-lineup-slot-option" data-selected={selected === slot.id} data-filled={taken}
          onClick={() => onSelect(slot.id)}>
          {taken ? <LockKeyhole aria-hidden="true" /> : selected === slot.id ? <Check aria-hidden="true" /> : <span className="da-lineup-slot-dot" aria-hidden="true" />}
          <span>{slot.label}</span>
        </button>;
      })}
    </div>
  </fieldset>;
}
