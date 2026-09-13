# Slow the NFL live-sync cron from 15 to 30 minutes

## What changes
Reschedule the `nfl-live-results` cron job (job 27) from every 15 minutes to every 30 minutes during the same game windows.

**Current:** `*/15 17-23,0-5 * * 0,1,4,5` (Sun/Mon/Thu/Fri, 5pm–5am UTC)
**New:** `*/30 17-23,0-5 * * 0,1,4,5`

This halves the real-work runs during live games (~50–60/week → ~25–30/week) and halves the no-op ticks too. Live scores now refresh every 30 minutes instead of every 15 during games — a trade-off you accepted.

## How it's done
One SQL statement via the cron scheduler:

```sql
SELECT cron.reschedule(
  27,
  '*/30 17-23,0-5 * * 0,1,4,5'
);
```

Then verify:

```sql
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobid = 27;
```

## What does NOT change
- The other two NFL crons are untouched: `pickem-week-reminder-every-30-min` (job 20, every 30 min) and `nfl-chain-availability` (job 30, daily 05:10 UTC).
- The manual "Check scores" button (`runNflCheck` / `NflCheckButton`) — you can still force an immediate sync any time; this only changes the automatic cadence.
- `sync-nfl-week` behavior, scoring logic, and the per-week dedupe are unchanged.
- Outside the NFL season the job should still be disabled entirely (separate follow-up, not part of this change).

## Verification
After rescheduling, confirm job 27's `schedule` column reads `*/30 17-23,0-5 * * 0,1,4,5` and `active` is still `true`.
