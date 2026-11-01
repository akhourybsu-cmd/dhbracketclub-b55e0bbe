import { Flame, Target, Trophy } from 'lucide-react';
import type { CipherStats } from '@/lib/showdown/cipher/types';
import './cipherHub.css';

export function CipherStatistics({ statistics }: { statistics: CipherStats }) {
  const s = statistics;
  return <section className="cd-statistics" aria-label="Cipher Duel statistics">
    <header><Target size={17} aria-hidden="true" /><h2>Your codebreaking record</h2><small>{s.played} completed {s.played === 1 ? 'duel' : 'duels'}</small></header>
    <dl>
      <div><dt>Codes cracked</dt><dd>{s.solved_count}</dd></div><div><dt>Unbroken attempts</dt><dd>{s.failed_count}</dd></div>
      <div><dt>Average guesses</dt><dd>{s.average_guesses_to_solve == null ? '—' : s.average_guesses_to_solve.toLocaleString(undefined, { maximumFractionDigits: 2 })}</dd></div>
      <div><dt>Best solve</dt><dd>{s.best_guess_count == null ? '—' : `${s.best_guess_count} ${s.best_guess_count === 1 ? 'guess' : 'guesses'}`}</dd></div>
      <div><dt><Flame size={12} aria-hidden="true" />Win streak</dt><dd>{s.current_win_streak}<small>Best {s.longest_win_streak}</small></dd></div>
      <div><dt><Trophy size={12} aria-hidden="true" />First-guess solves</dt><dd>{s.first_guess_solves}</dd></div>
    </dl>
    <p>Average and best use successful attempts only. Expired, declined and cancelled invitations do not affect your record.</p>
  </section>;
}
