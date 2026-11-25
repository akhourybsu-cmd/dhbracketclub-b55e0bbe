# MESOMON: PORT MARCHE
## Codex Integration Package — Lead Character and First Playable Chapter

**Target repository:** `https://github.com/akhourybsu-cmd/dhbracketclub-b55e0bbe.git`
**Target branch:** `main`
**Product:** DH Club App
**Game:** Mesomon
**Starting era and location:** Halcyon Age, Port Marche
**Story status:** An independent, explicitly non-canon story grounded in the world of Mesoplasia
**Primary platform:** Mobile web/PWA first, then desktop

---

# 1. How to use this document

This is the master build brief for Codex. Give Codex this entire file and ask it to implement the first playable Mesomon vertical slice in the repository above.

Codex should not treat this as a loose ideation document. The choices marked **LOCKED** are approved product decisions. The implementation details are the recommended defaults and should be followed unless the current repository makes a technically equivalent approach substantially safer.

The first result should be a polished, playable 15–25 minute chapter—not a broad, unfinished RPG framework.

---

# 2. Codex operating instructions

## Repository and workflow

1. Use only this repository as the source of truth:
   `https://github.com/akhourybsu-cmd/dhbracketclub-b55e0bbe.git`
2. Disregard unrelated GitHub repositories, remotes, or prior connections.
3. Read every applicable `AGENTS.md` before editing.
4. Inspect the current codebase before selecting paths, dependencies, route conventions, data-access patterns, or styling primitives.
5. Before making changes, run and record:
   - `git status --short`
   - `git branch --show-current`
   - `git remote -v`
   - the package-manager and existing test/build commands
6. Preserve all unrelated user changes. Do not reset, discard, or overwrite work that is outside this implementation.
7. Work directly on `main`, as requested by the repository owner. Do not open a pull request.
8. Never force-push.
9. Commit the completed, verified work and push directly to `origin/main`.
10. Confirm the remote branch contains the commit with `git ls-remote origin refs/heads/main` or an equivalent read-only check.
11. Treat **pushed** and **live** as separate states:
    - “Pushed” means the commit is present on `origin/main`.
    - “Live” means the deployment for that exact commit completed successfully and the production URL was opened or otherwise checked.
    - Never claim the changes are live solely because the push succeeded.
12. At handoff, report:
    - commit hash;
    - remote `main` hash confirmation;
    - tests/builds run and their results;
    - production deployment status and URL, if verifiable;
    - SQL migration file and whether it was merely committed or also applied;
    - any manual setup still required.

## Scope safety

- Add Mesomon as a self-contained, lazy-loaded game experience using the repository’s existing game-shell conventions.
- Do not redesign or alter existing shelled games as part of this work.
- Do not break or restyle unrelated DH pages.
- Scope touch/overscroll restrictions to the Mesomon route. Never disable scrolling or pull-to-refresh globally across the app.
- Do not expose Supabase service-role keys or other secrets to the client.
- Prefer existing repository primitives and dependencies when they meet the requirements below.

---

# 3. Product vision

Mesomon is an original, story-driven, top-down pixel RPG for phones. Its emotional reference point is the intimacy and clarity of a late-1990s handheld color adventure: small sprites, concise dialogue, readable silhouettes, memorable music, and a world that feels larger than the screen.

It must not copy Pokémon characters, maps, sprites, UI, text, sounds, music, names, encounter design, or proprietary visual compositions. Create an original game language grounded in Mesoplasia.

The first chapter should make the player feel three things:

1. Port Marche is a living harbor city with history beyond the playable streets.
2. Mesomon are beings with agency, not inventory objects.
3. The first rift is a local emergency that reveals a much larger wound in the world.

## Core loop

**Explore → notice a disturbance → speak and investigate → bond with a Mesomon → overcome a threat → seal a rift → uncover a larger mystery.**

The vertical slice succeeds if the player finishes it wanting to leave Port Marche and follow the next pulse inland.

---

# 4. Canon boundary

## LOCKED world facts

- The game is called **Mesomon**.
- It takes place in **Mesoplasia** during the **Halcyon Age**.
- The player begins in **Port Marche**, arriving by sea.
- Port Marche is a major harbor city on Apricusus’s southwestern coast, built around a deep navigable channel and a sheltered harbor amid estuaries, wetlands, tidal flats, marshes, and shifting sandbars.
- Port Marche is old, multicultural, work-oriented, and connected to the corridor toward Azidad and routes toward the Isles of Dawn.
- Mesomon are collected through an **affixed Edenite crystal**. That core absorbs or records a Mesomon’s energy pattern and stores each bonded Mesomon in its own individual crystal.
- Rifts are opening across Mesoplasia. Demons are emerging through them. The player will push the demons back and seal the rifts.
- This game story is an **independent, non-canon interpretation**. It must feel authentic to the world without silently changing the primary Mesoplasia canon.

## Story-only inventions in this package

The following are approved for this game but are not automatically canon outside it:

- Tavian Merrow and all supporting characters below;
- the playable harbor district’s exact layout and building names;
- Edda Venn’s research and disappearance;
- the proposed Mesomon species, moves, affinities, and behaviors;
- the exact technical behavior of bonding crystals;
- the first rift incident and its hidden cause;
- any dialogue, letters, quests, items, or local legends written here.

Keep these concepts namespaced to Mesomon. Do not update a broader Mesoplasia Codex or canon database unless the owner separately approves that action.

---

# 5. Lead character — Tavian Merrow

## LOCKED identity

**Name:** Tavian Merrow
**Age:** 20
**Pronouns:** he/him
**Ancestry:** human
**Home:** Port Marche
**Role:** returning coastal-survey apprentice and first playable lead
**Affixed core:** an Edenite resonance cuff on his left wrist and lower forearm

