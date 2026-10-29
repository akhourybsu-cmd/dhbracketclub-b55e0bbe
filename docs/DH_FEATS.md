# DH Score and Feats

DH Score is an account's permanent achievement total. A club's board compares its current members' lifetime totals; monthly standings compare new, nonhistorical awards earned during the current UTC month. Scores are not spendable and do not replace game currencies, competition points or FORGE fuel.

The launch collection has **63 families, 314 tier unlocks and 18 areas**. Each family has up to five tiers: Bronze +10, Silver +20, Gold +40, Platinum +80 and Mythic +150. These are individual awards, so a full five-tier family contributes 300 DH. The four-weapon Nexus family stops at Platinum. All thresholds, copy and points are versioned in `src/lib/feats/catalog.json`; the app displays the deployed server catalog, including for older clients.

## Member experience

- `/feats` opens an immersive, animated board with Next up, Feats and Club views. It is a core account feature and requires authentication and active club membership, not a separately installed plugin.
- Next up combines up to three cloud-saved tracked goals with nearby unfinished feats. Earned feats remain visible when a club removes the source app. Tracked goals remain available to untrack across club changes; links into uninstalled apps are hidden.
- The collection supports feature and progress filters, search, adaptive pagination, exact tier requirements and progress. The primary screen fits the viewport; only optional details use internal scrolling.
- Club standings offer lifetime/monthly totals and tied ranks. Each member has one row keyed by account ID; Find me jumps to the caller's row, including a caller outside the first 100 ranks. Distinct members with the same display name remain separate. Other members' raw source metrics, workout logs, trades and private narrative content are never returned.
- DH Score cards appear in Profile and Club; the shared Account navigation includes DH Score. The shared shell refreshes the member's score on route changes and every minute. The board refreshes the club's dirty accounts every 45 seconds and on focus/manual refresh.
- New unlocks are grouped into one dismissible reveal. A server-saved viewed timestamp prevents repeated reveals across reloads/devices. Imported history appears as Saved history and is excluded from new-unlock celebrations and monthly standings.

## Authority and permanence

`20261029040000_dh_feats.sql` adds a read-only catalog, own-account preferences, progress high-water marks and immutable award receipts. Clients have no insert/update/delete access to those tables. Public RPCs validate authentication and club membership before evaluating or returning standings. Internal evaluator, metric and trigger functions have execution revoked from public/anon/authenticated.

Progress comes from saved source tables. Source writes mark affected accounts dirty through small triggers; they do not evaluate the entire app inside a game/workout/post transaction. Refresh evaluates dirty members, stores the greatest observed metric and inserts unique `(user_id, feat_key, tier)` receipts. Each receipt snapshots its point value and target. Retrying refreshes or deploying the catalog again cannot duplicate awards. Removing content or revoking workout logs does not remove an earned feat, and recreating content below a previously observed count does not add that count twice.

The evaluator locks account rows in a consistent order and skips busy account rows, so club refreshes do not wait on source writers. A skipped member is evaluated on a subsequent refresh. Home and the board refresh the same public member cohort before ranking. Source changes normally invalidate immediately; an account is also reconciled after five minutes even if an invalidation was missed. The initial migration imports existing history before the new client rolls out; historical earned timestamps are not invented. A profile-creation trigger initializes new members so their first feats count as new awards. Missing indexes on source owner columns are added while reusing existing leading-owner indexes. Manually logged workouts and other existing honor-system inputs retain their source systems' trust model: saving a log is not independent verification of physical activity.

## Important metric rules

