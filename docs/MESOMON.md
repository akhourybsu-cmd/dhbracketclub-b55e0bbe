# Mesomon — Port Marche

Mesomon is an independent, explicitly non-canon Mesoplasia story. The authored lead is Tavian Merrow, a 20-year-old returning coastal-survey apprentice. Chapter I, **The Harbor in Two Voices**, follows the [approved build brief](mesomon/PORT_MARCHE_BRIEF.md). It does not modify any shared Mesoplasia canon.

## Playable scope

Six connected maps cover the ship, working harbor, Edda’s workshop, tide stairs, maintenance passage and tide chamber. The harbor spans 40 × 36 tiles. The camera shows ten tiles across and nine down on a 160 × 144 logical screen. Each tile, overworld character and companion fits a 16 × 16 pixel cell. Dialogue and battles use separate 48 × 48 illustrations. Landmarks, collision, named interactions and two environmental gates connect the full arrival/investigation/first-bond/battle/seal/return chapter. The inland road intentionally remains closed after this chapter.

The first Rillik bond follows opening its gate without demanding a reward. Optional Tin Whistle and Wrong Catch interactions preserve that distinction: Mesomon are living participants. Wild Tressel and Gleamwing can willingly resonate after calming. There are three party positions and two additional crystal buds. A Rift Wretch is a distinct, non-bondable demon. It must lose Stability before the separate three-pulse seal can begin.

Combat uses a seeded resolver with priority/agility, four moves per companion, defensive actions, items and switching. Low health alone does not mean consent. Reedstep gives a seeded evasion opportunity; Tidal Veil reliably guards and clears Mudbound. The Wretch double-strikes on its third-turn pattern. Loss returns the party safely to Nia; no death, lost chapter or paid recovery exists. Battle, dialogue, clue, optional-reward and seal checkpoints survive reloads. Completing a terminal battle is idempotent, including tincture consumption.

The first-play duration of 15–25 minutes is a design target. Automated walkthroughs and headless simulations establish functional completion, not measured human reading/exploration time or physical-phone frame rates.

Tap a clear patch of ground to walk there. Tapping a distant person or landmark walks Tavian up to it. Tap again or press A to interact. The small gold pointer marks what A will select. The first step from rest responds immediately. Tap paths, the D-pad and the keyboard share a 200 ms stride, including when the player switches controls mid-walk. Open **Start → Map** to see the route to the next known stop and read its walking directions. Each leg respects people, solid terrain and the current state of the tideworks. Closing or reopening the game keeps Tavian on the last tile he reached.

Press **Start** on the console or **M** on a keyboard to pause. The menu holds Companions, Journal, Map, Settings, Save file and Exit game. Settings includes sound and full screen on supported devices. **Back** returns to the menu. **Resume** continues the current scene, and **Exit game** saves locally and returns to Compete.

## Meeting people and taking turns

Nia comes to meet Tavian when he lands. After the workshop clues are in hand, Bram steps off his post when Tavian approaches the east quay. Let them reach him, then advance their lines at your own pace. Each meeting happens once. Start pauses an approach, and reduced motion places the speaker beside Tavian immediately.

Each new journey rolls its own Rillik and wild encounters. A species defines the range of each stat. For example, a new Rillik can have 44–52 maximum vitality and 14–16 Speed. The same creature keeps its rolls when Tavian leaves and returns, reloads, or offers it a bond. Check **Start → Companions** for its Attack, Defense, Speed and Resonance.

A turn starts when you choose a move or an item. Action priority decides who goes first. Within the same priority, Speed decides, with a seeded roll for a tie. Damage uses the move’s power, the attacker’s Attack, the defender’s Defense and a small seeded variation. The stage shows each move and its result in order, including the Wretch’s separate strikes. **Next** advances the current beat. **Start → Settings → Battles** changes automatic playback speed. A mid-turn save resumes the recorded exchange.

The release manifest identifies this system as rules version 2. The private save format stays at version 1. Existing companions keep their maximum vitality and receive their previous species combat values when loading an older file.