Tavian was born near Port Marche’s working harbor. At sixteen, he left aboard a coastal survey vessel to apprentice in migration mapping, marsh ecology, current reading, and the safe handling of Edenite resonance. Four years later, he returns after receiving an unusually brief letter from his former mentor, Edda Venn:

> Come home. Bring the core. The harbor is singing in two voices.

Edda is not waiting at the dock.

## Who he is

Tavian is attentive before he is brave. He notices a missing gull call, a rope tied by the wrong hand, or a creature favoring one foot before he notices that someone is impressed with him. He has a dry sense of humor and rarely raises his voice. He is gentle with frightened things because he recognizes the instinct to make oneself small.

He is not an orphan, a chosen prince, or a blank amnesiac. He has a living history, neighbors who remember him, and relationships he failed to maintain while he was away. His competence is learned, incomplete, and practical.

## Strengths

- observant and patient;
- reads currents, tracks, weather, and animal behavior;
- calm in small emergencies;
- mechanically competent with field tools and crystal housings;
- capable of admitting that he does not understand a phenomenon;
- treats Mesomon as participants rather than equipment.

## Flaws

- avoids asking for help until a problem becomes dangerous;
- confuses being useful with being worthy of care;
- uses understatement to avoid emotional honesty;
- believes careful preparation can protect him from every loss;
- left Port Marche without making a clean goodbye and assumes time will excuse it.

## Emotional arc

Tavian arrives believing this is a contained assignment: find Edda, diagnose a harbor anomaly, and leave again before Port Marche can ask anything of him. The rift crisis teaches him that stewardship is not solitary expertise. It is a promise made with other people and creatures, renewed by action.

Across the larger game, his arc is not “becoming powerful.” It is learning that responsibility does not require isolation and that belonging is not a debt he must repay by making himself indispensable.

## Player expression

Tavian is a authored lead with a defined voice, not a silent avatar. The player may choose short response tones at important moments:

- **Warm** — open, compassionate;
- **Wry** — dry humor, indirect affection;
- **Direct** — plain and practical.

These choices may alter the next line and small relationship flags but must not branch the first chapter into incompatible plots. Every option should still sound like Tavian.

## Visual direction

Tavian should read clearly at phone size and never resemble an existing commercial monster-catching protagonist.

- dark, loosely wavy hair with one wind-lifted lock;
- olive-brown skin;
- short sea-green survey coat with a split back for movement;
- warm sand-colored shirt;
- slate trousers and dark harbor boots;
- brass fasteners and one ochre neck tie or scarf accent;
- compact field satchel worn high so it does not obscure the silhouette;
- Edenite cuff visible on the left forearm as a small pale-green light in key frames;
- no cap, no oversized backpack, no red-and-white color blocking.

### Sprite production specification

- Overworld frame cell: **16×24 px**.
- Directions: down, left, right, up.
- Frames per direction: idle + two-step walk cycle; right may be a deliberately cleaned mirror of left if the cuff remains visually correct.
- Add one interaction frame, one bracing/sealing frame, and one brief hurt frame.
- Use hard pixels only: no anti-aliasing, subpixel scaling, or blurred rotation.
- Use no more than four active colors per small sprite palette region, with palette swaps handled intentionally.
- Collision footprint should represent the feet, approximately 10×7 px, rather than the full sprite rectangle.
- Battle portrait: 48×48 or 64×64 px, whichever matches the chosen UI grid.

### Suggested Tavian sprite palette

| Purpose | Hex |
|---|---|
| Ink / deepest shadow | `#142426` |
| Coat | `#315B5E` |
| Skin / warm midtone | `#B87955` |
| Shirt / highlight | `#E4D5AE` |
| Brass accent | `#C49443` |
| Edenite glow | `#9FD6B1` |

The engine may use more than four colors across the full scene, but individual sprite clusters should retain disciplined handheld-era palette logic.

---

# 6. Supporting cast

All names and details in this section are game-story inventions.

## Nia Corren

**Orc woman, 21; harbor courier and repair apprentice; Tavian’s oldest friend.**

Nia meets Tavian at the dock after Edda fails to appear. She is quick, funny, and unsentimental without being harsh. She stayed in Port Marche and knows which roofs leak, which officials lie politely, and whose mother needs medicine delivered before rain. She is hurt that Tavian wrote less and less, but she refuses to turn that hurt into a speech prepared for his convenience.

**Voice:** fast, specific, teasing when safe, startlingly direct when it matters.
**Function:** emotional anchor, local guide, quest-giver, and proof that Tavian’s old life continued without waiting for him.
**Private want:** to be taken seriously as an engineer instead of being treated as a quick pair of hands.

## Edda Venn

**Human woman, 53; field naturalist, crystalwright, and Tavian’s former mentor.**

Edda studies the relationship between Edenite resonance, animal migration, and changes in waterways. She is exacting but never theatrical. Her affection appears as repaired tools, marginal notes, food left where someone will find it, and questions that assume the student can reach the answer.

She discovered that the harbor’s natural resonance had acquired a second, mathematically regular pulse. She disappeared while tracing it beneath the oldest tidal works.

**Voice in notes:** exact nouns, short clauses, no self-pity, an occasional dry aside.
**Function:** inciting absence and the human trail leading beyond the first rift.
**Important constraint:** the first chapter does not rescue her. It confirms that she left the harbor alive and was following the anomaly deliberately.

## Bram Ordo

**Dwarf man; senior dock supervisor.**

Bram knows the harbor as a system of pressures, schedules, favors, and bad assumptions. He distrusts spectacle, including Tavian’s crystal cuff, but he will change his mind when shown evidence. He does not become a foolish obstructive authority figure.

