import type { ArcadeScope, ArcadeSummary, ArcadeRunSession, ArcadeVerifiedResult } from '../_shared/arcade/contracts.ts';
import { arcadeValidators } from '../_shared/arcade/validators.ts';

export type RpcArgs = Record<string, unknown>;
export type Rpc = (name: string, args: RpcArgs) => Promise<unknown>;
export interface ArcadeActor {
  userId: string;
  memberRpc: Rpc;
  // Only used for replay claim and completion after token validation.
  trustedRpc: Rpc;
}
export interface ArcadeService {
  authenticate: (token: string) => Promise<ArcadeActor>;
  now?: () => number;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const MAX_BODY = 128 * 1024;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tag = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
const summaryKeys = ['score', 'wave', 'kills', 'simulationTicks'] as const;

export class ArcadeFailure extends Error {
  constructor(readonly code: string, readonly status: number, message: string, readonly retryable = false) {
    super(message);
  }
}

function invalid() {
  return new ArcadeFailure('invalid_request', 400, 'The run data is invalid.');
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, names: readonly string[]) {
  return Object.keys(value).every(key => names.includes(key));
}

function field(value: unknown, pattern: RegExp) {
  if (typeof value !== 'string' || !pattern.test(value)) throw invalid();
  return value;
}

async function readRequest(req: Request) {
  const tooLarge = () => new ArcadeFailure('replay_too_large', 413, 'The recorded run is too large to rank.');
  if (Number(req.headers.get('content-length')) > MAX_BODY) throw tooLarge();
  if (!req.body) throw invalid();
  const reader = req.body.getReader();
  const bytes: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      bytes.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of bytes) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined));
    if (record(parsed)) return parsed;
  } catch { /* Malformed JSON has the same public error as any invalid body. */ }
  throw invalid();
}

function toPublicError(error: unknown): ArcadeFailure {
  if (error instanceof ArcadeFailure) return error;
  const sql = record(error) ? error : {};
  if (sql.code === '42501') return new ArcadeFailure('not_eligible', 403, 'This club or cartridge is unavailable for ranked play.');
  if (sql.code === '23505') return new ArcadeFailure('different_submission', 409, 'A different submission already used this run.');
  if (sql.code === '22023' || sql.code === '22P02') return invalid();
  if (sql.code === 'P0001' && sql.message === 'rate_limited') return new ArcadeFailure('rate_limited', 429, 'Too many ranked starts. Try again shortly.', true);
  return new ArcadeFailure('unavailable', 503, 'The arcade service is unavailable. Try again.', true);
}

interface DbSession extends Omit<ArcadeRunSession, 'result'> {
  result?: (Omit<ArcadeVerifiedResult, 'isPersonalBest' | 'status'> & { newPersonalBest: boolean }) | null;
  verifyNow?: boolean;
}

function sessionFor(scope: ArcadeScope, value: unknown): DbSession {
  if (!record(value)) throw invalid();
  const session = value as unknown as DbSession;
  if (session.clubId !== scope.clubId || session.gameKey !== scope.gameKey || session.rulesetVersion !== scope.rulesetVersion) {
    throw new ArcadeFailure('not_eligible', 403, 'This run is unavailable.');
  }
  return session;
}

function resultFor(session: DbSession): ArcadeVerifiedResult {
  if (session.status === 'expired') throw new ArcadeFailure('expired', 410, 'This ranked session has expired.');
  if (session.status === 'rejected') throw new ArcadeFailure('rejected', 422, 'This replay could not be verified.');
  if (session.status !== 'verified' || !session.result) {
    throw new ArcadeFailure('pending', 409, 'Score verification is in progress. Check again shortly.', true);
  }
  const { newPersonalBest, ...result } = session.result;
  return { ...result, status: 'verified', isPersonalBest: newPersonalBest };
}

function publicSession(run: DbSession): ArcadeRunSession {
  const { runId, clubId, gameKey, rulesetVersion, seed, startedAt, expiresAt, status } = run;
  return { runId, clubId, gameKey, rulesetVersion, seed, startedAt, expiresAt, status,
    rejectionCode: status === 'rejected' ? 'rejected' : null, result: status === 'verified' ? resultFor(run) : null };
}