## Writing and staging a scene

Chapter dialogue lives in `data/dialogue.ts`. Put the ordinary first encounter there. Use `data/remarks.ts` for reactions to a discovery, a past conversation, a return visit or Tavian’s closing reply. Put the most specific condition first. The engine selects the lines when the interaction begins and stores those lines and the pending completion event in the save. An old file can finish the conversation it was already reading.

Give each speaker something they could have seen or heard. Nia follows the investigation from the pier to the workshop and the tide stairs. A clue can be the first or the last thing Tavian finds. When writing a callback, gate it on the actual observation. For example, the rope maker answers a different question after Tavian reads the repair tag on the crane. Check the ordinary route, a return visit, and the reverse discovery order when changing a scene.

Use a character’s name for spoken dialogue, `Port Marche` for something the player can see, and `Field note` for a control or rule. Letters and inscriptions keep their own source credit. Register new written sources in `reading.ts` so they appear on paper and keep that credit in the journal. The closing conversation gives each response its own reply.

The journal pairs one current objective with Tavian’s account of the journey. Each entry unlocks when Tavian experiences it. The whistle and the fisher’s net each get one short entry under **On the quay**, updated as the player helps. Future encounters stay off the page until the player reaches them.

Give a one-time conversation variant a stable `once` key. Its lines and receipt share the same save. This lets a player meet the rope maker, read the repair tag later and come back with a new question, even across a reload.

## Architecture and DH integration

- `/mesomon` uses the existing protected/lazy route, installed `mesomon` asset, club context and game-shell navigation. The page additionally enforces installation rather than relying on the shared administrator inspection bypass. Club admins install the catalog entry through existing Club Apps; no club receives an unsolicited install.
- `src/lib/mesomon/{types,engine,battle,input}.ts` and `data/` contain typed maps, dialogue, quest gates, species and pure gameplay. React does not determine damage, consent or quest outcomes.
- `src/pages/MesomonPage.tsx` owns the handheld shell, unified touch/keyboard actions, accessible controls/dialogue/menu, lifecycle and autosave checkpoints. `src/components/mesomon/mesomon.css` is fully namespaced. Gesture suppression applies to the play surface; menu scrolling and ordinary DH scrolling remain available.
- `renderer/createGame.ts` dynamically imports Phaser 3.90 only after the lazy route enters. Phaser renders committed logical state, camera interpolation and bounded effects. It does not award items, resolve battles or move the authoritative player. Mount cancellation, an asset timeout, resize cleanup and destruction protect Strict Mode/remounts.
- `assets.ts` is a small manifest. Original hard-pixel atlases/portraits and their reproducible generator are described in [the asset bible](MESOMON_ASSETS.md). These are authored first-pass assets, not externally licensed franchise art or runtime image generation.
- `audio.ts` synthesizes the original chapter score, water ambience, species cries and short motifs locally. Audio initializes only after a gesture; mute, separate music/ambience levels, background/menu pause and cleanup are supported.

Phaser is the brief’s preferred engine. The existing app has custom Canvas renderers but no shared walking-RPG scene engine, so the isolated Phaser dependency supplies asset/scenes/camera/input presentation without replacing another game. The production import-graph check verifies that Phaser and Mesomon remain outside the eager app graph.

## Save protocol

Three account-owned save files hold validated V1 JSON. The snapshot includes position, party, inventory, flags, dialogue/history, battle and seal. IndexedDB is the local store with an immediate account-scoped fallback, a last-valid backup and bounded corrupt-state diagnostics. Guest storage has a distinct scope. Device preferences are stored separately, so muting the title does not create or overwrite a chapter while cloud data loads.

Cloud synchronization reuses the existing authenticated Supabase client. `mesomon_save` checks the expected actor against `auth.uid()`, the active installed club, the file number, payload bounds and expected revision. An advisory transaction lock serializes creation as well as updates; the database advances revision and records an exact request UUID/payload. A retry of an acknowledged request does not advance it again. Clients have only own-slot SELECT access and cannot directly write revisions, owners or snapshot rows. The RPC derives ownership from the session; the actor argument is an assertion against stale-session races.

