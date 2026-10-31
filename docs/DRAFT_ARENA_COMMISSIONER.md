# Draft Arena commissioner workspace

Open **Draft Arena → Manage**. The workspace is scoped to the selected season and the member's active club. A season's commissioner and an app administrator who belongs to that club can manage it. Following a link to an older season checks that season's commissioner, rather than borrowing access from the current season.

## Commissioner guide

- **Inbox:** review open pick disputes, missing or incomplete saved reports, long-waiting turns, and playoff topic selections. Each item opens the relevant draft or review. A waiting turn is an indication to investigate; it does not automatically pass a player.
- **Points:** inspect each player's original placements, counted best-of results, dropped results, bonuses and penalties. Preview the effect before removing a draft or adding a points adjustment. Enter a reason before saving. Removing a draft from the season keeps the draft and original report intact.
- **Disputes:** compare the original pick, saved rating explanation and player's argument. An AI re-evaluation follows the existing independent-pick judging rules. A rejection or dismissal keeps the score; the commissioner's explanation is saved. AI availability and quotas still apply.
- **Planner:** save future topics, dates, scope instructions and reusable draft presets. Dates describe the plan; reminders are sent explicitly through the provided action. A sent reminder is a real in-app notification, with a saved delivery record. This is not an email or an automatic scheduled send.
- **Participation:** review recorded participation, completed drafts, picks and skipped turns. The board does not expose private draft desk notes or infer how long a player actively spent making a decision.
- **Playoffs:** inspect qualification progress, missing reports and the current bracket's next required action. Existing playoff advancement and topic selection remain authoritative.
- **History:** see the actor, reason, timestamp, and saved before/after details of commissioner changes. Recent history is shown in the workspace; the persisted audit ledger remains available beyond the displayed window.
- **Season tools:** attach an eligible regular draft, transfer the commissioner role, or open season history. Removing a draft uses the Points preview. Live Draft rooms remain separate from the regular-season ledger.

## Understanding points

Regular-season placement awards remain **10 / 7 / 5 / 3 / 2 / 1** for first through sixth and below. Only the configured best number of finishes count toward base season points. Wins, podiums, average finish (lower first), and average score resolve seed order after season points. Players may share a displayed points rank while their seed order differs.

A commissioner's bonus or penalty applies to season points through a separate adjustment ledger. It does not change a pick's judged score, its draft placement, or the club's overarching DH score. Revoking an adjustment retains its original record and saves the revocation reason. Rebuilding standings applies every active adjustment again, so adjustments cannot disappear during normal recalculation.

If a player has no remaining regular-season results after a draft is removed, their regular-season standing is removed. Their adjustment history stays saved and can apply again if an eligible result is added. Playoff seeds and elimination state remain fixed once the bracket is underway. Archived seasons keep their history and reject structural changes.

## Implementation and verification

`draft_commissioner_workspace` returns persisted plans, presets, adjustment history, recent audit records and reminder receipts after a server-side role check. Public draft, report and participation reads use the existing club and member visibility policies. Private draft desk data is never loaded.

`draft_commissioner_mutate` serializes changes for a season, checks the actor and target club, validates payloads, and commits the change and audit entry in one transaction. Requests carry an idempotency UUID; replaying the same saved request returns its existing receipt. Versioned plan and preset edits reject stale writes. Reminder delivery checks the actual current turn/topic owner and enforces a cooldown.

`recalculate_draft_season_standings` replaces three independent client/edge calculations with one atomic calculation. It preserves standing IDs and locked bracket state. Original grading validation and standalone judging instructions remain unchanged. The report and dispute edge functions must be deployed together with the database migration and source update.

Browser checks use local fixture data and real production components. Database authorization and transaction tests run against an isolated PostgreSQL-compatible database. Production verification reads schema and function metadata; test actions do not change live members' results or send them notifications.