**Voice:** spare, literal, maritime comparisons used rarely and accurately.
**Function:** controls access to the tide stairs, provides civic stakes, and validates that the disturbance is physically real.

## Seli Amaran

**Western elf woman; owner of a small provisions and tincture counter.**

Seli remembers Tavian as a child who returned every jar after borrowing it. She notices the harbor’s altered insect behavior before anyone measures the tide. Her warmth has boundaries; she will help, but she will also charge a fair price and close her shutters when danger arrives.

**Voice:** patient, economical, attentive to sensory detail.
**Function:** healing tutorial, environmental clue, and optional side quest.

## Pell

**Mixed-ancestry child, about 10; lives near the lower quay.**

Pell is not a mystical child oracle. They are observant because adults ignore where children go. Pell lost a tin whistle in the reeds and saw “the water fold like cloth” beneath the pilings.

**Function:** optional quest, human scale, and first eyewitness account.

---

# 7. Mesomon and Edenite bonding

## Foundational rule

Mesomon are living beings with instincts, preferences, social bonds, territories, and the ability to refuse. They are not demons. Rifts can frighten, disorient, or destabilize them, but corruption does not make their species evil.

## The affixed Edenite core

Tavian’s cuff contains a tuned Edenite core held against the skin by a brass-silver lattice. It does not physically pull a creature into a gem. It reads and holds a stable resonance pattern. When a Mesomon willingly synchronizes, the core grows a small individual crystal keyed to that being. That crystal becomes the creature’s safe resting vessel and can release it again.

For this non-canon story, use the following rules:

1. A core cannot bond with a demon or a being whose resonance is fundamentally rift-born.
2. A first bond requires a moment of mutual recognition; it cannot be completed through brute force alone.
3. Battle may calm, tire, or stabilize a wild Mesomon enough to make communication possible, but low health is not itself consent.
4. The UI action is called **Resonate**, not Capture.
5. A failed resonance should read as a mismatch, fear, or lack of trust—not as the player throwing disposable devices at an unwilling animal.
6. Individual crystals have subtle differences in color and tone. They are not mass-produced identical balls.
7. A bonded Mesomon may leave the crystal outside battle in safe areas for small ambient interactions.

## First-bond sequence

Tavian’s first bond is not a conventional capture tutorial. A frightened Rillik is trapped behind a collapsed tide gate as rift pressure rises. Tavian frees it without expecting a bond. When the rift’s pulse strikes again, the Rillik returns and places one paw against the glowing cuff. The first individual crystal forms between them.

The emotional logic is: **he helped first; trust followed.**

---

# 8. First companion — Rillik

**Species:** Rillik
**Affinity:** Tide
**Role:** first companion, rift-sense guide, emotionally expressive partner

Rillik is a small marsh-and-estuary Mesomon with a low otterlike body, reed-shaped ear fins, webbed forefeet, and a luminous ring near the tip of its tail. Its coat is slate-blue with a pale throat and small sea-glass markings. It steals reflective scraps, dislikes bells, and tests unfamiliar surfaces with one paw before putting down its weight.

It communicates through posture, clicks, breathy chirps, and a low resonant hum that Tavian’s cuff can partially interpret as feeling—not translated speech.

## Personality

Curious after fear passes; stubborn about returning favors; suspicious of deep artificial tunnels; fascinated by Tavian’s brass cuff; prone to sleeping inside coiled rope.

## Overworld ability

**Current Sense:** reveals nearby disturbed currents, hidden wet passages, and rift resonance as subtle ripples. Do not turn this into a constantly flashing objective arrow. It should invite observation.

## Initial moves

| Move | Category | Effect |
|---|---|---|
| Brine Snap | Tide / attack | Quick bite of pressurized water; reliable basic damage. |
| Reedstep | Utility | Raises evasion for one turn; also crosses one-tile soft marsh gaps in the overworld later. |
| Resonant Cry | Resonance | Lowers a target’s agitation and increases the chance that Resonate becomes available. |
| Tidal Veil | Tide / guard | Reduces the next incoming hit and clears one minor rift status. |

## Sprite specification

- Overworld cells: 16×16 or 16×20 px.
- Idle, two-frame movement in four directions, curious/sniff frame, hurt frame, resonance frame.
- Battle sprite: 48×48 px.
- Tail ring must remain readable as the signature feature.
- Avoid resembling an existing otter, seal, or starter-monster character from another franchise.

---

# 9. Initial encounter roster

Keep the vertical slice deliberately small. Four Mesomon species and one non-bondable demon are enough to prove the systems.

| Species | Affinity | Habitat and behavior | Battle identity |
|---|---|---|---|
| **Rillik** | Tide | Reeds, tide pools, harbor margins; curious and social | Balanced support and defense |
| **Muddren** | Stone / Tide | Broad-backed mud burrower that reinforces banks | High guard, slow, applies Mudbound |
| **Gleamwing** | Gale / Lumen | Small dusk moth drawn to clean lantern glass | Fast support, accuracy and light effects |
| **Tressel** | Stone | Rope-tailed quay scavenger that nests in timber gaps | Quick physical attacks and item theft |
| **Rift Wretch** | Rift-born demon | Emerges where the harbor resonance tears | Non-bondable boss; unstable multi-hit patterns |

Names and visuals are story-only and may be adjusted later, but do not add a large roster in the first implementation.

## Mechanical distinction

- Mesomon have readable emotional states and may be bonded through Resonance.
- Demons use a separate data category, cannot be stored, and leave unstable residue rather than a crystal.
- Do not use a Mesomon’s normal palette with red eyes as the only sign of demonic influence. Give rift-born entities a distinct silhouette language: incomplete edges, broken symmetry, and frames that appear to skip rather than organic idle motion.

---

# 10. First chapter — “The Harbor in Two Voices”

## Target playtime

