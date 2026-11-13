# Lineup Drafts

Lineup is a separate asynchronous experience inside Draft Arena: `/drafts/lineup`, `/drafts/lineup/create`, and `/drafts/lineup/:draftId`. It shares authentication, the installed `draft-arena` asset, clubs, competitions, drafts, participants, picks, notifications, result persistence and season records. Classic and LIVE remain distinct entrances in the shared format selector.

## Play

Choose Breakfast Club, Fictional Football, Starting Eleven, Dream Band, The Heist, Dream Cast, or a custom lineup. Every template can be customized. A lineup has 2–20 named slots with optional role guidance. Each player receives the same frozen requirements; the number of slots determines the number of rounds.

The host opens a club lobby, shares its link, and starts with at least two players. The server shuffles the roster and runs the normal snake order. On each turn a player picks any open role, enters their selection, and submits. Taken selections remain unavailable to everyone. A saved selection occupies exactly one of its owner's slots. Role assignment is independent of the round in which it was chosen.

My lineup, other players' lineups, selection history, per-slot scores and final results remain available from the same room. An owner or authorized host can correct pick text during play; its role and selection number remain fixed. Completed selections are immutable. A host can cancel an abandoned game while preserving its records. There is no countdown or automatic skipped turn in Lineup; Classic/LIVE timing is unchanged.

Completed games use the existing judge and stored report. Each selection receives 1–10 ratings for individual merit and assigned-role fit. Trusted code calculates `round(0.6 × merit + 0.4 × role_fit, 1)` and sums these scores. Explanations show the axes and weights. Team summaries can describe the whole lineup, without a hidden composition bonus or penalty. Classic judging instructions retain standalone scoring. Season assignment remains available through the existing commissioner tools rather than a second league system.

## Interface and recovery

The hub has room filters, a current-turn action and illustrated template cards. Setup has three stages, editable role tiles and an explicit review. The room emphasizes image-forward role cards and has no horizontal page scrolling. Existing keyboard-safe portaled picking and 16px fields are retained; occupied slots cannot be selected. Themes, reduced motion, keyboard controls, focus outlines and 44px controls use the Arena's existing system.

An unconfirmed create or room action retains its scoped UUID and exact payload. A lost acknowledgement can be retried after navigation or reload without another draft/pick. Pending picks become read-only and explicitly identify the saved selection; a retry cannot silently submit newly edited text. Confirmed SQL rejections unlock correction. Sign-out clears scoped recovery storage. Authoritative reads have timeouts, retry controls and bounded optional artwork batches; realtime changes and polling reconcile other devices. Artwork is enriched in the existing report batch rather than a new per-keystroke AI request.

The completed room can prefill a new draft with the same custom roles and topic. Legacy `/drafts/:id`, magazine and projector links redirect Lineup records to their dedicated room, keeping old notifications and season links usable. Classic room discovery omits Lineup rooms.

## Backend

See [database protocol](DRAFT_LINEUP_DATABASE.md) and `20261112190000_draft_lineup.sql`. `draft_lineup_action` atomically implements create, join, leave, start, pick, edit and cancel. Club membership, installation, authorization, payload sizes, budgets, turn state, duplicate selections and slot availability are checked in PostgreSQL. Row/advisory locks, uniqueness constraints and server-only receipts handle competing requests. No client-provided score, winner, turn owner or round number is accepted.

Invoker triggers block direct Lineup writes through permissive legacy policies. A private definer check prevents a hidden foreign parent from bypassing that guard. Started configuration and roster are frozen. Result records must contain the correct `lineup_v1` scoring marker and exact frozen slot/pick mapping, so an older deployed standalone judge fails safely rather than saving the wrong scoring mode. Existing club read policies are reused; actions additionally require the installed asset.

## Verification and delivery

The local SQL suite passed 24 groups against the real migration and original duplicate/season triggers; the existing commissioner suite passed 31 checks. PGlite serializes its connection, so this does not claim a native multi-session contention benchmark. Row locking and unique constraints are the production safeguards.

The additive migration was applied to the connected production database and recorded in `supabase_migrations.schema_migrations`. Its exact stored SQL matches repository MD5 `db51bd6b44ba10ab7f142c5aa2663bc9` and SHA-256 `4f1c65ec2d59d7abfd122511f86cf1d23c5285e51df0679ba90c19913bbc3a8f`. Verification confirms the authenticated-only action RPC, five scoped table triggers, receipt RLS with no client read/write grant, and 93 existing Classic drafts with no Lineup config.

Local verification passed application-project TypeScript, scoped Lineup lint, member lint, the production build, and 251 test files / 2,691 unit tests. The existing mobile browser suite passed 105 Chromium checks. New Lineup browser journeys and their Chromium/WebKit workflow are implemented but have not executed: local permissioned browser attempts and subsequent GitHub write attempts were cancelled. No completed Lineup browser or physical iPhone verification is claimed.

The grading edge bundles (`rate-draft`, `resolve-pick-dispute`, `check-draft-pick`, `draft-missed-picks`) still require deployment in addition to frontend hosting. Their existing public OPTIONS responses include `X-DH-Lineup-Rules: lineup_v1` for read-only deployment verification; authentication is unchanged. The database migration is applied, while source push, Lineup browser CI, edge deployment and public-host verification remain outstanding. Existing games retain their prior behavior; the new report guard safely rejects an old standalone judge for Lineup records.
