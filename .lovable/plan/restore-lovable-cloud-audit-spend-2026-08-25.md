# Restore Lovable Cloud & Audit Spend

Current state (confirmed): the Lovable Cloud backend is **paused** — all database/auth calls fail until it is resumed. This plan gets it back online, verifies migrations, and trims recurring spend so it stays within the free Cloud balance without topping up.

## Step 1 — Bring the backend back online

1. Resume the backend via the Cloud resume tool (approval-gated).
2. Poll status until it reports healthy, then smoke-test with a simple read query.
3. If resume is blocked because the monthly Cloud balance is exhausted, there is no free workaround to force it on — options are: wait for the free monthly balance to reset, or add Cloud balance. I'll report back if this happens.

## Step 2 — Verify all migrations are applied

1. Once healthy, compare the 200+ files in `supabase/migrations/` against the applied-migration history in the database.
2. The most recent files (which may not be applied if the backend paused first) are the prime suspects:
   - `20260813150000–20260813153000` (Journey art/portraits/block images storage)
   - `20260819120000_rune-delve-atomic-wallet.sql`
   - `20260821090000_ai-usage-and-controls.sql`
3. Apply any that are pending, in timestamp order.

## Step 3 — Audit recurring spend drivers

Confirmed scheduled jobs in the migrations (these keep the database busy and can prevent the free inactivity-pause):

| Job | Schedule | Purpose |
|---|---|---|
| `forge-weekly-roll` | Mon 00:00 UTC | FORGE weekly gauntlet roll |
| `forge-notify-new` / `-mid` / `-final` | Mon / Thu / Sun | FORGE notifications |
| `lockbox-daily-reminder` | Daily | Lockbox nudges |
| `finalize-lockbox-day` | Daily | Lockbox scoring |

Plus realtime publications on ~20 tables (chat, drafts, narrative, nexus, games...) — active realtime connections and frequent client polling also keep compute billed.

**Actions:**
1. Review each job in **More → Cloud → Jobs**; recommend disabling/rescheduling any that run more often than the feature needs (candidates: daily Lockbox jobs if Lockbox is rarely played).
2. Check for client-side polling loops / always-open realtime channels that hold the backend awake.
3. Check database size and connection saturation via the health snapshot to confirm nothing else is driving cost.

## Step 4 — Report & guardrails

- Summary: migration status (applied vs pending), which jobs to keep/trim, and realistic monthly spend expectation under the free $25 Cloud balance.
- Save a project-memory note with the cost posture so future work defaults to low-spend patterns (batch queries, no unnecessary polling, minimal new cron).

## Technical details

- No schema changes, no code rewrites — this is operational: resume, verify, audit, recommend.
- Cron changes happen in the Cloud Jobs UI (not raw SQL) per platform rules.
- Nothing is deleted; disabling a job is reversible.
