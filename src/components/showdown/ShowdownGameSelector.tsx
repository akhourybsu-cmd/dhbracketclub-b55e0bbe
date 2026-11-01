import { useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { showdownGames } from '@/lib/showdown/registry';
import type { ShowdownGame } from '@/lib/showdown/types';
import { ShowdownGameMark } from './ShowdownChrome';
import './gameSelector.css';

/** One game catalog, one choice pattern in both discovery and challenge setup. */
export function ShowdownGameSelector({ games, value, onChange, compact = false, disabled = false, label = 'Showdown games' }: {
  games: readonly ShowdownGame[];
  value: string;
  onChange: (key: string) => void;
  compact?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const choices = showdownGames.flatMap(registration => {
    const game = games.find(candidate => candidate.game_key === registration.key && candidate.current_rules_version === registration.rulesVersion && candidate.enabled);
    return registration.enabled && game ? [{ game, registration }] : [];
  });
  if (!choices.length) return null;
  const selectedIndex = Math.max(0, choices.findIndex(choice => choice.game.game_key === value));
  function select(index: number, focus = false) {
    if (disabled) return;
    const key = choices[index].game.game_key;
    if (focus) buttons.current.get(key)?.focus();
    if (key !== value) onChange(key);
  }
  return <section className={`sd-game-library ${compact ? 'is-compact' : ''}`} aria-label={compact ? undefined : 'Game library'}>
    {!compact && <div className="sd-game-library-heading"><h2>Choose your game</h2><span>{choices.length} {choices.length === 1 ? 'game' : 'games'} · async 1v1</span></div>}
    <div className="sd-game-selector" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined}>
      {choices.map(({ game, registration }, index) => {
        const selected = value === game.game_key;
        const duration = 'typicalDuration' in registration ? registration.typicalDuration.replace('minutes', 'min') : '1–2 min';
        return <button type="button" role="radio" aria-checked={selected} aria-label={game.name} aria-describedby={`${id}-${game.game_key}`} disabled={disabled} tabIndex={selectedIndex === index ? 0 : -1} key={game.game_key} data-game={game.game_key} data-testid={`showdown-game-${game.game_key}`} className="sd-game-option" ref={element => { if (element) buttons.current.set(game.game_key, element); else buttons.current.delete(game.game_key); }} onClick={() => select(index)} onKeyDown={event => {
          const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
          if (!direction && !['Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + direction + choices.length) % choices.length;
          select(next, true);
        }}>
          <span className="sd-game-option-art" aria-hidden="true"><ShowdownGameMark gameKey={game.game_key} /></span>
          <span className="sd-game-option-copy"><strong>{game.name}</strong><span id={`${id}-${game.game_key}`}><span>{registration.category}</span><small>{duration}</small></span></span>
          <span className="sd-game-option-check" aria-hidden="true">{selected && <Check size={10} strokeWidth={3} />}</span>
        </button>;
      })}
    </div>
  </section>;
}
