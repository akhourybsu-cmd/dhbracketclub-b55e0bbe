# Draft Arena LIVE

LIVE is a dedicated event experience within the existing Draft Arena asset. It uses the same draft IDs, permissions, picks, snake order, shared clock and saved reports.

## Destinations

| Destination | Purpose |
| --- | --- |
| `/drafts/live` | Host an event, enter a room code, resume a room, or open a finished event. |
| `/drafts/live/create` | Fixed LIVE setup: Topic, Rules, Stage, Review. Clock and Presentation have focused subviews. |
| `/drafts/live/:draftId` | Green Room, order ceremony, event controls, player entrance and final report. |
| `/drafts/:draftId/kiosk` | Existing authenticated projector, kept full-bleed outside the Arena shell. |

Existing live invitations under `/drafts/:draftId` open the dedicated LIVE experience. A regular draft entered through a LIVE path returns to its regular destination. Magazine links preserve the event's LIVE navigation context.

The LIVE hub has a permanent menu entry, a distinct broadcast stage, an explicit LIVE marker and one room-list scroller. It refreshes from draft changes and when returning to the tab. Hosting follows the existing live-draft flag; existing events remain accessible through their original permissions.

## Setup and sharing

Creation retains the existing settings and 90-second default, and creates a setup room. It does not launch the clock or reveal the order. In the Green Room, the roster and connection indicator reflect actual data. Joining, configuring and starting remain separate actions; at least two players are required to start.

The Green Room keeps its main actions outside the roster/sharing scroller. Private planning remains available through My desk before play. The projector is optional.

Player invites open `/drafts/live/:draftId`; projector links open `/drafts/:draftId/kiosk` in a separate tab. Visible invite links stay relative so previews remain local; copied/shared links follow the existing `https://dryhorse.app` canonical policy.

Five-character room codes resolve through the authenticated Supabase client, filtered by club, live mode and exact code. Lookup opens the player room and does not insert a participant. Players must use the existing Join Draft action, including season eligibility and setup guards. Codes are identifiers, not guest-access tokens. Invalid or inaccessible lookups share one unavailable message.

Pre-draft settings atomically save `live_settings` and `ceremony_enabled` on the same matching club/draft row while its status is setup. This lets a host enable or disable the ceremony after creation. A room that has already started rejects that setup write. In-progress settings continue through the existing live host hook.

## Host, player and projector

Hosts retain their clock, pause/resume, extension, reset, skip and settings controls. The default live host workspace exposes those controls. Players explicitly select Enter live draft to open their private Player screen; hosts enter on Host and players on Board. Native fullscreen requires its named action. Phone audio starts off and can be enabled locally, subject to the shared sound setting.

The Player screen traps focus, supports a nested pick composer, and returns to the event through Back to event. The composer focuses its pick input. Wake lock and fullscreen ownership are released when leaving the screen. Reopening establishes a fresh reveal baseline and does not replay picks from the closed screen.

Order reveals retain the persisted host-controlled ceremony fields. Pick announcements on phones are docked away from the clock and pick action; the projector retains the full cinematic presentation. Completed events display their real report readiness and persisted final results. Motion respects reduced-motion preferences.

The ceremony now gives the current position and player a central stage, with real reveal progress and a separate keyboard-accessible lineup scroller. Its footer remains visible for a 20-player room; short landscape layouts place the current player beside the lineup. No animation advances the persisted reveal or starts a clock.

Host pass confirmation is tied to the current slot, can be cancelled and expires when the turn changes. Pending host commands cannot be duplicated before busy state renders. An auto-skip closes the old player's open composer even when no new pick row arrives. Realtime updates preserve unsaved settings and valid hub cards; failures provide retry feedback without discarding those views. IME confirmation does not publish unfinished picks or desk ideas.

## Verification

The browser harness retains the existing Arena matrix and adds a full two-actor lifecycle. Host and player pages share canonical browser-local table snapshots and mocked realtime changes while retaining separate write logs. The journey creates an event, checks player/projector links, saves settings, turns ceremony off and back on, joins by code, verifies host-only reveal controls, begins play and observes a canonical pick from both actors.

Small-phone and landscape checks cover LIVE setup, fixed Green Room actions, player entry and normal-draft route compatibility. The real standalone projector continues to read saved reports. Tests make no live account writes; no schema, policy or scoring migration is included.

The completed suite passes 1,146 unit tests across 139 files and 475 browser checks, including the prior 398-check matrix. App TypeScript, the production build and scoped lint pass. The asset audit reports zero missing references; 40 protected core declarations remain unchanged. Composer-entry and host-command UI bindings add slot/pending guards while retaining the original canonical callbacks, permissions and payloads. Protected clock, judging and report files retain the previous preservation guarantees.
