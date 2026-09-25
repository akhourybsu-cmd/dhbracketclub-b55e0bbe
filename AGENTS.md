# Project architecture rules

- Live Draft projector behavior is configured through `LiveDraftSettings` stored in `drafts.live_settings`, so every host device and kiosk reads one synchronized source of truth.
- Completed Live Draft reports are broadcast from persisted `draft_results`; the projector never runs or invents its own scoring.