15–25 minutes for a first-time player who reads the dialogue and completes one optional interaction.

## Time and atmosphere

Late afternoon under high cloud. The rain has stopped, but every board and roof edge still carries water. Port Marche should feel active rather than grim: dock calls, gulls, cart wheels, awnings being tied, market shutters half-open. The anomaly is a wrong note inside ordinary life.

## Story sequence

### 1. Arrival

The screen begins black with low ship creaks and water. A pale line of harbor light appears. Tavian stands at the rail as Port Marche resolves out of mist. The player receives control for a few steps on deck before the captain calls him over.

Purpose: teach movement and establish Tavian’s authored voice without an exposition crawl.

### 2. Nia at the quay

Nia is waiting, but Edda is not. Their reunion is affectionate, awkward, and incomplete. Nia reveals that Edda has missed two appointments and left her workshop lamp burning overnight.

Purpose: establish home, history, and urgency.

### 3. Walk to Edda’s workshop

The player crosses the arrival pier and lower quay. Three short optional NPC conversations establish that the tide has behaved strangely, insects are avoiding the water, and a bell rang beneath the dock when no bell was present.

Purpose: let the player discover the problem through multiple human observations.

### 4. The empty workshop

Edda is gone. The kettle is dry, a chair is upright, and nothing suggests a struggle. The player inspects three clues:

- a resonance chart showing a second regular pulse beneath the natural harbor rhythm;
- a damp field map with the old tide stairs circled;
- an empty hook where Edda’s travel satchel normally hangs.

The final clue is a half-written note:

> The second voice is not echo. Echo follows. This one waits.

Bram arrives or sends word: water has begun withdrawing from one maintenance inlet against the tide.

### 5. The tide-gate incident

At the lower tide stairs, workers are keeping people back. A Rillik is trapped behind a jammed lattice while the water pulses in short, unnatural withdrawals. Tavian uses a simple environmental interaction to release the gate. The Rillik flees.

Nia: “You crossed half the coast to open a rusty door.”
Tavian: “It was a complicated door.”

### 6. First bond

A second pulse breaks part of the walkway. The Rillik returns instead of escaping. It braces beside Tavian, touches his Edenite cuff, and forms the first individual crystal. The UI introduces **Release**, **Call**, and **Resonate** through a quiet, guided moment.

Do not put a triumphant fanfare over the creature’s fear. Use a warm, spare four-note motif and let the harbor ambience return beneath it.

### 7. Under-wharf investigation

Tavian and Rillik enter a compact tidal-maintenance passage. Current Sense reveals a path and the player completes:

- one environmental interaction;
- one tutorial battle against an agitated Tressel or Muddren;
- one optional Resonate opportunity;
- one small healing pickup;
- one clear save point or autosave notification.

### 8. First rift and boss

The passage opens into an old stone tide chamber. A narrow vertical rift hangs above black water like a cut that has forgotten to bleed. A Rift Wretch emerges in incomplete, jerking frames.

The battle teaches:

- attack;
- guard/utility;
- switching if the player formed an optional second bond;
- the difference between Mesomon agitation and a demon’s stability meter.

After the demon is pushed back, ordinary attacks cannot close the rift. Tavian and Rillik align their resonance. The player performs a simple three-pulse seal interaction: press/tap when an expanding ring meets the Edenite ring. Accessibility settings can make this automatic or widen the timing window.

### 9. The larger signal

When the rift closes, Tavian’s cuff answers with several distant pulses—one inland, one faintly north, and another too far away to place. Beneath a loose stone, the player finds one page in Edda’s hand:

> Not all doors are opened from the other side.

The paper is dry despite the wet chamber. Edda has marked a route out of the city.

### 10. Return and chapter close

Back at the workshop, Nia sets food down without asking whether Tavian is staying.

Tavian may answer warmly, wryly, or directly. Every version ends with the same action: he places the new crystal beside Edda’s map. Rillik emerges, circles twice on a coil of rope, and sleeps.

The camera settles on the map as a distant point pulses once.

**End card:** `MESOMON — CHAPTER I: PORT MARCHE`
**Tease:** `The inland road is not yet open in this build.`

---

# 11. Quest definitions

## Main quest: A Harbor in Two Voices

| Step | Player objective | Completion condition |
|---|---|---|
| 1 | Disembark in Port Marche | Leave the ship map |
| 2 | Find Edda | Reach workshop |
| 3 | Search the workshop | Inspect all three clues |
| 4 | Go to the old tide stairs | Speak to Bram at barrier |
| 5 | Free the trapped Mesomon | Open gate interaction |
| 6 | Follow the wrong current | Use Current Sense twice |
| 7 | Reach the tide chamber | Complete tutorial encounter |
| 8 | Push back the demon | Win boss battle |
| 9 | Seal the rift | Complete three resonance pulses |
| 10 | Return to the workshop | Trigger closing scene |

## Optional quest: The Tin Whistle

Pell asks the player to recover a dented tin whistle from the reeds. Rillik dislikes its sound but later imitates its three-note pattern. The reward is a small healing tincture and a relationship detail, not powerful gear.

## Optional environmental story: The Wrong Catch

A fisher has pulled up a harmless Muddren that is breathing too quickly. The player can use Resonant Cry rather than battle it. The scene teaches that not every distressed creature is an encounter to win.

---

# 12. Dialogue direction

## Writing standard

Dialogue must be concise enough for a small mobile text window but still sound observed, human, and specific.

- Do not use lore dumps.
- Do not write “As you know…” dialogue.
- Let characters avoid a subject, interrupt themselves, or answer the emotional question instead of the literal one.
- Give each speaker a distinct rhythm.
- Use concrete details instead of generic fantasy solemnity.
- Humor should come from familiarity and situation, not modern meme language.
- Earn poetic lines by surrounding them with plain speech.
- Do not make every NPC whimsical.
- Avoid generic chosen-one language.
- Tavian may be competent without always having the last word.

