# DH

We are building a mobile-first web app called Bracket Battle.



This app is a private March Madness bracket pool for friends. It is NOT a gambling app and should never be presented as betting, wagering, gambling, odds, or money-based competition. It is purely a fun bracket challenge app for tracking picks and standings.



For phase one, I want you to build only the foundation and MVP workflow.



Phase one scope:

- authentication

- user profiles

- private pools

- tournament data model

- bracket pick entry

- save draft

- submit bracket

- lock picks after deadline

- bracket viewing

- scoring engine based on stored game winners

- leaderboard

- admin mock result entry



Do NOT build yet:

- external sports APIs

- realtime subscriptions

- live game syncing

- online presence

- push notifications

- multiple tournaments per season beyond the base data structure

- women’s bracket UI

- yearly archives



Product vision:

A polished, modern sports-pool style app where users can create a private group, invite friends, fill out a full March Madness bracket, and see who is winning as tournament results are entered.



Primary users:

1. Pool owner / admin

2. Pool members



Core user journey:

- User signs in

- User creates or joins a pool

- User fills out a bracket visually

- User saves draft picks

- User submits bracket before lock time

- Once locked, picks are read-only

- After lock, users can compare brackets

- Admin can enter winners for testing

- Scores and leaderboard update from stored results



Design direction:

- modern sports app

- clean and energetic

- mobile-first

- dark mode by default

- polished desktop bracket view

- readable matchups

- subtle competitive feel

- original UI, not a clone of ESPN/NCAA



Important technical direction:

- Build this with Supabase

- Use row-level security

- Use clear separation between users, pools, tournaments, games, brackets, bracket picks, and standings

- Build the codebase so live APIs and realtime can be added later without rewriting the app



Very important:

Before implementing, create a clear internal plan for phase one and propose the main pages, tables, and user flows. Then begin implementing the foundation in a clean, production-minded way.



Ask clarifying questions only if something is absolutely necessary. Otherwise make the best assumptions and proceed.



Create a detailed project knowledge file for this app so future prompts stay consistent.



Include:

- product summary

- who the users are

- phase one scope

- explicit non-goals for phase one

- app terminology

- page list

- role definitions

- business rules

- bracket lock rules

- scoring rules

- data model summary

- UX principles

- guardrails to avoid gambling language

- future expansion notes for phase two and phase three



Use this as the permanent source of truth for the project.

Now implement the backend foundation for phase one using Supabase.



Set up:

- authentication with email magic link or email/password, whichever is simplest and cleanest

- user profile table

- row-level security

- tables and relationships for the phase one app



Create these tables:



1. profiles

- id

- display_name

- avatar_url optional

- created_at



2. tournaments

- id

- name

- season_year

- sport

- gender_division

- lock_time

- status

- created_at



3. teams

- id

- tournament_id

- school_name

- short_name

- seed

- region

- created_at



4. games

- id

- tournament_id

- round_number

- round_name

- region

- game_slot

- team1_id nullable

- team2_id nullable

- winner_team_id nullable

- team1_score nullable

- team2_score nullable

- scheduled_at nullable

- status

- created_at

- updated_at



5. pools

- id

- owner_user_id

- tournament_id

- name

- description nullable

- invite_code

- visibility

- lock_time

- created_at



6. pool_members

- id

- pool_id

- user_id

- role

- joined_at



7. brackets

- id

- pool_id

- user_id

- status

- submitted_at nullable

- tiebreaker_score nullable

- created_at

- updated_at



8. bracket_picks

- id

- bracket_id

- game_id

- picked_team_id

- picked_in_round

- created_at

- updated_at



9. scoring_rules

- id

- pool_id

- round_number

- points_per_correct_pick



10. standings

- id

- pool_id

- user_id

- total_points

- correct_picks

- possible_points_remaining

- rank

- updated_at



11. admin_logs

- id

- pool_id

- actor_user_id

- action_type

- action_payload jsonb

- created_at



Requirements:

- enforce one bracket per user per pool

- enforce one membership per user per pool

- users can only edit their own profile

- users can only access pools they belong to

- users can only edit their own brackets before pool lock

- pool owners/admins can manage pool settings and test results

- keep the SQL schema clean and easy to extend later



After implementing, show me a summary of the schema and security rules.



Now seed the app with realistic phase one demo data.



Create:

- one tournament called NCAA Men’s March Madness

- sample teams with seeds and regions

- a complete bracket structure covering:

  - First Four or play-in support in the schema

  - Round of 64

  - Round of 32

  - Sweet 16

  - Elite 8

  - Final Four

  - Championship



Use placeholder schools if needed, but structure the bracket exactly the way the app will need it.



Also create:

- one sample pool

- a few sample users

- sample memberships

- sample brackets

- sample picks

- sample standings



Goal:

I want to be able to click through the full product and test the flows immediately.



Now build the phase one app shell and navigation.



Create these main pages:

- landing page

- sign in page

- sign up / auth page

- dashboard

- create pool page

- join pool page

- pool detail page

- bracket entry page

- bracket detail page

- leaderboard page

- admin tools page

- profile page



Navigation expectations:

- after login, user lands on dashboard

- dashboard shows my pools and recent activity

- pool detail is the hub for one pool

- leaderboard and bracket pages should be easily accessible from the pool page

- mobile navigation should be excellent

- desktop layout should feel spacious and polished



Design goals:

- dark mode default

- sports-inspired but clean

- high readability

- subtle use of cards, tabs, segmented controls, and status pills

- bracket readability is more important than flashy effects



Do not implement live score widgets yet.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dhbracketclub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/db618edb-d8da-47d5-a69b-30b667ef4202).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