async function replayDigest(encoding: number, input: unknown[], summary: ArcadeSummary) {
  // Fixed field order makes key reordering and JSON whitespace irrelevant to retries.
  const text = JSON.stringify([encoding, input, ...summaryKeys.map(key => summary[key])]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function handleArcadeRequest(req: Request, service: ArcadeService): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== 'POST') throw new ArcadeFailure('method_not_allowed', 405, 'Use POST.');
    const token = /^Bearer (\S+)$/i.exec(req.headers.get('authorization') || '')?.[1];
    if (!token) throw new ArcadeFailure('unauthorized', 401, 'Sign in to play a ranked run.');
    const body = await readRequest(req);
    const scope = {
      clubId: field(body.clubId, uuid),
      gameKey: field(body.gameKey, tag),
      rulesetVersion: field(body.rulesetVersion, tag),
    };
    const validator = arcadeValidators.find(rule => rule.key === scope.gameKey && rule.version === scope.rulesetVersion);
    if (!validator) throw new ArcadeFailure('unsupported_rules', 400, 'This ruleset is unavailable. Reopen the cartridge.');
    const common = ['action', 'clubId', 'gameKey', 'rulesetVersion'];
    const actor = await service.authenticate(token);
    const scopeArgs = { p_club_id: scope.clubId, p_game_key: scope.gameKey, p_ruleset_version: scope.rulesetVersion };
    if (body.action === 'start') {
      if (!hasOnly(body, [...common, 'requestId', 'clientBuild'])) throw invalid();
      const run = await actor.memberRpc('arcade_start_run', { ...scopeArgs,
        p_request_id: field(body.requestId, uuid), p_client_build: field(body.clientBuild, tag) });
      return reply(publicSession(sessionFor(scope, run)));
    }
    const runId = field(body.runId, uuid);
    if (body.action === 'status') {
      if (!hasOnly(body, [...common, 'runId'])) throw invalid();
      return reply(publicSession(sessionFor(scope, await actor.memberRpc('arcade_run_status', { p_run_id: runId }))));
    }
    if (body.action !== 'submit' || !hasOnly(body, [...common, 'runId', 'replayEncodingVersion', 'inputEvents', 'clientSummary', 'clientBuild'])) throw invalid();
    field(body.clientBuild, tag);
    const input = body.inputEvents;
    const summary = body.clientSummary;
    if (body.replayEncodingVersion !== validator.encodingVersion || !Array.isArray(input) || input.length > validator.maxEvents ||
        !input.every(event => Array.isArray(event) && event.length === 2 && event.every(Number.isSafeInteger)) ||
        !record(summary) || !hasOnly(summary, summaryKeys) ||
        !summaryKeys.every(key => Number.isSafeInteger(summary[key]) && (summary[key] as number) >= 0) ||
        Number(summary.simulationTicks) < 1 || Number(summary.simulationTicks) > validator.maxTicks) throw invalid();
    const claimed = summary as unknown as ArcadeSummary;
    const hash = await replayDigest(validator.encodingVersion, input, claimed);
    const receiptArgs = { p_user_id: actor.userId, p_club_id: scope.clubId, p_run_id: runId, p_replay_hash: hash };
    const run = sessionFor(scope, await actor.trustedRpc('arcade_claim_run', {
      ...scopeArgs, ...receiptArgs, p_encoding_version: validator.encodingVersion,
    }));
    if (run.status !== 'submitted' || run.verifyNow !== true) return reply(resultFor(run));
    const now = (service.now ?? Date.now)();
    let verified: ArcadeSummary | null = null;
    let rejection: string | null = null;
    if (now >= Date.parse(run.expiresAt)) throw new ArcadeFailure('expired', 410, 'This ranked session has expired.');
    if (claimed.simulationTicks > Math.floor((now - Date.parse(run.startedAt) + 2000) * validator.ticksPerSecond / 1000)) {
      rejection = 'elapsed_time';
    } else {
      try { verified = validator.verify(run.seed, input, claimed); }
      catch { rejection = 'invalid_replay'; }
    }
    const saved = await actor.trustedRpc('arcade_finish_run', {
      ...receiptArgs, p_summary: verified, p_rejection_code: rejection,
    });
    return reply(resultFor(sessionFor(scope, saved)));
  } catch (error) {
    const failure = toPublicError(error);
    return reply({ error: { code: failure.code, message: failure.message, retryable: failure.retryable } }, failure.status);
  }
}
