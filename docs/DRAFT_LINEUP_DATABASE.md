# Lineup Draft database protocol

Migration: `supabase/migrations/20261112190000_draft_lineup.sql`.

Lineup Drafts reuse `competitions`, `drafts`, `draft_participants`, `draft_picks`, `draft_results`, notifications, activity and season membership. This migration does not create a second draft engine, user directory, club registry, score system or notification service. It does not rewrite existing Classic/Live records or existing scoring functions.

## Persisted format

`drafts.draft_format` defaults to `classic`; a Lineup Draft uses `lineup`. `lineup_config` is null for Classic/Live and contains this immutable version-one shape for Lineup:

```json
{
  "version": 1,
  "template_id": "breakfast",
  "slots": [
    { "id": "drink", "label": "Drink", "description": "Something to drink." },
    { "id": "main", "label": "Entrée" }
  ]
}
```

There are 2–20 slots, with unique lowercase IDs up to 48 characters. Labels are trimmed, 1–36 characters; descriptions are optional strings up to 120 characters. `num_rounds` is the slot count. Lineups are asynchronous and cannot set `is_live`. `draft_picks.lineup_slot_id` identifies the fixed slot; partial unique indexes enforce one pick per member/slot and one global pick number. Classic picks have no lineup slot.

The existing `setup → in_progress → complete` lifecycle remains. Lineups additionally allow `cancelled`; Classic/Live cannot use that status. Cancellation retains the roster, saved selections and receipts, closes the competition and produces no completed result. Physical deletion of a Lineup Draft or its picks is rejected. A host can cancel an abandoned draft when a member leaves.

## Authoritative actions

```sql
public.draft_lineup_action(
  p_club_id uuid,
  p_draft_id uuid,
  p_request_id uuid,
  p_action text,
  p_payload jsonb default '{}'
) returns jsonb
```

The response is `{draft_id, action, replayed}` and includes `pick_id` for a saved or corrected pick. Create uses a null `p_draft_id`.

| Action | Payload | Effect |
| --- | --- | --- |
| `create` | `topic`, optional `description`/`ai_context`, `lineup_config` | Atomically creates competition, draft, host seat and activity. Description belongs to `competitions`, not `drafts`. |
| `join` / `leave` | `{}` | Changes the caller's own setup seat. The host stays on the roster. |
| `start` | `{}` | Host/authorized manager starts at least two players; the server shuffles and persists the order. |
| `pick` | `text`, `slot_id` | Validates the actual snake turn and an open slot, inserts the pick and advances/completes the draft in one transaction. |
| `edit_pick` | `pick_id`, `text` | Owner/authorized manager corrects an in-progress pick without changing its slot/turn, clearing obsolete enrichment. |
| `cancel` | `{}` | Host/authorized manager closes a setup or active draft without grading it. |

Topics/picks are bounded to 100 characters, descriptions to 200 and judging context to 1,000. A draft supports at most 24 players. A member may create eight lineups per hour and maintain ten open lineups. New actions are bounded to 120 per minute; exact retries do not consume that budget.

The RPC locks active membership and installation rows, serializes each actor's new actions and each request key, and locks the draft before calculating turn state. Existing normalized duplicate-pick protection remains. The server computes pick numbers, rounds, snake order and completion. No client score, result, turn owner or round number is accepted. There are no skip/clock mutations in this format.

`draft_lineup_receipts` is server-only, RLS-enabled and inaccessible to authenticated/anonymous table queries. An exact request retry returns its original IDs even after completion; reusing its key with altered action, target or payload is rejected. Side effects such as completion activity and turn notifications are committed once with the receipt. Clients should retain the same request ID while retrying an unconfirmed action and refresh authoritative records after acknowledgement.

## Authorization and grading boundary

Every action requires authenticated, active membership in the current club and an installed, enabled, visible Draft Arena asset. Private accounts cannot enter shared club activity through stale membership. Nonparticipants cannot make picks. Existing season eligibility triggers continue to enforce a locked season roster; its authorized commissioner can manage an assigned lineup.

Invoker triggers reject direct Lineup writes even when permissive legacy club policies would allow them. Trusted RPC execution inherits the function owner's database role; an authenticated caller cannot forge that role with a custom setting. A small definer helper rejects direct child writes by actual parent ID before an RLS-hidden foreign parent could be mistaken for a Classic draft. It returns no parent records. Classic/Live writes return through their existing paths.

Started configuration, scope and roster are frozen. Saved slots never change owners, slots or turn numbers. Completed selections cannot be edited. Result writes are restricted to trusted server operations after completion. Every stored rating must carry `scoring_version: "lineup_v1"`, the actual pick ID/text and its frozen slot ID/label; IDs must exactly cover the member's required picks. This prevents a previously deployed standalone-only grading function from silently persisting the wrong scoring mode. It does not generate a substitute score when AI is unavailable.

The migration and the slot-aware grading edge functions must be deployed together. While the old grading function remains deployed, attempts to persist an unmarked Lineup report fail safely. Existing validated grading, atomic report replacement, dispute regrading, season records and results remain the authoritative reporting path.

## Verification and rollout

`node scripts/test-draft-lineup-db.mjs` passed **24 groups** against the real forward migration and original duplicate/season triggers. Checks include malformed content; setup creation/rollback; exact and altered retries; server shuffle/snake turns; out-of-order slots; duplicate text/slots; corrections and enrichment cleanup; direct-write and cross-club injection rejection; marked report validation; cancellation; asset/club/member/private access; season compatibility; Classic/Live writes; creation limits; and repeated migration preserving completed, active and cancelled saves.

The test fixture follows the current deployed table shapes, including the absence of `drafts.description`. No production credentials, application accounts, data writes or network calls are involved. PGlite queues parallel requests; these results do **not** claim a native, multi-session PostgreSQL contention benchmark. The SQL uses real row/advisory locks and unique constraints, but native contention remains a separate verification step.

Apply the complete timestamped migration using the project's migration runner, after confirming prior Draft Arena, grading, commissioner, asset and private-session migrations. Deploy the updated grading functions, then verify the RPC signature/ACLs, five scoped triggers, receipt RLS, new constraints/indexes and saved-record preservation. This document records local verification; production migration/deployment status is recorded separately by the release coordinator.