## Text-box constraints

- Prefer one or two lines per advance.
- Target roughly 28–34 visible characters per line after localization-safe wrapping.
- Never shrink the font to fit dialogue.
- Use a continuation indicator and a fast-text option.
- Allow the player to review the most recent conversation in a compact log.

## Opening sample

**CAPTAIN:** Port Marche.

**TAVIAN:** I can see that.

**CAPTAIN:** You can see roofs.
The harbor’s underneath them.

**TAVIAN:** You say that to everyone
coming ashore?

**CAPTAIN:** Only the ones staring
like the city owes an apology.

Later, on the quay:

**NIA:** You took long enough.

**TAVIAN:** Hello to you too.

**NIA:** No. Hello was three summers
ago. This is a formal complaint.

**TAVIAN:** You practiced that.

**NIA:** The whole walk down.

**TAVIAN:** Where’s Edda?

**NIA:** Supposed to meet you.

**TAVIAN:** She misses appointments.

**NIA:** Not yours.

## Workshop sample

**NIA:** Her cup’s still here.

**TAVIAN:** That proves she owns a cup.

**NIA:** It proves you’re worried.

**TAVIAN:** I was hoping for evidence
with measurements.

**NIA:** You came home.
That’s a measurement.

## First-bond sample

Tavian kneels but does not reach for the Rillik.

**TAVIAN:** I won’t close the gate.

The Rillik watches the cuff pulse.

**TAVIAN:** I don’t know what it wants
either.

It touches the Edenite lattice.

**TAVIAN:** All right.

Beat.

**TAVIAN:** We can be frightened
at the same thing.

## Closing sample

**NIA:** Are you leaving in the morning?

Player tone choices:

- **Warm:** “Not before we find her.”
- **Wry:** “I’ve just unpacked one sock.”
- **Direct:** “No. The next pulse is inland.”

Nia sets down two bowls.

**NIA:** Good. One of those was almost
an answer.

---

# 13. Map and level design

## Playable scope

Port Marche is a large city. The first build shows **one compact working-harbor district**, not the entire city and not a village standing in for it.

Recommended outdoor map: **40×36 tiles**, with **16×16 px tiles**. A 160×144 internal viewport reveals 10×9 tiles at a time.

## Required spaces

1. **Arrival ship deck** — micro-map and movement tutorial.
2. **Arrival pier** — transition into the city.
3. **Lower quay** — primary social spine, carts and water visible.
4. **Market edge** — Seli’s counter, optional supplies, a few ambient NPCs.
5. **Edda’s workshop** — key interior and chapter home base.
6. **Old tide stairs** — controlled access point and first-bond scene.
7. **Under-wharf passage** — short exploration/tutorial dungeon.
8. **Tide chamber** — boss and sealing sequence.
9. **Inland road gate** — visibly present and narratively locked for the next chapter.

## World-density rules

- Every screen should contain a navigational landmark: crane, awning color, tower silhouette, water edge, or distinctive masonry.
- Use blocked work, raised bridges, guards, carts, and closed floodgates for boundaries. Avoid arbitrary invisible walls.
- Place water movement, one working crane, distant ships, gull shadows, and NPC task animations to imply a city beyond the map.
- Do not crowd paths with decorative collision.
- Keep principal routes at least two tiles wide where possible.
- Never place an interactive object underneath a fixed mobile control overlay.

## Encounters

Use visible overworld Mesomon rather than random flash encounters in this slice. This improves mobile pacing and makes creatures feel embedded in the harbor.

---

# 14. Battle and rift systems

## Battle format

- One active Mesomon per side.
- Up to three bonded Mesomon in the first-build party.
- Four move slots.
- Turn-based selection with very fast transitions.
- Required stats: Vitality, Power, Guard, Agility, Resonance.
- Avoid a large type chart in the first slice. Implement only the affinities required by current data, using a data-driven multiplier table that can expand later.

## Turn flow

1. Player chooses Move, Guard/Utility, Switch, Item, or Resonate when available.
2. Intent locks immediately with clear tactile feedback.
3. Turns resolve by priority and Agility.
4. Animations remain short; common moves should resolve in roughly 450–750 ms with a “fast battle” setting.
5. Status changes are shown with an icon and one concise line.

## Resonance

Wild Mesomon have an **agitation state** in addition to Vitality. Helpful moves and contextual actions lower agitation. `Resonate` becomes available when:

- the creature is sufficiently calm or tired;
- it is not under active rift frenzy;
- the player has a compatible empty crystal bud;
- story restrictions permit the bond.

The first Rillik bond is scripted and guaranteed. The tutorial wild bond should be forgiving and clearly explain why it succeeds or fails.

## Rift fights

Demons use **Stability** instead of agitation. Reducing Stability pushes the entity back toward the rift. The seal interaction occurs only after the demon is expelled. This keeps “winning a fight” mechanically distinct from “repairing the wound.”

---

# 15. Mobile experience

## Screen and scaling

- Render the game at an internal **160×144** logical resolution.
- Use nearest-neighbor scaling only.
- Scale to the largest integer multiple that fits when practical; if exact integer scaling would make the screen unreasonably small, use a crisp CSS layout that preserves the aspect ratio and disables smoothing.
- Center the game screen in a purpose-built portrait shell.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Set route-appropriate `theme-color` and status-bar styling for light and dark appearance.

## Portrait controls

Place the game viewport above a compact control deck:

- left: eight-direction-capable D-pad, but movement remains four-directional;
- right: large **A** and smaller **B** buttons;
- center/lower: Menu and optional quick action;
- every control target at least 44×44 CSS px;
- allow sliding the thumb between D-pad directions;
- prevent accidental browser gestures only inside the game interaction surface;
- optional subtle haptic feedback when supported and enabled;
- do not require multi-touch.

