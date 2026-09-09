# The Splendid Journey — Campaign Authoring Contract

A campaign is a single JSON package (the **CDF**) pasted into Campaign Studio
(`/journey/studio` → Import). Nothing in the engine needs to change to accept
new content — if it validates, it plays.

### Draft import vs. immutable publishing

Importing writes the **draft** of a campaign and is **destructive per slug**:
re-importing the same `campaign.slug` replaces all of that campaign's draft
content. Drafts are freely editable and only playable in Studio test runs.

**Publishing** validates the draft, bumps the version and writes an immutable
snapshot of every table into a release package. A run is pinned to the version
it started on, so publishing new content can never rewrite a journey already in
progress, and editing the draft afterwards has no effect on live runs.

## Package shape

```jsonc
{
  "campaign": {
    "slug": "the-awakening",              // required, stable, kebab-case
    "title": "The Awakening",
    "subtitle": "Book One of Mesoplasia",
    "description": "...",
    "starting_scene_key": "prologue_01",  // required, must exist in scenes
    "author": "...", "estimated_length": "3–4 hours",
    "content_notes": "...", "tags": ["mesoplasia"],
    "config": {}                           // free-form
  },
  "acts":      [{ "act_key": "act_1", "title": "The Ashen Road", "display_order": 1 }],
  "chapters":  [{ "chapter_key": "ch_1", "act_key": "act_1", "title": "...", "intro_text": "...", "display_order": 1 }],
  "scenes":    [ /* see below — the only required array */ ],
  "npcs":      [{ "npc_key": "vessa", "name": "Vessa", "title": "...", "biography": "..." }],
  "items":     [{ "item_key": "brass_key", "name": "Brass Key", "description": "...", "quest_item": true }],
  "quests":    [{ "quest_key": "q_ashes", "title": "...", "quest_type": "main",
                  "objectives": [{ "key": "find_vessa", "text": "Find Vessa" }] }],
  "locations": [{ "location_key": "greyhollow", "name": "Greyhollow", "region": "The Marches" }],
  "codex":     [{ "codex_key": "the_sundering", "title": "The Sundering", "category": "History", "body": "..." }],
  "variables": [{ "variable_key": "suspicion", "value_type": "integer", "default_value": 0 }],
  "factions":  [{ "faction_key": "wardens", "name": "The Wardens" }],
  "enemies":   [{ "enemy_key": "ash_hound", "name": "Ash Hound", "max_health": 12, "attack": 3, "armor": 0 }],
  "endings":   [{ "ending_key": "ashes", "name": "Ashes", "description": "...",
                  "artwork": "https://...", "priority": 10,
                  "spoiler_safe_label": "An ending of fire",
                  "requirements": { "type": "flag_exists", "key": "burned_the_hall" },
                  "epilogue_blocks": [{ "content": "...", "requirements": null }] }]
}
```

## Scenes

```jsonc
{
  "scene_key": "prologue_01",          // required, unique per campaign
  "chapter_key": "ch_1",
  "scene_type": "narrative",           // narrative|dialogue|exploration|combat|hub|transition|ending
  "title": "The Ashen Road",
  "subtitle": "Dusk, three days out",
  "location_key": "greyhollow",
  "background_asset": "ashen_road",    // drives atmosphere; tags also work
  "tags": ["night", "forest"],
  "entry_effects": [{ "type": "visit_location", "key": "greyhollow" }],
  "entry_conditions": null,            // see "Entry conditions and fallback"
  "auto_next_scene_key": null,         // "Continue" destination (see "Automatic transitions")
  "is_routing_node": false,            // true = invisible; chained through without display
  "is_terminal": false,                // true = run ends here
  "ending_key": null,                  // resolved endings override this
  "display_order": 1,
  "blocks": [...],
  "choices": [...]
}
```

### Blocks (ordered narrative beats)

`block_type`: `narration` · `dialogue` · `image` · `location_intro` ·
`character_intro` · `discovery` · `system_message` · `quest_update` ·
`item_received` · `relationship_update` · `codex_unlock` · `stat_check` ·
`combat` · `divider` · `transition`

