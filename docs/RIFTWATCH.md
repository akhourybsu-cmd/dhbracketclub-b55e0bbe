# Riftwatch

Riftwatch is a single-player formation shooter on the DH Pocket. Open it from Compete or insert its cartridge. Eject returns to the shelf. Return to DH powers off the handheld. A club administrator can install and enable Riftwatch from the existing asset library. Public Practice is available at `/riftwatch/practice`.

## Flight controls and scoring

Move left or right with the D-pad, arrows or A/D. Hold the handheld A button, Z, Space or Enter to fire. Handheld B, X or Shift spends a charged Eden Pulse to clear nearby shots and interrupt dives. Menu or Escape pauses the simulation. Players can toggle sound, high contrast and reduced motion. Changing display preferences never changes ranked rules.

Flickers, Slivers, Heralds and Divers are worth 10, 20, 35 and 50 base points. A Rift Anchor appears every fifth wave and awards 500 base points plus 50 times the wave number. A kill inside the 135-tick chain window raises the multiplier in quarter steps up to 2×. Wave clears award 200 times the wave number, a damage-free wave adds 150 times the wave number, and each surviving ward cell adds 5. Wards retain damage between waves and receive partial repairs after anchors. A hull loss or crossing the defense line can end a run.

## How ranked results are produced

The cartridge registry supplies metadata and lazy loading. The server registry maps the game key and immutable rules version to a verifier. The renderer, sound and controls are presentation modules. Browser and Edge execute the same integer simulation at 60 ticks per second. A ranked run records changes to the held-input mask. Pausing stops simulation ticks.

1. The client asks the `arcade-run` Edge Function for a ticket. Supabase Auth validates the bearer token. The start RPC checks membership, visibility and installation, applies the start rate limit, and issues the seed and a two-hour expiration. A request ID makes the start retryable.
2. At game over, the client saves the input changes and its claimed summary on the device before submission. A lost response can be retried using the original recording. Practice has its own local best and never submits.
3. The verifier claims the owned session with a short lease. It checks the replay bounds, elapsed server time, encoding, terminal state and exact score, wave, kills and duration. A verified finish writes the score and its receipt in one transaction. A replay digest permits identical retries. The database retains the digest and receipt; the server discards the raw input stream. A rules change needs a new version and validator.
4. The board ranks each member's best verified run by score, wave, earliest achievement and score ID. Day and Monday-start week boundaries use America/New_York. The response includes the top 25 and up to two rows on either side of the member. Ranks and personal bests come from PostgreSQL. Browser queries are scoped by account as well as club, game, rules and period.

## Release and maintenance

The original preflight used npm on a clean `main` at `8f847a3f0515256de9522302365737b620c16c5e`, matching `origin/main` on `akhourybsu-cmd/dhbracketclub-b55e0bbe`. The baseline passed typechecking, member lint, 3,058 unit tests, the production build and the handheld Chromium/WebKit checks. DH Pocket supplies cartridge hosting. Club assets, membership and public profiles supply access and identity. Other games retain their existing scoring systems.

- Migration [20261128180000_arcade_scores.sql](../supabase/migrations/20261128180000_arcade_scores.sql) adds the cartridge catalog entry, versioned rulesets, run tickets, immutable score rows, grants, RLS and RPCs. Apply through the linked project's normal migration workflow before enabling ranked play.
- Deploy [arcade-run](../supabase/functions/arcade-run/index.ts) with its [shared modules](../supabase/functions/_shared/arcade) to the project's linked Supabase environment. The function performs its own token verification through Supabase Auth. Keep its service credential on the server.
- `node scripts/test-arcade-db.mjs` exercises the migration in disposable PostgreSQL. Run `npm run typecheck`, `npm run lint:member`, `npm run test:unit -- --maxWorkers=1` and `npm run build` for application checks.
- A rollback is available at [riftwatch_arcade.sql](rollback/riftwatch_arcade.sql). Archive scores and remove the deployed function before retiring the platform. The script refuses to remove shared tables if another cartridge has registered its ruleset.

With a Supabase CLI linked to the DH project, `supabase db push --dry-run` shows pending migrations. After reviewing the list, `supabase db push` applies them and `supabase functions deploy arcade-run --project-ref wnurxuvwljjbwmtoeqnm` deploys the verifier. On a Lovable-managed publish, check migration history and the deployed function separately. An unauthenticated POST to `/functions/v1/arcade-run` should return the handler's JSON `unauthorized` response. That probe checks the function boundary. A signed-in member of an enabled club is required to verify the full production ranked path.
