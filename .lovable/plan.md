# Date availability polls ("when can everyone meet?")

Add a new kind of poll where the question is a set of candidate dates instead of text options. Members tap the dates they're free on a calendar, and the poll automatically ranks the dates everyone can make — then the winning date can become an event in one tap.

## What members will see

**Creating a poll** — the create screen starts with a choice of poll type:
- **Choice poll** (what exists today: a question + text options)
- **Date poll** — name it ("Friendsgiving"), then tap candidate dates on a month calendar. Optionally set a voting deadline.

**Voting on a date poll** — the same calendar, showing only the candidate dates. Each tap cycles a date through Yes → Maybe → No. Answers save as you go and can be changed while the poll is open.

**Results** — a ranked list of the candidate dates:
- "Everyone's free" dates highlighted at the top with a green badge
- Each date shows counts (e.g. "6 yes · 1 maybe · 1 no") and, when expanded, exactly who said what
- A "Still waiting on: …" line for members who haven't answered
- On the best date, a **Create event** button that opens the new-event form pre-filled with that date and the poll title, and links the event back to the poll

**Events page** — events created this way show a small "from poll" link back to the poll.

## Technical notes

Database (one migration):
- `polls.poll_type` check constraint extended with `'date'`; add `polls.allow_maybe` (default true) and `polls.multi_select` semantics handled by type.
- `poll_options.option_date date null` — set for date polls, `label` keeps a human-readable copy.
- `poll_votes.response text not null default 'yes'` with check `('yes','maybe','no')`; partial unique index on `(poll_id, user_id, option_id)` so a member has at most one answer per date, and existing single-choice behaviour keeps its one-row-per-poll flow.
- Existing RLS policies already cover these tables; no new policies needed beyond keeping grants intact.

Frontend:
- `src/lib/polls/availability.ts` — pure helpers: build candidate date list, tally responses per date, rank dates (all-yes first, then yes count, then fewest no, then earliest), compute non-responders.
- `src/components/polls/DateGridPicker.tsx` — month calendar for both authoring (pick candidates) and voting (cycle yes/maybe/no), 44px touch targets, keyboard accessible.
- `src/components/polls/AvailabilityResults.tsx` — ranked date results with expandable per-member breakdown.
- `CreatePollPage.tsx` — poll-type switch; date branch writes one `poll_options` row per selected date.
- `PollDetailPage.tsx` — branches on `poll_type === 'date'` to the availability voting/results UI; keeps existing choice-poll path untouched. Vote writes are optimistic with rollback.
- `EventsPage.tsx` / event create flow — accept `?date=`&`?title=`&`?pollId=` params to pre-fill and link.
- Unit tests for the ranking/tally helpers in `src/test/`.

Realtime vote refresh, member-page styling, and load timeout guards follow the existing poll patterns.
