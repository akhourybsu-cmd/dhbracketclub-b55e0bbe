import { useState, type KeyboardEvent } from 'react';
import { BookOpen, Check, MapPin } from 'lucide-react';
import { fieldPlateUrl } from '@/lib/mesomon/assets';
import { SPECIES } from '@/lib/mesomon/data/species';
import { fieldGuideEntries } from '@/lib/mesomon/fieldGuide';
import type { MesomonSaveV1, SpeciesId } from '@/lib/mesomon/types';
import './fieldGuide.css';

export function FieldGuide({ save }: { save: MesomonSaveV1 }) {
  const entries = fieldGuideEntries(save);
  const discovered = entries.filter(entry => entry.seen);
  const [selected, select] = useState<SpeciesId | null>(null);
  const entry = discovered.find(value => value.species === selected) ?? discovered[0];
  const species = entry && SPECIES[entry.species];
  function navigatePlates(event: KeyboardEvent<HTMLOListElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (current + step + buttons.length) % buttons.length;
    buttons[next].focus();
    select(discovered[next].species);
  }

  return (
    <div className="mm-field-guide">
      <div className="mm-guide-progress">
        <span>Port Marche</span>
        <span>{discovered.length} / {entries.length} seen</span>
      </div>
      {entry && species ? (
        <figure className="mm-guide-spread" aria-label={species.name}>
          <div className="mm-guide-art" key={entry.species}>
            <span className="mm-guide-number" aria-hidden="true">№ {String(entry.number).padStart(2, '0')}</span>
            <img src={fieldPlateUrl(entry.species)} alt={species.name} width="512" height="512" />
          </div>
          <figcaption aria-live="polite" aria-atomic="true">
            <h3>{species.name}</h3>
            <div className="mm-guide-tags">
              <span>{species.affinities.join(' / ')}</span>
              {entry.bonded && <span><Check size={13} aria-hidden="true" /> Bonded</span>}
              {species.category === 'demon' && <span>Demon</span>}
            </div>
            <p>{species.description}</p>
            <span className="mm-guide-site"><MapPin size={14} aria-hidden="true" /> {entry.site}</span>
          </figcaption>
        </figure>
      ) : (
        <div className="mm-guide-empty">
          <BookOpen size={40} strokeWidth={1.25} aria-hidden="true" />
          <h3>No sightings yet</h3>
          <p>Meet a creature to add its field plate.</p>
        </div>
      )}
      <ol className="mm-guide-index" aria-label="Field plates" onKeyDown={navigatePlates}>
        {entries.map(value => (
          <li key={value.species}>
            {value.seen ? (
              <button type="button" aria-label={`View ${SPECIES[value.species].name}`}
                aria-pressed={value.species === entry?.species} onClick={() => select(value.species)}>
                <img src={fieldPlateUrl(value.species)} width="512" height="512" alt="" />
              </button>
            ) : (
              <span className="mm-guide-unseen">
                <span aria-hidden="true">—</span>
                <span className="mm-sr-only">Plate {value.number}, undiscovered</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