Local writes precede network work. Bounded cloud hydration cannot trap local play. An existing chapter arriving late is adopted on the title, including a synchronous Begin guard; active play is never silently replaced. Conflicts show both chapters and require **Use cloud save** or **Keep this device**. Choosing cloud pauses play before adoption. Checkpoints, a bounded periodic flush, explicit Save, backgrounding and exit supplement debounced writes. Offline play requires already loaded chapter code/art; purchases or shared DH rewards are not part of this single-player chapter.

On browsers with Web Locks, a file has one active writer on each device. Opening it in another tab offers **Reload file** after the first tab closes. Without Web Locks the game checks the last saved revision and content before writing. The next load compares the cache, backup and IndexedDB so an older cache cannot cover a newer durable save after a storage-quota failure.

Saves belong to the account across installed clubs. Read/write access requires membership in the current active club with Mesomon enabled/visible; switching clubs never exposes another account’s files. This is a local-first story save, not a server-authoritative competitive result. No client story flags grant DH Score or official standings.

## Database and delivery ledger

| Migration | Purpose | Deployment status |
|---|---|---|
| `20261125193000_mesomon.sql` | Own-slot RLS, installed-club access, actor assertion, transactional revision/UUID save RPC | Applied and verified, 25 November 2026 |
| `20261125193500_mesomon_asset.sql` | Register the installable game catalog entry | Applied and verified, 25 November 2026 |

Baseline before edits: clean `main` at `63dcaae3988d2150b052b20fbd84633ab5d1b565`, correct origin, matching Lovable SHA, 252 files / 2,702 unit tests, application-project TypeScript, member lint, production build and all 10 GitHub checks green. The implementation adds Phaser to both npm and Bun lockfiles, retaining Lovable’s existing development dependencies.

Current verification evidence is maintained in [QA notes](MESOMON_QA.md). The core audit passed 19 tests and 384 seeded solo-Rillik boss simulations, including a complete path without optional bonds, pickups or rest. Save/hook and database checks cover actor isolation, CAS conflicts, exact retries and interrupted hydration. The database and browser results below identify which checks used a fixture and which used the connected database.

The applied migration sources match repository MD5 `fd6e9cebddac44d52c5c2e0325f6e4be` and `d7260ef77c3e2f39f890770857fd4050`. Production verification confirms RLS, member RPC execution, and no anonymous RPC or direct authenticated INSERT grant. A rollback-only authenticated-role smoke test passed own-file read/write, identical request retry at revision 1, and stale revision rejection; it left zero saved files and zero installed clubs. Installation remains an explicit club-admin action.

The full unit run passed 258 files and 2,774 tests. The chapter suite subsequently passed all 74 cases, including the updated ship artwork and reuse of the loaded game renderer when reopening an offline file. The isolated database suite passed 19 groups. Member lint passed. Linting the entire pre-existing Compete page reports the same 17 explicit-any findings on the base commit and on this branch. The initial Chromium walkthrough passed 112 checks across eight viewport/theme combinations before the handheld sizing pass. An additional 26-check Chromium walkthrough verified the real boss at 320px portrait, 844px landscape and 1440px desktop, closing choices at 320px, and normal/hover move-text contrast above 4.5:1. Root reviewed these frames. WebKit and hosted release checks remain pending.

The official Phaser engine is an isolated 1,478.52 kB chunk (339.72 kB gzip). It is fetched only after entering Mesomon. Its known Vite size advisory is retained rather than hidden by increasing the global warning threshold. A future selected-module Canvas build can reduce that download, but is not required by the chapter rules and would need independent native-browser coverage. The pre-existing Deep Claim chunk and stale Browserslist advisories remain visible.

Production builds emit `/games/mesomon/release.json` with the actual Git commit, dirty-tree flag, chapter/rules/art versions and build ID. Hosting without Git metadata reports unknown rather than inferring a commit. Public asset/route checks and an authenticated in-app production walkthrough are separate evidence layers.