## Gesture and scroll requirements

The user has specifically identified pull-to-refresh and vertical gesture conflicts as harmful.

- On the Mesomon game shell, use scoped `touch-action`, `overscroll-behavior`, and pointer-event handling so playing does not trigger page refresh or browser scroll.
- Apply those rules only while the game route is active and only to the game root/canvas/control surface.
- Outside Mesomon, preserve normal DH app scrolling and navigation.
- Do not trap a screen-reader user or hardware-keyboard user inside the canvas.

## Responsiveness

- UI press feedback begins within one frame.
- Menu open/close motion: approximately 120–180 ms.
- No long decorative easing before input becomes available.
- Queue one directional input during tile movement so walking feels smooth.
- Do not allow repeated pointer listeners after remounts.
- Pause simulation and audio on `visibilitychange`; resume cleanly.
- Unlock audio only after a user gesture and remember mute settings.

## Landscape and desktop

Landscape may place controls beside the viewport. Desktop must support keyboard:

- arrows/WASD: move;
- Z/Enter/Space: A;
- X/Escape/Backspace: B;
- M: menu;
- gamepad support may follow through the same input abstraction.

Do not build a separate gameplay implementation for each device class.

---

# 16. Recommended technical architecture

Inspect the repository and adapt names to its conventions. The preferred approach for a React/Vite/TypeScript app is:

- **Phaser 3 + TypeScript** for scenes, tilemaps, sprites, input, audio, and deterministic game state;
- a thin React route and mobile shell around the Phaser canvas;
- lazy import of the Mesomon route, engine, and assets;
- Tiled-compatible JSON or a typed in-repository map representation;
- data-driven TypeScript/JSON definitions for species, moves, dialogue, quests, items, encounters, and map interactions;
- IndexedDB for immediate offline/local saves;
- Supabase for authenticated cloud synchronization through the existing client and auth patterns.

If Phaser is already present, use the installed version. If another engine is already the established repository standard and meets all requirements, document why reusing it is safer before deviating.

## Suggested module boundaries

Use current repository folder conventions; these are conceptual names, not mandatory literal paths.

```text
mesomon/
  MesomonRoute.tsx
  MesomonShell.tsx
  game/
    createGame.ts
    config.ts
    scenes/
      BootScene.ts
      HarborScene.ts
      InteriorScene.ts
      BattleScene.ts
      RiftSealScene.ts
    systems/
      InputController.ts
      DialogueController.ts
      QuestController.ts
      BattleEngine.ts
      ResonanceSystem.ts
      SaveManager.ts
      AudioManager.ts
    data/
      species.ts
      moves.ts
      encounters.ts
      quests.ts
      dialogue/
      maps/
    types/
    tests/
  ui/
    GameControls.tsx
    GameMenu.tsx
    SaveIndicator.tsx
  styles/
```

## Architecture requirements

- Game rules must not depend directly on React components.
- The battle resolver, quest state transitions, save migrations, and resonance eligibility should be pure/testable functions where possible.
- Create one input-action interface (`up`, `down`, `left`, `right`, `confirm`, `cancel`, `menu`) consumed by touch, keyboard, and gamepad adapters.
- Destroy the Phaser instance, audio nodes, observers, timers, and event listeners when the route unmounts.
- Prevent duplicate games during React development remounts/Strict Mode.
- Do not put large base64 assets in source files.
- Use asset manifests and preload only what the active chapter needs.
- Ensure the main DH bundle does not eagerly include Phaser or Mesomon art/audio.

---

# 17. Save data and SQL migration

Cloud save is necessary for a durable app experience. Use one versioned JSON state per authenticated user and slot for the first release. Do not prematurely normalize every party member, item, quest flag, and map coordinate into separate tables.

## Save-state shape

```ts
interface MesomonSaveV1 {
  schemaVersion: 1;
  slot: 1 | 2 | 3;
  player: {
    name: "Tavian";
    mapId: string;
    x: number;
    y: number;
    facing: "up" | "down" | "left" | "right";
  };
  party: BondedMesomon[];
  collection: Record<string, BondedMesomon>;
  inventory: Record<string, number>;
  questFlags: Record<string, boolean | number | string>;
  activeQuestId: string;
  rifts: Record<string, "unseen" | "found" | "sealed">;
  settings: {
    textSpeed: "slow" | "normal" | "fast";
    battleSpeed: "normal" | "fast";
    reducedMotion: boolean;
    haptics: boolean;
    mute: boolean;
    sealAssist: boolean;
  };
  playtimeSeconds: number;
  savedAt: string;
}
```

Validate loaded data at runtime and migrate older local/cloud schema versions before using them. A corrupt cloud state must not crash the route; preserve it for diagnostics and offer the last valid local save.

## Required migration file

Create a timestamped Supabase migration in the repository’s existing migrations directory. If the project already provides a canonical `updated_at` function, reuse it instead of adding the dedicated function below.

```sql
begin;

create table if not exists public.mesomon_save_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null default 1 check (slot between 1 and 3),
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object'),
  playtime_seconds integer not null default 0
    check (playtime_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mesomon_save_slots_user_slot_key unique (user_id, slot)
);

create index if not exists mesomon_save_slots_user_id_idx
  on public.mesomon_save_slots (user_id);

alter table public.mesomon_save_slots enable row level security;

drop policy if exists "mesomon saves select own" on public.mesomon_save_slots;
create policy "mesomon saves select own"
  on public.mesomon_save_slots
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "mesomon saves insert own" on public.mesomon_save_slots;
create policy "mesomon saves insert own"
  on public.mesomon_save_slots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "mesomon saves update own" on public.mesomon_save_slots;
create policy "mesomon saves update own"
  on public.mesomon_save_slots
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mesomon saves delete own" on public.mesomon_save_slots;
create policy "mesomon saves delete own"
  on public.mesomon_save_slots
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.mesomon_save_slots from anon;
grant select, insert, update, delete
  on table public.mesomon_save_slots
  to authenticated;

create or replace function public.set_mesomon_save_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_mesomon_save_updated_at
  on public.mesomon_save_slots;

create trigger set_mesomon_save_updated_at
before update on public.mesomon_save_slots
for each row
execute function public.set_mesomon_save_updated_at();

commit;
```

