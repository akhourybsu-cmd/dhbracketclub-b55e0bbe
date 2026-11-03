// ═══════════════════════════════════════════════════════════════════
// READSHIFT — server-authoritative phase advancement & scoring
//
// The single source of truth for moving a game between phases. Callable:
//   • by the host/admin  → { game_id, trigger: 'start'|'pause'|'resume'|'cancel' } (user JWT)
//                           plus commissioner overrides 'force' (advance the
//                           current phase now, skipping the due check) and
//                           'extend' ({ hours } — push the phase deadline out)
//   • by the scheduler    → { mode: 'scan' } (x-cron-secret) — advances every
//                           game whose phase_deadline has passed
//   • as a fallback       → { game_id, trigger: 'advance' } during a normal
//                           user request, so expired games self-heal even if
//                           a cron run is delayed.
//
// Idempotent & concurrency-safe: every mutation of `phase` is a
// compare-and-swap on the `version` column, so duplicate jobs / retries /
// multiple clients can never double-advance, double-assign, or double-score.
//
// Uses the shared engine (identical to src/lib/readshift, guarded by
// src/test/readshift/engineSync.test.ts). NEVER leaks Signals / targets /
// answers / guesses; notifications carry no user content.
// ═══════════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  assignSignals, scoreRound, computeRoundAwards, resolveTransition,
  type SignalAssignment, type Ballot, type Signal,
} from '../_shared/readshiftEngine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const MIN_VALID_ANSWERS = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const CRON_SECRET = Deno.env.get('CRON_SHARED_SECRET') || '';
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const isCron = req.headers.get('x-cron-secret') === CRON_SECRET && CRON_SECRET.length > 0;
    const body = await req.json().catch(() => ({}));

    // ── Resolve caller identity (for non-cron requests) ──
    let userId: string | null = null;
    if (!isCron) {
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
      userId = user.id;
    }

    // ── Scan mode (cron): advance every game past its deadline ──
    if (body.mode === 'scan') {
      if (!isCron) return json({ error: 'Forbidden' }, 403);
      const { data: due } = await admin
        .from('readshift_games')
        .select('id')
        .in('phase', ['shift', 'read', 'reveal'])
        .lte('phase_deadline', new Date().toISOString());
      let advanced = 0;
      for (const g of due || []) {
        const r = await advanceGame(admin, SUPABASE_URL, CRON_SECRET, g.id, 'advance', null);
        if (r.changed) advanced += 1;
      }
      return json({ scanned: (due || []).length, advanced });
    }

    // ── Single-game action ──
    const gameId = body.game_id as string | undefined;
    const trigger = (body.trigger as Trigger) || 'advance';
    if (!gameId) return json({ error: 'game_id required' }, 400);
    const result = await advanceGame(admin, SUPABASE_URL, CRON_SECRET, gameId, trigger, userId, Number(body.hours) || undefined);
    return json(result, result.error ? 400 : 200);
  } catch (e) {
    console.error('readshift-advance error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});

// ── Core, idempotent, compare-and-swap on version ──────────────────
type Trigger = 'start' | 'advance' | 'force' | 'extend' | 'pause' | 'resume' | 'cancel';

async function advanceGame(
  admin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  cronSecret: string,
  gameId: string,
  trigger: Trigger,
  userId: string | null,
  hours?: number,
): Promise<{ changed: boolean; phase?: string; error?: string }> {
  const { data: game } = await admin.from('readshift_games').select('*').eq('id', gameId).maybeSingle();
  if (!game) return { changed: false, error: 'Game not found' };
  const g = game as Record<string, any>;

  // ── Permission check for host-initiated triggers ──
  // Everything except the fallback 'advance' is a deliberate commissioner
  // action and requires host/admin. ('advance' is also fired by cron/clients
  // with no user, gated only by the DUE re-check below.)
  if (userId && trigger !== 'advance') {
    const isHost = g.created_by === userId;
    let isAdmin = false;
    const { data: adminRow } = await admin.from('club_members').select('role').eq('club_id', g.club_id).eq('user_id', userId).maybeSingle();
    isAdmin = (adminRow as any)?.role === 'admin';
    const { data: appAdmin } = await admin.rpc('is_app_admin', { _user_id: userId });
    if (!isHost && !isAdmin && !appAdmin) return { changed: false, error: 'Only the host or an admin can do that' };
  }

  // ── Extend: bump the current phase deadline, no phase change ──
  if (trigger === 'extend') {
    if (!['shift', 'read', 'reveal'].includes(g.phase)) return { changed: false, error: 'Nothing to extend' };
    const add = Math.min(Math.max(hours ?? 12, 1), 168); // 1h..7d
    const base = g.phase_deadline && new Date(g.phase_deadline).getTime() > Date.now() ? new Date(g.phase_deadline) : new Date();
    const next = new Date(base.getTime() + add * 3600_000).toISOString();
    await admin.from('readshift_games').update({ phase_deadline: next }).eq('id', gameId);
    return { changed: true, phase: g.phase };
  }

  // 'force' shares the natural 'advance' target but skips the DUE gate.
  const engineTrigger = (trigger === 'force' ? 'advance' : trigger) as
    'start' | 'advance' | 'pause' | 'resume' | 'cancel';
  const ctx = { round: g.current_round || 0, totalRounds: g.total_rounds, resumeInto: g.paused_from_phase as any };
  const target = resolveTransition(g.phase, engineTrigger, ctx);
  if (!target) return { changed: false, error: `Illegal transition: ${trigger} from ${g.phase}` };

  // ── For a fallback 'advance', re-verify the transition is actually DUE.
  //    A commissioner 'force' skips this (deliberate early advance). ──
  if (trigger === 'advance') {
    const due = await transitionIsDue(admin, g);
    if (!due) return { changed: false, phase: g.phase };
  }

  // ── Compare-and-swap the phase (blocks duplicate/concurrent advances) ──
  const patch: Record<string, any> = { phase: target.to, version: g.version + 1 };
  if (trigger === 'pause') patch.paused_from_phase = g.phase;
  if (trigger === 'resume') patch.paused_from_phase = null;
  if (target.to === 'completed') patch.completed_at = new Date().toISOString();

  const { data: swapped } = await admin
    .from('readshift_games')
    .update(patch)
    .eq('id', gameId)
    .eq('version', g.version)          // CAS guard
    .select('id')
    .maybeSingle();
  if (!swapped) return { changed: false, phase: g.phase }; // someone else advanced first

  // ── Phase-specific side effects (each idempotent via on-conflict) ──
  try {
    if (target.to === 'shift') {
      await startRound(admin, g, target.nextRound!);
    } else if (target.to === 'read') {
      await openReadPhase(admin, g);
    } else if (target.to === 'reveal') {
      await scoreCurrentRound(admin, g);
    } else if (target.to === 'completed') {
      await finalizeGame(admin, g);
    }
    await notifyPhase(supabaseUrl, cronSecret, admin, gameId, target.to);
  } catch (sideErr) {
    console.error('readshift-advance side-effect error (phase already swapped):', sideErr);
  }
  return { changed: true, phase: target.to };
}

/** Whether the current active phase has met its advance condition. */
async function transitionIsDue(admin: any, g: Record<string, any>): Promise<boolean> {
  const deadlinePassed = g.phase_deadline && new Date(g.phase_deadline).getTime() <= Date.now();
  if (deadlinePassed) return true;
  if (!g.early_advance) return false;

  const { data: parts } = await admin.from('readshift_participants').select('user_id').eq('game_id', g.id).eq('active', true);
  const activeIds: string[] = (parts || []).map((p: any) => p.user_id);
  const round = await currentRound(admin, g.id, g.current_round);
  if (!round) return false;

  if (g.phase === 'shift') {
    const { data: answers } = await admin.from('readshift_answers').select('user_id').eq('round_id', round.id);
    const submitted = new Set((answers || []).map((a: any) => a.user_id));
    return activeIds.every((id) => submitted.has(id));
  }
  if (g.phase === 'read') {
    // Everyone has a complete ballot (a guess for every eligible answer).
    const { data: answers } = await admin.from('readshift_answers').select('id, user_id').eq('round_id', round.id).eq('locked', true);
    const answerCount = (answers || []).length;
    for (const id of activeIds) {
      const eligible = (answers || []).filter((a: any) => a.user_id !== id).length;
      if (eligible === 0) continue;
      const { count } = await admin.from('readshift_guesses').select('id', { count: 'exact', head: true })
        .eq('round_id', round.id).eq('reader_user_id', id).not('guessed_user_id', 'is', null);
      if ((count || 0) < eligible) return false;
    }
    return answerCount > 0;
  }
  // reveal advances only on its deadline (handled above).
  return false;
}

async function currentRound(admin: any, gameId: string, roundNumber: number) {
  const { data } = await admin.from('readshift_rounds').select('*').eq('game_id', gameId).eq('round_number', roundNumber).maybeSingle();
  return data as Record<string, any> | null;
}

/** Create a round, pick a non-repeated prompt, assign Signals, set the Shift deadline. */
async function startRound(admin: any, g: Record<string, any>, roundNumber: number) {
  // Idempotency: if this round already exists, do nothing.
  const existing = await currentRound(admin, g.id, roundNumber);
  const { data: partRows } = await admin.from('readshift_participants').select('user_id').eq('game_id', g.id).eq('active', true);
  const players: string[] = (partRows || []).map((p: any) => p.user_id).sort();

  // Prior assignments → history for balanced Signal distribution.
  const { data: priorRounds } = await admin.from('readshift_rounds').select('id, round_number').eq('game_id', g.id).lt('round_number', roundNumber).order('round_number');
  const history: SignalAssignment[][] = [];
  for (const pr of priorRounds || []) {
    const { data: sa } = await admin.from('readshift_signal_assignments').select('user_id, signal, frame_target_user_id').eq('round_id', pr.id);
    history.push((sa || []).map((r: any) => ({ userId: r.user_id, signal: r.signal as Signal, frameTargetUserId: r.frame_target_user_id })));
  }

  // Choose a prompt not already used in this game.
  const { data: usedRows } = await admin.from('readshift_rounds').select('prompt_id').eq('game_id', g.id);
  const used = new Set((usedRows || []).map((r: any) => r.prompt_id).filter(Boolean));
  let { data: prompts } = await admin.from('readshift_prompts').select('id, body, category, is_group').eq('is_active', true).eq('mode', g.prompt_mode);
  // Fallback: if no prompts exist for the requested mode, use any active prompt so the round is never promptless.
  if (!prompts || prompts.length === 0) {
    const { data: anyPrompts } = await admin.from('readshift_prompts').select('id, body, category, is_group').eq('is_active', true);
    prompts = anyPrompts || [];
  }
  const cats: string[] = g.prompt_categories || [];
  const pool = (prompts || []).filter((p: any) =>
    !used.has(p.id) && (cats.length === 0 || cats.includes(p.category)));
  // Cascading fallback: category-filtered → mode-only unused → any unused → any prompt.
  const finalPool = pool.length
    ? pool
    : ((prompts || []).filter((p: any) => !used.has(p.id)).length
        ? (prompts || []).filter((p: any) => !used.has(p.id))
        : (prompts || []));
  // Deterministic pick from the game seed + round.
  const rnd = ((Number(g.seed) ^ (roundNumber * 0x9e3779b1)) >>> 0) / 4294967296;
  const prompt = finalPool.length ? finalPool[Math.floor(rnd * finalPool.length)] : null;

  const shiftDeadline = hoursFromNow(g.shift_hours);
  if (!existing) {
    await admin.from('readshift_rounds').insert({
      club_id: g.club_id, game_id: g.id, round_number: roundNumber,
      prompt_id: prompt?.id ?? null, prompt_snapshot: prompt?.body ?? null,
      phase: 'shift', shift_deadline: shiftDeadline,
    });
  }
  const round = await currentRound(admin, g.id, roundNumber);
  if (!round) return;

  // Assign Signals (only if not already assigned — idempotent).
  const { count: saCount } = await admin.from('readshift_signal_assignments').select('id', { count: 'exact', head: true }).eq('round_id', round.id);
  if ((saCount || 0) === 0 && players.length > 0) {
    const assignments = assignSignals({ players, roundIndex: roundNumber - 1, history, seed: Number(g.seed) });
    await admin.from('readshift_signal_assignments').insert(
      assignments.map((a) => ({
        club_id: g.club_id, round_id: round.id, user_id: a.userId,
        signal: a.signal, frame_target_user_id: a.frameTargetUserId,
      })),
    );
  }

  await admin.from('readshift_games').update({ current_round: roundNumber, phase_deadline: shiftDeadline }).eq('id', g.id);
}

/** Lock answers, open Read (or void the round if too few answers). */
async function openReadPhase(admin: any, g: Record<string, any>) {
  const round = await currentRound(admin, g.id, g.current_round);
  if (!round) return;
  await admin.from('readshift_answers').update({ locked: true }).eq('round_id', round.id);
  const { data: answers } = await admin.from('readshift_answers').select('id').eq('round_id', round.id).eq('locked', true);
  if ((answers || []).length < MIN_VALID_ANSWERS) {
    // Deterministic void rule: too few answers → void round, skip straight to reveal
    // (which will show the void and advance). Keeps the game from stalling.
    await admin.from('readshift_rounds').update({ phase: 'reveal', voided: true }).eq('id', round.id);
    await admin.from('readshift_games').update({ phase: 'reveal', phase_deadline: hoursFromNow(g.reveal_hours) }).eq('id', g.id);
    return;
  }
  const readDeadline = hoursFromNow(g.read_hours);
  await admin.from('readshift_rounds').update({ phase: 'read', read_deadline: readDeadline }).eq('id', round.id);
  await admin.from('readshift_games').update({ phase_deadline: readDeadline }).eq('id', g.id);
}

/** Score the round (pure engine), persist immutable results + awards + stats. */
async function scoreCurrentRound(admin: any, g: Record<string, any>) {
  const round = await currentRound(admin, g.id, g.current_round);
  if (!round || round.voided) {
    if (round) await admin.from('readshift_games').update({ phase_deadline: hoursFromNow(g.reveal_hours) }).eq('id', g.id);
    return;
  }
  // Idempotent: skip if already scored.
  const { data: existingResult } = await admin.from('readshift_round_results').select('id').eq('round_id', round.id).maybeSingle();
  if (existingResult) return;

  const { data: answerRows } = await admin.from('readshift_answers').select('id, user_id, body').eq('round_id', round.id).eq('locked', true);
  const answers = (answerRows || []).map((a: any) => a.user_id);
  const answerIdByUser: Record<string, string> = {};
  for (const a of answerRows || []) answerIdByUser[a.user_id] = a.id;
  const userByAnswerId: Record<string, string> = {};
  for (const a of answerRows || []) userByAnswerId[a.id] = a.user_id;

  const { data: saRows } = await admin.from('readshift_signal_assignments').select('user_id, signal, frame_target_user_id').eq('round_id', round.id);
  const signals: Record<string, { signal: Signal; frameTargetUserId: string | null }> = {};
  for (const s of saRows || []) signals[s.user_id] = { signal: s.signal, frameTargetUserId: s.frame_target_user_id };

  // Build ballots keyed by reader; guesses map author→guessedAuthor.
  const { data: guessRows } = await admin.from('readshift_guesses').select('reader_user_id, answer_id, guessed_user_id, is_strong_read').eq('round_id', round.id);
  const byReader: Record<string, Ballot> = {};
  for (const gr of guessRows || []) {
    const author = userByAnswerId[gr.answer_id];
    if (!author) continue;
    const b = (byReader[gr.reader_user_id] ??= { readerUserId: gr.reader_user_id, guesses: {}, strongReadAuthorUserId: null, complete: false });
    if (gr.guessed_user_id) b.guesses[author] = gr.guessed_user_id;
    if (gr.is_strong_read) b.strongReadAuthorUserId = author;
  }
  // A ballot is complete when it has a guess for every eligible (non-own) answer.
  for (const reader of Object.keys(byReader)) {
    const eligible = answers.filter((a) => a !== reader);
    const b = byReader[reader];
    b.complete = eligible.length > 0 && eligible.every((a) => b.guesses[a] != null);
  }

  const score = scoreRound({ answers, signals, ballots: Object.values(byReader) });
  const awards = computeRoundAwards(score);

  // Build the immutable REVEAL payload: bodies + authors + per-player guesses
  // + points. This is the ONLY place answer→author is joined, and it lands in
  // readshift_round_results (participant-readable) — the sanctioned reveal source.
  const guessesByAnswer: Record<string, { reader: string; guessed: string | null; strong: boolean }[]> = {};
  for (const gr of guessRows || []) {
    (guessesByAnswer[gr.answer_id] ??= []).push({ reader: gr.reader_user_id, guessed: gr.guessed_user_id, strong: gr.is_strong_read });
  }
  const revealAnswers = (answerRows || []).map((a: any) => {
    const d = score.perAnswer[a.user_id];
    return {
      answerId: a.id, authorUserId: a.user_id, body: a.body,
      signal: d?.signal ?? 'TELL', frameTargetUserId: d?.frameTargetUserId ?? null,
      guessDistribution: d?.guessDistribution ?? {},
      correctGuessCount: d?.correctGuessCount ?? 0,
      targetGuessCount: d?.targetGuessCount ?? 0,
      signalPoints: d?.signalPoints ?? 0,
      bonuses: d?.bonuses ?? [],
      strongReadCount: d?.strongReadCount ?? 0,
      guesses: guessesByAnswer[a.id] ?? [],
    };
  });

  await admin.from('readshift_round_results').insert({
    club_id: g.club_id, game_id: g.id, round_id: round.id,
    detail: { answers: revealAnswers, correctReads: score.correctReads, strongReadCorrect: score.strongReadCorrect },
    reading_points: score.readingPoints, signal_points: score.signalPoints, total_points: score.totalPoints,
  });
  if (awards.length) {
    await admin.from('readshift_round_awards').insert(
      awards.map((a) => ({ club_id: g.club_id, game_id: g.id, round_id: round.id, award_key: a.key, label: a.label, user_id: a.userId, value: a.value })),
    );
  }
  await admin.from('readshift_rounds').update({ phase: 'reveal', scored_at: new Date().toISOString() }).eq('id', round.id);
  await admin.from('readshift_games').update({ phase_deadline: hoursFromNow(g.reveal_hours) }).eq('id', g.id);
  await updateStats(admin, g, round.id, score, signals, answers);
}

/** Increment per-user cumulative stats. Best-effort; safe to skip on error. */
async function updateStats(admin: any, g: Record<string, any>, _roundId: string, score: any, signals: Record<string, any>, answers: string[]) {
  const players = new Set<string>([...Object.keys(score.totalPoints), ...answers]);
  for (const uid of players) {
    const { data: existing } = await admin.from('readshift_stats').select('*').eq('club_id', g.club_id).eq('user_id', uid).maybeSingle();
    const s = (existing as any) || {};
    const sig = signals[uid]?.signal as Signal | undefined;
    const detail = score.perAnswer[uid];
    const patch: Record<string, any> = {
      club_id: g.club_id, user_id: uid,
      rounds_played: (s.rounds_played || 0) + 1,
      total_score: Number(s.total_score || 0) + (score.totalPoints[uid] || 0),
      correct_reads: (s.correct_reads || 0) + (score.correctReads[uid] || 0),
      correct_strong_reads: (s.correct_strong_reads || 0) + (score.strongReadCorrect[uid] ? 1 : 0),
    };
    if (sig && detail) {
      const success = detail.signalPoints > 0;
      if (sig === 'TELL') { patch.tell_rounds = (s.tell_rounds || 0) + 1; patch.tell_success = (s.tell_success || 0) + (success ? 1 : 0); }
      if (sig === 'BLUR') { patch.blur_rounds = (s.blur_rounds || 0) + 1; patch.blur_success = (s.blur_success || 0) + (success ? 1 : 0); }
      if (sig === 'FRAME') { patch.frame_rounds = (s.frame_rounds || 0) + 1; patch.frame_success = (s.frame_success || 0) + (success ? 1 : 0); }
    }
    await admin.from('readshift_stats').upsert(patch, { onConflict: 'club_id,user_id' });
  }
}

/** Final round done → compute winner, bump games_played / games_won. */
async function finalizeGame(admin: any, g: Record<string, any>) {
  const { data: results } = await admin.from('readshift_round_results').select('total_points').eq('game_id', g.id);
  const totals: Record<string, number> = {};
  for (const r of results || []) for (const [uid, pts] of Object.entries((r as any).total_points || {})) totals[uid] = (totals[uid] || 0) + Number(pts);
  let winner: string | null = null;
  let best = -Infinity;
  for (const [uid, pts] of Object.entries(totals)) if (pts > best || (pts === best && winner && uid < winner)) { winner = uid; best = pts; }
  const { data: parts } = await admin.from('readshift_participants').select('user_id').eq('game_id', g.id).eq('active', true);
  for (const p of parts || []) {
    const uid = (p as any).user_id;
    const { data: s } = await admin.from('readshift_stats').select('games_played, games_won').eq('club_id', g.club_id).eq('user_id', uid).maybeSingle();
    await admin.from('readshift_stats').upsert({
      club_id: g.club_id, user_id: uid,
      games_played: ((s as any)?.games_played || 0) + 1,
      games_won: ((s as any)?.games_won || 0) + (uid === winner ? 1 : 0),
    }, { onConflict: 'club_id,user_id' });
  }
}

/** Fire-and-forget phase notification (no user content, deduped by tag). */
async function notifyPhase(supabaseUrl: string, cronSecret: string, admin: any, gameId: string, phase: string) {
  const titles: Record<string, [string, string]> = {
    shift: ['Your answer is needed', 'A new READSHIFT round is open — submit your answer.'],
    read: ['Your Reads are needed', 'Answers are in. Guess who wrote what.'],
    reveal: ['Reveal is ready', "See who was telling, blurring, and framing."],
    completed: ['Game complete', 'The final READSHIFT results are in.'],
  };
  const t = titles[phase];
  if (!t) return;
  const { data: parts } = await admin.from('readshift_participants').select('user_id').eq('game_id', gameId).eq('active', true);
  const recipients = (parts || []).map((p: any) => p.user_id);
  if (!recipients.length) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ type: 'readshift', title: t[0], message: t[1], url: `/readshift/${gameId}`, tag: `dh-readshift-${gameId}-${phase}`, target_user_ids: recipients }),
    });
  } catch (_e) { /* non-fatal */ }
}
