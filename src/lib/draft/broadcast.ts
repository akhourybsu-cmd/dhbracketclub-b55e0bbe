export interface BroadcastPick {
  id: string;
  user_id: string;
  pick_text: string;
  pick_number: number;
  round: number;
  picked_at?: string;
  profiles?: { display_name?: string } | null;
}

export interface DraftBroadcastMoment {
  id: string;
  kind: 'pick' | 'round' | 'speed' | 'complete';
  eyebrow: string;
  headline: string;
  detail: string;
  pickNumber: number;
}

export function deriveBroadcastMoments(picks: BroadcastPick[], totalPicks: number): DraftBroadcastMoment[] {
  const ordered = [...picks].sort((a, b) => a.pick_number - b.pick_number);
  const moments: DraftBroadcastMoment[] = [];
  ordered.forEach((pick, index) => {
    const name = pick.profiles?.display_name || 'A player';
    moments.push({ id: `pick-${pick.id}`, kind: 'pick', eyebrow: `Pick #${pick.pick_number}`, headline: pick.pick_text, detail: `${name} · Round ${pick.round}`, pickNumber: pick.pick_number });
    const next = ordered[index + 1];
    if (!next || next.round !== pick.round) {
      moments.push({ id: `round-${pick.round}`, kind: 'round', eyebrow: 'Round complete', headline: `Round ${pick.round} is in the books`, detail: `${index + 1} selections locked`, pickNumber: pick.pick_number });
    }
    if (index > 0 && pick.picked_at && ordered[index - 1].picked_at) {
      const seconds = Math.round((new Date(pick.picked_at).getTime() - new Date(ordered[index - 1].picked_at!).getTime()) / 1000);
      if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 10) moments.push({ id: `speed-${pick.id}`, kind: 'speed', eyebrow: 'Quick trigger', headline: `${name} needed only ${seconds}s`, detail: pick.pick_text, pickNumber: pick.pick_number });
    }
  });
  if (totalPicks > 0 && ordered.length >= totalPicks) moments.push({ id: 'complete', kind: 'complete', eyebrow: 'Final board', headline: 'Every selection is locked', detail: `${totalPicks} picks · Draft complete`, pickNumber: totalPicks + 1 });
  return moments.sort((a, b) => b.pickNumber - a.pickNumber);
}