## Sync behavior

- Save locally first so the UI never waits on the network.
- Debounce cloud writes and save at chapter checkpoints, battle completion, map transitions, app backgrounding when feasible, and explicit menu save.
- Upsert by `(user_id, slot)` using the authenticated user ID from the existing Supabase session.
- Increment `revision` on each successful cloud write.
- Resolve simple conflicts by comparing revision and `updated_at`; never silently replace a newer cloud state with an older local state.
- Display a small non-blocking state: Saving, Saved, Offline, or Sync needs attention.
- The game must remain playable offline after assets load.
- If the migration has not been deployed, local saves must still work and the UI should report cloud sync as unavailable rather than spinning or crashing.

## Migration handoff requirement

If Codex cannot apply the migration through the repository’s established deployment workflow, it must still:

1. create and commit the migration file;
2. provide the exact SQL in its handoff;
3. state clearly that it is **not yet applied**;
4. give the exact approved project command or Supabase dashboard step required to apply it;
5. never claim cloud saves are live until an authenticated read/write check succeeds with RLS enabled.

---

# 18. Art and asset package

## Global art direction

Original late-1990s handheld color pixel art, interpreted through Mesoplasia rather than copied from another game.

Port Marche palette anchors:

| Use | Hex |
|---|---|
| Deep harbor ink | `#102224` |
| Wet slate | `#30474A` |
| Harbor teal | `#2F6667` |
| Marsh green | `#657D55` |
| Weathered ochre | `#C09245` |
| Warm plaster | `#D8C9A5` |
| Foam / pale light | `#E8E1C6` |
| Edenite glow | `#9FD6B1` |
| Rift violet-black | `#36243F` |

## Required first-build assets

- Tavian overworld sheet and battle portrait;
- Nia, Edda-note portrait or silhouette, Bram, Seli, Pell, captain, and 4–6 ambient NPC sheets;
- Rillik, Muddren, Gleamwing, Tressel, and Rift Wretch overworld/battle sprites;
- 16×16 harbor tileset: water, piers, wet stone, timber, plaster walls, roofs, reeds, mud, ropes, market awnings, doors, stairs, railings, tide machinery;
- ship-deck micro-tileset;
- workshop interior tiles;
- under-wharf/tide-chamber tiles;
- dialogue frame, menus, status icons, affinity icons, crystal icons, move VFX, rift VFX;
- touch control icons designed for the DH shell;
- title card and route thumbnail.

## Asset-generation prompt: Tavian reference

> Create an original pixel-art character reference for Tavian Merrow, a 20-year-old human coastal survey apprentice in a non-canon fantasy world. Olive-brown skin, dark loose wavy hair, short sea-green survey coat, sand-colored shirt, slate trousers, harbor boots, brass fasteners, small ochre scarf accent, compact field satchel, and a pale-green Edenite crystal cuff on the left forearm. Quietly observant expression, practical rather than heroic pose. Late-1990s handheld color-RPG pixel discipline, crisp hard pixels, limited palettes, readable at very small scale, fully original design, no resemblance to existing monster-catching protagonists, no modern objects, transparent background. Include front, back, side, walking, interaction, bracing, and 48-pixel battle portrait references.

## Asset-generation prompt: Rillik reference

> Create an original small estuary creature named Rillik for a handheld color fantasy RPG. Low otterlike body but not a real-world otter, reed-shaped ear fins, webbed forefeet, slate-blue coat, pale throat, sea-glass markings, and one luminous ring near the tail tip. Curious, cautious posture; tests the ground with one paw. Crisp hard-pixel sprite design, limited four-color clusters, readable at 16 pixels, transparent background. Include four-direction movement, curious/sniff, hurt, resonance, and a 48-pixel battle pose. Avoid resemblance to any existing commercial monster character.

## Copyright and originality gate

Before committing assets, verify that no sprite, map, UI frame, sound, font, logo, creature silhouette, or melody was copied or traced from Pokémon or another commercial title. Inspiration may guide constraints; it may not supply source material.

---

# 19. Audio direction

Use original chiptune-inspired sound, not cloned Game Boy hardware tracks or franchise melodies.

Required cues:

- harbor ambience loop: water, distant work, restrained gulls;
- Port Marche theme: warm, practical, slightly restless;
- workshop interior variation;
- under-wharf tension loop;
- battle theme;
- Rift Wretch variation;
- four-note first-bond motif;
- rift-seal sound built from a dissonance resolving into harbor ambience;
- concise UI confirm/cancel/menu sounds;
- small species cries, each original.

Music and ambience controls must be independent if the existing settings system supports it. Mute must persist.

---

# 20. Accessibility

- Minimum 44×44 CSS-pixel touch targets.
- High-contrast text with no information conveyed by color alone.
- Reduced-motion mode removes screen shake, flashing palette cycles, and nonessential camera movement.
- Seal Assist widens timing windows or completes the seal without timed input.
- Adjustable text speed and instant text option.
- Dialogue history.
- Keyboard-complete navigation for all menus.
- Avoid rapid flashes; no more than three flashes per second.
- Provide a clear pause/exit control and preserve progress when leaving the route.
- Respect system reduced-motion preference on first launch.
- Touch controls should expose accessible labels; canvas-only information should have a practical DOM/UI equivalent where needed.

