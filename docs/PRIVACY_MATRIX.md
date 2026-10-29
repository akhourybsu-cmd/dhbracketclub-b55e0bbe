# Privacy & Access Matrix

Generated from `pg_policies` on the live database. Each row summarizes who can perform each action on a table according to current Row-Level Security policies.

Legend: **🌐 Anyone** = anonymous + authenticated. **Owner** = `auth.uid() = user_id`. **Club member / admin** = membership-gated. **Admin** = `is_app_admin` / `is_platform_owner`.

| Table | SELECT | INSERT | UPDATE | DELETE | ALL |
|---|---|---|---|---|---|
| `activity_feed` | Admin + Club member | Admin + Club member | — | — | — |
| `admin_audit_log` | Admin | Conditional | — | — | — |
| `admin_logs` | Pool admin | Pool admin | — | — | — |
| `admin_notes` | — | — | — | — | Admin |
| `ai_rate_limits` | — | — | — | — | Conditional |
| `announcements` | Admin | — | — | — | Admin |
| `app_feature_flags` | Conditional | — | — | — | Admin |
| `bracket_picks` | Admin + Club member + Pool member | Owner | Owner | Owner | Admin + Club member |
| `brackets` | Admin + Club member + Pool member | Owner | Owner | — | Admin + Club member |
| `channel_categories` | Admin + Club member | — | — | — | Admin + Club member |
| `channel_read_states` | Admin + Owner | Owner | Owner | — | Admin + Owner + Club member |
| `channels` | Admin + Club member | Conditional | — | Admin | Admin + Club member |
| `club_installed_assets` | Owner + Club member | — | — | — | Admin + Owner + Club member |
| `club_members` | Admin + Club member | — | — | — | Admin + Club admin |
| `dh_feat_accounts` | Owner | — | — | — | — |
| `dh_feat_catalog` | Authenticated | — | — | — | — |
| `dh_feat_progress` | Owner | — | — | — | — |
| `dh_feat_unlocks` | Owner | — | — | — | — |
| `club_requests` | Admin | Conditional | Admin | — | — |
| `clubs` | Admin + Club member | Admin | Admin + Club admin | — | — |
| `competitions` | Admin + Club member | Conditional | Admin | Admin | Admin + Club member |
| `draft_participants` | Admin + Club member | Owner | Admin | Admin | Admin + Club member |
| `draft_pick_disputes` | Admin + Club member | Owner | Admin | Admin | Admin + Club member |
| `draft_picks` | Admin + Club member | Admin + Owner + Club member | Admin + Owner + Club member | Admin + Owner + Club member | — |
| `draft_playoff_matches` | Admin + Club member | — | — | — | Admin + Club member |
| `draft_results` | Admin + Club member | Admin | Admin | Admin | Admin + Club member |
| `draft_season_entries` | Admin + Club member | — | — | — | Admin + Club member |
| `draft_season_standings` | Admin + Club member | — | — | — | Admin + Club member |
| `draft_seasons` | Admin + Club member | — | Admin + Owner | — | Admin + Club member |
| `drafts` | Admin + Club member | Admin + Club member | Admin + Club member | Admin + Club member + Club admin | — |
| `event_comments` | Admin + Club member | Owner | — | Owner | Admin + Club member |
| `event_rsvps` | Admin + Club member | Owner | Owner | Owner | Admin + Club member |
| `events` | Admin + Club member | Conditional | Admin | Admin | Admin + Club member |
| `game_external_mappings` | Conditional | — | — | — | — |
| `game_state_history` | Conditional | Pool admin | — | — | — |
| `games` | Conditional | — | Pool admin | — | — |
| `invite_codes` | — | — | Conditional | — | Admin + Club member + Club admin |
| `item_enrichments` | Conditional | Admin + Owner | Admin + Owner | Admin + Owner | — |
| `lockbox_attempts` | Admin + Club member | Conditional | Conditional | — | Admin + Club member |
| `lockbox_guesses` | Admin + Club member | Owner | — | — | Admin + Club member |
| `lockbox_locks` | Admin + Club member | Owner | Owner | — | Admin + Club member |
| `lockbox_scores` | Admin + Club member | Owner | Owner | — | Admin + Club member |
| `lockbox_weeks` | Admin + Club member | — | — | — | Admin + Club member |
| `lore_contributions` | Admin + Club member | Owner | Owner | Admin + Owner | Admin + Club member |
| `lore_entries` | Admin + Club member | Conditional | Admin | Admin | Admin + Club member |
| `lore_reactions` | Admin + Club member | Owner | — | Admin + Owner | Admin + Club member |
| `message_link_previews` | Admin + Club member | Owner | — | — | Admin + Club member |
| `message_reactions` | Admin + Club member | Owner | — | Owner | Admin + Club member |
| `messages` | Admin + Club member | Owner | Admin + Owner | Admin + Owner | Admin + Club member |
| `nexus_boosts` | Conditional | — | — | — | — |
| `nexus_mission_calibrations` | Conditional | Admin | Admin | Admin | — |
| `nexus_mission_drafts` | Admin | Admin | Admin | Admin | — |
| `nexus_operation_contributions` | Conditional | — | — | — | — |
| `nexus_operation_runs` | Conditional | — | — | — | — |
| `nexus_operations` | Conditional | — | — | — | Admin |
| `nexus_progress` | Owner | Owner | Owner | — | — |
| `nexus_runs` | Authenticated | Owner | — | — | — |
| `nexus_salvage_ledger` | Owner | — | — | — | — |
| `nexus_salvage_wallet` | Owner | — | — | — | — |
| `nexus_sigils` | Conditional | — | — | — | — |
| `nexus_user_boosts` | Owner | — | — | — | — |
| `nexus_user_sigils` | Conditional | — | — | — | — |
| `nfl_games` | Conditional | Admin | Admin | Admin | — |
| `nfl_picks` | Admin + Club member | Owner | Admin + Owner | Owner | — |
| `nfl_season_standings` | Admin + Club member | — | — | — | Admin |
| `nfl_seasons` | Conditional | Admin | Admin | Admin | — |
| `nfl_teams` | Conditional | Admin | Admin | Admin | — |
| `nfl_tiebreakers` | Admin + Club member | Owner | Admin + Owner | — | — |
| `nfl_weekly_standings` | Admin + Club member | — | — | — | Admin |
| `nfl_weeks` | Conditional | Admin | Admin | Admin | — |
| `notification_preferences` | Owner | Owner | Owner | — | — |
| `platform_assets` | Conditional | — | — | — | Owner |
| `poll_options` | Admin + Club member | Conditional | Conditional | Conditional | Admin + Club member |
| `poll_votes` | Admin + Club member | Owner | — | Owner | Admin + Club member |
| `polls` | Admin + Club member | Conditional | Conditional | Conditional | Admin + Club member |
| `pool_members` | Pool member | Owner | — | Pool admin | — |
| `pools` | Admin + Club member + Pool member | Conditional | Pool admin | Pool admin | — |
| `post_comments` | Admin + Club member | Owner | Owner | Owner | Admin + Club member |
| `posts` | Admin + Club member | Owner | Owner | Owner | Admin + Club member |
| `profiles` | Conditional | Owner | Owner | — | — |
| `provider_configs` | Admin | — | — | — | — |
| `push_subscriptions` | Owner | Owner | Owner | Owner | — |
| `push_throttle` | — | — | — | — | Conditional |
| `pw_accolades` | Admin + Owner + Club member | — | — | — | Admin |
| `pw_challenges` | Admin + Owner + Club member | — | — | — | Admin |
| `pw_entries` | Admin + Owner + Club member | Owner + Club member | Owner | Owner | Admin |
| `pw_picks` | Admin + Owner + Club member | — | — | — | Admin + Owner |
| `pw_price_snapshots` | Admin + Owner + Club member | — | — | — | Admin |
| `ranking_items` | Admin + Club member | Conditional | Conditional | Authenticated | Admin + Club member |
| `ranking_submission_entries` | Admin + Club member | Owner | Owner | Owner | Admin + Club member |
| `ranking_submissions` | Admin + Club member | Owner | Owner | Owner | Admin + Club member |
| `rankings` | Admin + Club member | Conditional | Conditional | Conditional | Admin + Club member |
| `reactions` | Admin + Club member | Owner | — | Owner | Admin + Club member |
| `rune_delve_active_quests` | Owner | Owner | Owner | — | — |
| `rune_delve_bestiary` | Owner | Owner | Owner | — | — |
| `rune_delve_class_progress` | Admin + Club member | Owner | Owner | — | — |
| `rune_delve_daily_runs` | Admin + Club member | Owner | Owner | — | — |
| `rune_delve_daily_streaks` | Owner | Owner | Owner | — | — |
| `rune_delve_dungeons` | Conditional | Admin + Authenticated | — | — | — |
| `rune_delve_failure_rewards` | Owner | Owner | Owner | — | — |
| `rune_delve_heroes` | Admin + Club member | Owner | Owner | — | — |
| `rune_delve_levels` | Conditional | Admin + Authenticated | Admin | Admin | — |
| `rune_delve_loadouts` | Owner | Owner | Owner | — | — |
| `rune_delve_progress` | Admin + Club member | Owner | Owner | — | — |
| `rune_delve_quest_definitions` | Conditional | — | — | — | — |
| `rune_delve_relic_unlocks` | Owner | Owner | Owner | — | — |
| `rune_delve_runs` | Admin + Club member | Owner | Owner | — | — |
| `rune_delve_wallet` | Owner | Owner | Owner | — | — |
| `scoring_rules` | Pool member | Pool admin | Pool admin | — | — |
| `standings` | Pool member | Pool member | Pool member | — | — |
| `standings_snapshots` | Pool member | Pool admin | — | — | — |
| `sync_events` | Admin | — | — | — | — |
| `sync_runs` | Admin | — | — | — | — |
| `teams` | Conditional | — | — | — | — |
| `tournaments` | Conditional | — | — | — | — |
| `user_roles` | Admin + Owner | Conditional | Conditional | Conditional | — |

## Tables without RLS (DANGER)
None — every public table has RLS enabled.

## How to regenerate
This matrix is built from `pg_policies`. Re-run the helper script in `scripts/build-privacy-matrix.sh` after any policy migration.