- The Drop counts published contributions and types. Comment volume counts different other-member Drops; appreciation counts a member once per Drop regardless of emoji and excludes self-reactions. Discussion comments likewise count different posts by others. Post edits and vote changes do not create additional source items.
- General active days use stored UTC activity dates, with workout dates/trading dates where those systems supply canonical dates. READSHIFT uses nonempty locked answers and actual guesses, never passive statistics timestamps. Self-solved locks do not add active days, and missing workout dates do not create a FORGE day. General days are a conservative backfill: aggregating existing statistics cannot recreate deleted rows or every past activity date. General feature variety requires saved qualifying participation.
- Draft wins/completions require completed results and at least three scored participants. Podiums require four. Perfect Board requires at least four ratings, all eight or greater.
- Nexus results require endless ruleset 4 or later. Build variety requires five cleared waves; weapon arrays are sorted before comparing builds. Equipment ownership uses saved permanent unlocks.
- Rune Delve uses saved repeat-clear counters and recorded result statistics. Enemies and chains reflect retained result rows rather than reconstructing overwritten per-attempt history.
- FORGE excludes revoked activity and unfinished/empty freeform sessions. Repetitions, seconds/minutes and miles are evaluated independently; lifted weight is not counted as repetitions. Existing canonical distance is miles. Names identify movement variety.
- Portfolio value/profit/return require an executed trade and recorded growth above the season's own starting cash. Value milestones use actual game-dollar equity, so custom starting balances affect that family; percentage return and profit use their own starting balance as baseline.
- Big Day compares recorded value to the previous market day's snapshot, allowing weekends/market holidays but excluding gaps in recorded open market days. Intraday valuation peaks are captured in server triggers even if the next quote reverses. Green Days counts distinct positive completed market dates; it is not a consecutive-day streak. A multi-day gap cannot be passed off as one day's profit.
- Portfolio wins require completed competitions with three participants. Pending orders, starting cash and cash transfers do not count as profitable sales.
- NFL uses settled correct picks and saved Crazy Chain statistics. Brackets exclude draft entries. Lockbox excludes self-solves. Event Going feats measure RSVPs, not verified attendance.
- Narrative counts public player/character-action messages tied to characters; private/GM messages are excluded. Journey excludes studio test runs and counts saved real choices/endings without exposing spoilers.

## Private sessions

`20261029060000_private_sessions.sql` registers the designated private account by ID in a server-only registry with reversible profile/membership snapshots. It masks the display identity and moves the account, its empty pool, and its installed app setup into an isolated private club. Login credentials and global roles are preserved. Restrictive policies hide private identities, clubs and owned activity even under broad platform permissions; write guards reject public-club participation, including service/definer writes and foreign-key child activity. Private play remains available inside that workspace.

`20261029070000_dh_score_reconciliation.sql` excludes registered private accounts from both DH leaderboards, member counts and ranks. A private session can inspect its own progress without receiving a public rank. The presence directory also excludes private accounts; clients ignore unknown broadcasters and use saved directory names. When adding member-facing tables, include equivalent restrictive visibility and write guards; do not rely on frontend name filters.

## Adding a feature or feat

1. Add a stable metric key, thresholds and points to `catalog.json`. Do not reuse an existing key for a different condition.
2. Extend `dh_feat_metrics` from the feature's saved source records, and add source invalidation/peak capture where needed. Register the category's asset and route in `progression.ts`.
3. Generate the catalog seed with `node scripts/generate-dh-feats-catalog.mjs`. For future deployed changes, create a new migration rather than modifying an already deployed migration; preserve existing award receipts.
4. Extend the isolated schema fixture and PostgreSQL source/permissions/idempotency checks. Update collection and mobile QA for a new interaction.

## Validation

- `npx tsc -p tsconfig.app.json --noEmit`, scoped ESLint, `npm run test:unit`, `npm run build`.
- `node scripts/test-dh-feats-db.mjs` uses optional `@electric-sql/pglite` and the real migration against isolated source-table shapes captured from the deployed schema. Set `PGLITE_MODULE` to an installed module path if installing outside the repo. It covers repeatable deployment, all source metrics, RLS/RPC privileges, duplicate awards, thresholds, market gaps/peaks, historical import, monthly totals, tracking and receipt persistence.
- `node scripts/test-dh-private-scores-db.mjs` applies the current forward migrations and verifies reversible private isolation, broad-policy/anonymous privacy, private/public writes, child activity, presence, exact ledger totals, shared Home/board ranks, missed invalidation repair, UTC month boundaries and canonical activity dates.
- `scripts/audit-dh-scores.sql` checks every public club membership against its receipts, summary, Home, both standings periods, unique identities and shared ranks. The live reconciliation on 2026-10-29 checked 10 accounts across four clubs: no missing source/peak awards, incorrect award values, duplicate receipts, or pending accounts. All existing legitimate totals were preserved.
- `node scripts/check-dh-feats.mjs` against Vite on :8080 uses production components/hooks and actual PostgreSQL RPCs in isolated PGlite. It verifies eight viewport sizes, card/control visibility, tracking and rollback, real award reveals, reload persistence, offline retry, themes, keyboard navigation, removed-app gating and exit cleanup. No live account writes occur in QA.
