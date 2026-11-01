import { useState } from 'react';
import { ArrowLeft, Crown, Equal, Eye, RotateCw, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ShowdownMatchDetail, ShowdownRecord } from '@/lib/showdown/types';
import type { CipherCode, CipherResult } from '@/lib/showdown/cipher/types';
import { ShowdownAvatar } from '../ShowdownChrome';
import { CipherGuessHistory } from './CipherGame';
import { CipherPeg } from './CipherPeg';
import { CipherStatistics } from './CipherStatistics';
import './cipherHub.css';

export function CipherResults({ detail, viewerId, rivalry, onRematch, busy, error }: {
  detail: ShowdownMatchDetail; viewerId: string; rivalry?: ShowdownRecord | null; onRematch: () => void; busy: boolean; error?: string | null;
}) {
  const [inspecting, setInspecting] = useState<string | null>(null);
  const { challenge, cipher } = detail;
  const terminal = (result: CipherResult) => ['solved', 'exhausted', 'surrendered'].includes(result.attempt.status) && !!result.attempt.finished_at;
  if (challenge.game_key !== 'cipher_duel' || challenge.status !== 'completed' || cipher?.phase !== 'completed' || !cipher.results || cipher.results.length !== 2 || !cipher.results.every(terminal) || !challenge.players.every(player => player.finished_at)) return null;
  const me = challenge.players.find(player => player.user_id === viewerId);
  const opponent = challenge.players.find(player => player.user_id !== viewerId);
  const mine = cipher.results.find(result => result.user_id === viewerId);
  const theirs = cipher.results.find(result => result.user_id === opponent?.user_id);
  if (!me || !opponent || !mine || !theirs) return null;
  const draw = challenge.outcome === 'draw';
  const won = challenge.winner_id === viewerId;
  const winner = challenge.players.find(player => player.user_id === challenge.winner_id);
  const explanation = mine.attempt.solved && theirs.attempt.solved
    ? mine.attempt.guesses_used === theirs.attempt.guesses_used ? `Both codes cracked in ${mine.attempt.guesses_used} ${mine.attempt.guesses_used === 1 ? 'guess' : 'guesses'}. A true draw.` : 'Both codes cracked. Fewer guesses decided the duel.'
    : mine.attempt.solved || theirs.attempt.solved ? 'A cracked code beats an unsuccessful attempt.' : 'Neither code was cracked. A true draw.';
  const career = rivalry ?? detail.rivalry;
  const selected = inspecting === opponent.user_id ? theirs : mine;
  const selectedPerson = selected.user_id === viewerId ? me : opponent;
  const target = selected.user_id === viewerId ? theirs : mine;
  const targetPerson = target.user_id === viewerId ? me : opponent;

  return <div className="sd-results cd-results" data-testid="showdown-results">
    <header className="sd-results-hero cd-results-hero">{draw ? <Equal aria-hidden="true" /> : <Trophy aria-hidden="true" />}<p className="sd-eyebrow">CIPHER DUEL · FINAL</p><h1>{draw ? 'Evenly matched.' : won ? 'Secret decoded.' : 'A code to remember.'}</h1><p>{draw ? 'Draw' : `${winner?.display_name ?? 'Your rival'} wins`} · {explanation}</p></header>
    <div className="sd-scoreboard cd-result-board" aria-label="Final Cipher attempts">
      {[{ player: me, result: mine }, { player: opponent, result: theirs }].map(({ player, result }) => <article className="sd-score-player cd-result-player" key={player.user_id} data-winner={challenge.winner_id === player.user_id}>
        {challenge.winner_id === player.user_id && <Crown aria-label="Winner" />}
        <ShowdownAvatar name={player.display_name} url={player.avatar_url} />
        <h2>{player.display_name}<small>{player.user_id === viewerId ? 'You' : 'Rival'}</small></h2>
        <div className="cd-result-status">{result.attempt.solved ? 'Code cracked' : result.attempt.status === 'surrendered' ? 'Surrendered' : 'Code unbroken'}</div>
        <small className="cd-result-guesses">{result.attempt.guesses_used} / 10 guesses used</small>
        <div className="cd-result-code"><small>Code {player.user_id === viewerId ? 'you' : 'they'} set</small><CodePegs code={result.code} label={`${player.display_name}'s secret code`} /><button type="button" className="sd-button" onClick={() => setInspecting(player.user_id)} aria-label={`Inspect ${player.display_name}'s guesses`}><Eye size={14} aria-hidden="true" />View guesses</button></div>
      </article>)}
    </div>
    {career && <section className="sd-progress-summary" aria-label="Career head-to-head record"><strong>{career.wins}–{career.losses}–{career.draws}</strong><p>Your Cipher Duel rivalry with {opponent.display_name}</p><small>Wins · losses · draws across {career.played} completed {career.played === 1 ? 'duel' : 'duels'}</small></section>}
    {(detail.cipher_statistics ?? cipher.statistics) && <CipherStatistics statistics={detail.cipher_statistics ?? cipher.statistics!} />}
    {error && <p className="sd-error" role="alert">{error}</p>}
    <div className="sd-results-actions"><Link className="sd-button" to="/showdown?game=cipher_duel&tab=history"><ArrowLeft size={16} aria-hidden="true" />Match history</Link><button type="button" className="sd-button sd-primary" disabled={busy} onClick={onRematch}><RotateCw size={16} aria-hidden="true" />{busy ? 'Preparing…' : 'Rematch'}</button></div>
    <details className="sd-scoring-details"><summary>How the duel is decided</summary><p>Crack your rival’s four-peg code within ten guesses. Repeated colors are allowed. A successful attempt beats an unsuccessful one; if both crack the code, fewer guesses wins. Equal successful guess counts or two unsuccessful attempts draw. Time never breaks a tie. A rematch starts with fresh secret codes.</p></details>
    <Dialog open={inspecting !== null} onOpenChange={open => { if (!open) setInspecting(null); }}><DialogContent className="sd-dialog sd-cipher cd-review-dialog">
      <DialogHeader><DialogTitle>{selectedPerson.display_name}’s guesses</DialogTitle><DialogDescription>Final server-validated guesses. Clues count exact pegs and correct colors in other positions; they do not identify individual pegs.</DialogDescription></DialogHeader>
      <div className="sd-inspector-tabs" aria-label="Guess history player"><button type="button" aria-pressed={selected.user_id === viewerId} onClick={() => setInspecting(viewerId)}>{me.display_name}</button><button type="button" aria-pressed={selected.user_id === opponent.user_id} onClick={() => setInspecting(opponent.user_id)}>{opponent.display_name}</button></div>
      <div className="cd-review-target"><div><h3>{targetPerson.display_name}’s code</h3><p>The combination {selectedPerson.display_name} was trying to crack</p></div><CodePegs code={target.code} label={`${targetPerson.display_name}'s target code`} /></div>
      <div className="cd-history-readonly" tabIndex={0} aria-label={`${selectedPerson.display_name}'s final ten guess rows`}><CipherGuessHistory guesses={selected.guesses} readOnly /></div>
      <p className="cd-result-rule">{selected.attempt.solved ? `Cracked in ${selected.attempt.guesses_used} ${selected.attempt.guesses_used === 1 ? 'guess' : 'guesses'}.` : selected.attempt.status === 'surrendered' ? 'Attempt surrendered. Remaining rows were not played.' : 'Ten guesses used. The code stayed unbroken.'} Final attempts cannot be changed.</p>
    </DialogContent></Dialog>
  </div>;
}

function CodePegs({ code, label }: { code: CipherCode; label: string }) {
  return <div className="cd-code-pegs" role="group" aria-label={label}>{code.map((color, index) => <span key={index} role="img" aria-label={`Position ${index + 1}: ${color}`}><CipherPeg color={color} decorative /></span>)}</div>;
}