---

# 21. Performance and quality gates

## Performance

- Mesomon code and assets load only when entering its route.
- Main DH app startup must not eagerly download Phaser or chapter assets.
- Target stable 60 fps on a typical modern phone; remain playable at 30 fps on a modest device.
- Use texture atlases and compressed web-appropriate audio/images.
- No unbounded particle systems, timers, event listeners, or object creation in update loops.
- Initial route should show immediate shell feedback while game assets load.
- Cache assets through the existing PWA strategy only after confirming version invalidation works.

## Tests

Add tests using the repository’s established framework.

Required unit coverage:

- quest step transitions and idempotence;
- battle turn ordering and deterministic outcomes under a seeded RNG;
- Resonance eligibility rules;
- demons cannot be bonded;
- save schema validation and V1 migration;
- cloud/local conflict comparison;
- input adapter maps touch and keyboard to the same actions.

Required integration/smoke coverage:

- Mesomon route lazy-loads without changing an unrelated route’s bundle or behavior;
- route mounts and unmounts without duplicating canvas/listeners;
- mobile control buttons can move, confirm, cancel, and open the menu;
- leaving and returning restores the latest valid local save;
- unauthenticated/offline play does not crash;
- authenticated cloud save is scoped to the current user under RLS;
- page scroll/pull-to-refresh suppression is active in the game shell and absent elsewhere;
- light and dark DH app chrome both keep the game shell readable.

Run the full relevant typecheck, lint, unit tests, production build, and any end-to-end suite already used by the repository. Fix warnings introduced by this work.

---

# 22. Implementation phases

## Phase 0 — Repository reconnaissance

- Read instructions and current architecture.
- Identify existing game route/shell and navigation entry patterns.
- Identify styling tokens, PWA behavior, auth, Supabase client, migrations, test framework, and deployment provider.
- Record baseline build/test status before edits.

## Phase 1 — Shell and engine foundation

- Add lazy-loaded Mesomon route and navigation entry.
- Build portrait mobile shell, safe-area behavior, touch controls, keyboard adapter, lifecycle cleanup, loading/error states.
- Confirm unrelated app scrolling is unchanged.

## Phase 2 — Playable Port Marche

- Add original placeholder-quality-but-cohesive tiles/sprites if final art is not available.
- Implement ship, harbor district, workshop, tide stairs, passage, and chamber.
- Add collision, camera, interactions, dialogue, and quest state.

## Phase 3 — Mesomon systems

- Implement party/species/move data.
- Add first bond, visible encounters, battle flow, agitation/Resonate, demon stability, and rift seal.
- Keep logic data-driven and tested.

## Phase 4 — Narrative pass

- Implement the complete chapter text and tone choices.
- Add optional Tin Whistle and Wrong Catch interactions.
- Ensure no text box overflows at target viewport and larger accessibility font setting if present.

## Phase 5 — Saves and migration

- Add versioned local persistence first.
- Add the SQL migration and authenticated cloud sync.
- Add visible save state, offline behavior, and conflict safety.

## Phase 6 — Premium polish

- Tighten press feedback, transitions, camera motion, animation timing, audio handoff, focus handling, and safe-area spacing.
- Test light/dark app chrome, multiple phone widths, landscape, desktop keyboard, reduced motion, background/resume, and route remount.

## Phase 7 — Verification and release

- Run all quality gates.
- Commit and push to `main`.
- Verify remote hash.
- Observe deployment for the exact commit.
- Open the live route and complete at least the movement, first dialogue, first bond, battle, save, reload, and exit path before claiming live success.

---

# 23. Definition of done

The first build is done only when all of the following are true:

- Mesomon is discoverable from the DH app using established navigation patterns.
- Entering it lazy-loads a polished mobile game shell.
- Tavian can move through a coherent Port Marche harbor district.
- The full “Harbor in Two Voices” chapter is playable from arrival through the end card.
- Dialogue uses the approved human, concise tone and distinct voices.
- Rillik’s first bond occurs through trust, not a generic capture action.
- At least one optional wild Mesomon can be bonded through the Resonance system.
- The Rift Wretch cannot be bonded.
- The first demon can be pushed back and the rift sealed.
- Local save and reload work reliably.
- The cloud-save migration exists, RLS is correct, and deployment status is reported honestly.
- Pull-to-refresh/scroll gestures do not interrupt play, and normal app scrolling still works outside the route.
- Touch, keyboard, reduced motion, mute, and Seal Assist work.
- The game route cleans up fully when exited.
- Existing games and non-game pages remain unaffected.
- Tests, typecheck, lint, and production build pass, except for clearly documented pre-existing failures.
- Work is committed and pushed directly to `origin/main` without force.
- Remote push and live deployment are confirmed separately.

---

# 24. Explicit non-goals for this build

Do not expand the first implementation into any of the following:

- the entire city of Port Marche;
- a world map or travel to Azidad;
- dozens of Mesomon species;
- breeding, trading, PvP, multiplayer, guild systems, raids, or monetization;
- procedural world generation;
- a full affinity chart;
- elaborate character customization that weakens Tavian’s authored identity;
- canon changes to Mesoplasia;
- replacement or redesign of existing DH games;
- copied franchise assets, sounds, UI, maps, or terminology.

The goal is one small, complete, memorable chapter with a foundation strong enough to grow.

---

# 25. Final creative north star

Port Marche should not feel like a tutorial town waiting for the story to begin. It is the first place worth saving.

Tavian should not feel important because fate announced him. He becomes important because, when something frightened was trapped behind a gate, he opened it before asking what he would receive.

That choice is the beginning of Mesomon.