```jsonc
{ "block_type": "narration", "display_order": 1, "content": "Two paragraphs\n\nseparated by blank lines." }
{ "block_type": "dialogue",  "display_order": 2, "content": "You are late.",
  "metadata": { "speaker_key": "vessa", "speaker_name": "Vessa", "emotion": "cold", "portrait": "..." } }
{ "block_type": "image",     "metadata": { "src": "...", "alt": "...", "caption": "..." } }
{ "block_type": "combat",    "content": "Ash hounds circle.",
  "metadata": { "enemy_keys": ["ash_hound"], "victory_choice_key": "...", "defeat_choice_key": "..." } }
{ "block_type": "narration", "content": "Only if you carry the key.",
  "conditions": { "type": "has_item", "key": "brass_key" } }
```

Conditional blocks are filtered **server-side** — hidden text never reaches the client.

### Choices

```jsonc
{
  "choice_key": "take_the_road",       // unique WITHIN this scene (reuse across scenes is fine)
  "choice_text": "Take the road east.",
  "description": "Faster, but watched.",
  "display_order": 1,
  "next_scene_key": "road_east_01",    // omit only for terminal scenes
  "choice_style": "standard",          // standard|dialogue|aggressive|compassionate|deceptive|investigative|skill|item|relationship|secret|major_decision
  "major_decision": false,
  "confirmation_required": false,
  "once_only": false,
  "hidden_when_unavailable": false,    // false = shown locked with locked_hint
  "locked_hint": "Requires Wits 4",
  "requirements": { "type": "stat_minimum", "key": "wits", "value": 4 },
  "effects": [
    { "type": "set_flag", "key": "took_road", "value": true },
    { "type": "increase_relationship", "key": "vessa", "value": 1, "notice": "Vessa notices." }
  ]
}
```

## Automatic transitions

`auto_next_scene_key` is the destination of a scene that has no choices. The
engine does **not** skip such a scene: it is entered, rendered and persisted
like any other, and the player moves on with the **Continue** button
(`journey_advance_scene`). Use it for prose that flows across screens.

Set `"is_routing_node": true` for an **invisible** scene that exists only to
branch. Routing nodes are never rendered — the engine evaluates their
`entry_conditions`, applies their `entry_effects` and chains straight through
to `auto_next_scene_key`. Rules the validator enforces:

- a routing node must have an `auto_next_scene_key`
- a routing node may not be `is_terminal`
- blocks and choices on a routing node are dead content (warning)

## Entry conditions and fallback

`entry_conditions` are evaluated **as the scene is entered**. If they are not
met, the engine does not stop the run — it follows the fallback chain: the
scene's `auto_next_scene_key`, then the chain onward, until it reaches a scene
whose conditions pass. Author a routing node with the alternative branch as its
`auto_next_scene_key` when you want an explicit "if not eligible, go here".

Because a blocked scene is never displayed, keep guarded content on the
destination scene rather than on the gate itself.

## Requirements

Leaf: `{ type, key, value, label }`. Group: `{ type: "all"|"any"|"not", conditions: [...] }`.

`flag_equals` `flag_exists` `flag_not_exists` · `has_item` `does_not_have_item` ·
`stat_minimum` `stat_maximum` · `variable_equals` `campaign_variable_equals`
`variable_minimum` `variable_maximum` · `relationship_minimum` `relationship_maximum` ·
`faction_reputation_minimum` `faction_reputation_maximum` · `quest_status` ·
`has_trait` `has_ability` · `level_minimum` · `previous_choice` ·
`character_alive` `character_dead` · `world_state_equals` · `codex_unlocked` ·
`location_visited` · `health_minimum`

## Effects

`set_flag` `unset_flag` · `set_variable` `increment_variable` `decrement_variable` ·
`add_item` `remove_item` · `gain_gold` `lose_gold` `gain_xp` ·
`increase_stat` `decrease_stat` · `increase_relationship` `decrease_relationship`
`set_relationship` · `increase_faction_reputation` `decrease_faction_reputation` ·
`start_quest` `advance_quest` (`step`) `complete_quest` `fail_quest` ·
`unlock_codex` `unlock_location` `visit_location` · `unlock_trait` `unlock_ability` ·
`damage_player` `heal_player` · `change_world_state` · `character_alive` `character_dead`

Add `"notice": "..."` to surface a player-facing line when the effect fires.

## Default character state

`might` `finesse` `wits` `resolve` all start at 2; health 20/20; level 1; gold 0.
Override per-campaign in `campaign.config` or via `entry_effects` on the first scene.

## Adventure encounters

Pivotal scenes can interrupt the reading flow with a server-authoritative RPG
challenge. Definitions live under `campaign.config.adventure.encounters`, keyed
by scene key, so they are captured in the same immutable release as the story.
The database rolls the d20, applies strain and rewards, persists every result,
and sets `encounter_<SCENE_KEY>_resolved` when the challenge ends.

```jsonc
"config": {
  "adventure": {
    "version": 1,
    "encounters": {
      "mine_04": {
        "encounter_key": "failing_gallery",
        "kind": "hazard", // hazard|investigation|social|combat|ritual
        "title": "The Gallery Fails",
        "objective": "Get the crew across before the supports fold.",
        "stakes": "Four rounds before the collapse decides for you.",
        "target_progress": 5,
        "max_rounds": 4,
        "max_focus": 2,
        "success_text": "The last miner clears the fall.",
        "failure_text": "You escape, but the delay leaves a cost.",
        "success_effects": [{ "type": "gain_xp", "value": 25 }],
        "failure_effects": [{ "type": "damage_player", "value": 2 }],
        "actions": [
          {
            "action_key": "read_stress",
            "label": "Read the stress lines",
            "description": "Predict which brace gives way next.",
            "stat": "wits",
            "difficulty": 11,
            "risk": "measured", // measured|bold|desperate
            "focus_cost": 0,
            "success_progress": 2,
            "costly_progress": 1,
            "costly_damage": 1,
            "setback_damage": 2
          }
        ]
      }
    }
  }
}
```

Roll resolution is `1d20 + stat + roll_bonus` against `difficulty`. Meeting the
target is a clean success; missing it by three or fewer is progress with a cost;
anything lower is a setback. A natural 20 adds one progress. `focus_cost`
spends the encounter's limited Focus, so every encounter should include at
least one zero-cost action. Encounters fail forward: reaching the round limit
applies failure effects and opens the story instead of trapping the run.

To make the challenge mandatory before its authored consequence choices, add
this requirement to those choices:

```json
{
  "type": "flag_exists",
  "key": "encounter_mine_04_resolved",
  "label": "Resolve the failing gallery first"
}
```

## Endings and epilogues

When a run reaches a terminal scene the engine resolves the ending by
**highest `priority` among endings whose `requirements` pass** against the final
state; the scene's own `ending_key` is the fallback when nothing qualifies.

The ending screen then shows:

- `name`, `description` and `artwork` of the resolved ending
- the `epilogue_blocks` whose own `requirements` pass — filtering happens
  server-side, so passages the player did not earn never reach the client
- a **spoiler-safe recap**: only the choices the player actually made
  (`major_decision` ones first), taken from the run's choice history — never
  paths not taken

## Validation gates (must pass before publish)

- `starting_scene_key` exists
- every `next_scene_key` / `auto_next_scene_key` resolves to a real scene
- no non-terminal scene without choices and without `auto_next_scene_key` (dead end)
- scene keys are unique, and choice keys are unique **within each scene**
- routing nodes have a destination and are not terminal
- combat blocks name real enemies and real outcome choices
- scene `ending_key` values resolve to a real ending

## Authoring tips

- One scene ≈ one screen. 2–5 blocks, 2–4 choices reads best on mobile.
- Prefer `locked_hint` over hiding — visible locks make progression legible.
- Keep keys stable across drafts; renaming a key breaks in-flight runs.
- Ship content in slices (act by act). Import is idempotent per slug.
