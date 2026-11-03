# Deep Claim visual and audio specification

Deep Claim uses an original industrial-frontier identity: a working company and an inhabited mine, with restrained pixel geometry, warm metal, worn earth and readable equipment. The game should feel physical and useful, with ore and the active crew carrying the brightest accents.

This is the art direction and Phase 1–7 asset contract, extended by the cinematic title and Training Journal. Phase 6 introduces **Frontier Pixel Pack v1**, compiled from original source-authored pixel primitives and detail definitions, plus five composed Web Audio miniatures. Phase 7 adds a separate Ancient Deep atlas and one regional miniature while preserving v1 bytes, its compiler inputs and the five earlier compositions. The title and narrative portraits reuse this identity without rebaking either atlas. The implementation ledger records actual verification and release status. These are original project assets, not commissioned commercial painting or recorded orchestration. Existing local painters remain a functional fallback when atlas loading or decoding fails.

## Palette and geometry

| Role | Color | Intended use |
|---|---|---|
| Coal | `#17191b` | Deep shadow, mine interior and framing. |
| Earth | `#624536` | Soil and timber mass. |
| Rust | `#a65e3c` | Worn machinery and equipment accents. |
| Brass | `#c49a50` | Structural metal, clear company affordances. |
| Moss | `#637957` | Worker cloth, mine supports and quiet contrast. |
| Slate | `#6b7882` | Rock, tools and neutral secondary surfaces. |
| Cream | `#eadcba` | Readable highlights, labels and lit surfaces. |

Use a coherent 16-bit visual language rather than smoothing every edge into generic gradients. Tile geometry and worker silhouettes must remain recognizable at phone scale. Bright mineral color is concentrated in resource seams, ore piles and useful state changes; the whole mine must not flash or glow continuously.

The game can retain its own dark mine identity within either application theme. Surrounding text, focus states, dialogs and controls must remain readable in light and dark mode. Symbols, texture, silhouettes and labels distinguish resources and workers beyond hue alone.

## Unified interface finish

The management interface uses warm charcoal and brass in dark mode, with ivory and restrained moss in light mode. Shared inset frames, subtle corner hardware and solid instrument panels connect the HUD, dialogs, building inspectors, dispatch quotes and rewards. This is a presentation layer over the existing artwork and source-backed game state; it introduces no replacement world art or atlas generation.

`--dcl-art-stage` provides a consistent contrasting backing for pale crystals, dark ore and worker silhouettes: `#48584e` in dark mode and `#7a8779` in light mode. Standard resource/equipment art uses 64px card and 96px inspector stages; worker portraits use 48px/96px. Native integer sizing and crisp rendering remain preferred over softened scaling. Labels, selection borders, quantities and states carry meaning beyond hue. Disabled controls retain readable text; fixed transaction footers and 44px controls remain usable.

The original 32px UI resource illustrations now give raw clay a stepped earthen clod, coal angular fractured facets, copper clustered inclusions and iron banded veins. These use the existing resource palette and upper-left lighting. Refined bars, crystals, gemstones, settlement/building painters, world tiles and both committed atlases are preserved. Resource SVGs expose stable `data-dc-resource-art` identifiers while retaining their accessible labels and decorative behavior.

Research retains actual confirmed progress and Maxed states, with compact framed branch selectors and a clear active-work gauge. Reduced-motion and forced-color treatments remain supported. Core foreground tokens have measured 4.5:1 contrast against the four solid surfaces in each theme; screenshot review remains necessary for alpha/composited states. The implementation ledger records the exact verification scope and publication evidence.

## Source inventory and ownership

The mobile session layer reuses building portraits, business emblems, resource art and discovery sprites for its goal dock, paged planner and four-part shift report. `companyGoals.css`, `deepClaimReturnReport.css` and `deepClaimSession.css` extend the established charcoal/brass/ivory frames, 44px controls, state meters, reduced motion and forced colors. No atlas or terrain generation is introduced. A report illustration represents disclosed work only; the return and next-shift modules cannot draw or reveal an undiscovered resource.

### Thematic selectors

The five former native dropdowns use direct, keyboard-operable buttons with explicit pressed states. Dispatch worksite cards combine original resource illustrations with a bounded 7×5 pixel map sampled only from already revealed public tiles. Unknown ground stays dark; the preview never generates terrain or reveals a hidden deposit. Material names, depth, west/east branch distance and remaining stock identify destinations without visible raw coordinates. Four-card paging and a retained selected card bound the DOM even in a large mine.

Infrastructure tiles reuse existing project sprites. The mine-lift selector adds an original inline pixel cage/shaft emblem and six known stops per page. Training uses concise skill emblems and actual base values; the journal section rail has its own scoped light/dark treatment and horizontal scrolling within the panel. Shared `deepClaimSelectors.css` defines the inset frames, focus/selected borders, touch targets and reduced-motion/forced-color behavior. `deepClaimDepthPicker.css` and the journal stylesheet supply their local geometry. These are interface illustrations; both world atlases remain unchanged.

| Source | Purpose |
|---|---|
| `src/components/deepClaim/DeepClaimInventory.tsx` / `inventory.css` | Image-led, paged warehouse slots and a large-art item inspector; original resource SVGs and actual catalog recipe uses, with no new inventory authority. |
| `src/components/deepClaim/renderer/DeepClaimBuildingPortrait.tsx` | Static Canvas portraits using the same original settlement painter/atlases and actual owned level; shared decode notifications repaint once, with no animation loop or new atlas bytes. |
| `businessMenu.css` / `deepClaimIndustry.css` / `deepClaimWorkforceMenus.css` / `deepClaimMenus.css` | Scoped operational menu treatments, real progress gauges, framed item/worker/building art and tactile controls. Time gauges visualize disclosed schedules and cannot complete work or create goods. |
| `src/components/games/DHGamesLogo.tsx` | Original reusable DH Games publisher artwork: inline SVG on a 480×378 viewBox, interlocking ivory DH monogram, brass inset and seven custom geometric wordmark glyphs. No font, image service or external asset dependency. |
| `src/components/games/DHGamesIntro.tsx` / `dhGamesIntro.css` / `publisherIntroTiming.ts` | Charcoal publisher presentation, 600ms reveal / 2,400ms hold / 1,800ms menu crossfade, skippable without audio. Reduced motion shows a static 1,200ms card; Deep Claim's existing menu/art remain independently owned. |
| `src/components/deepClaim/DeepClaimMark.tsx` | Original inline SVG shaft-and-ore emblem for the game and discovery surfaces. |
| `src/components/deepClaim/DeepClaimNavEmblem.tsx` | Six original inline pixel SVG navigation emblems on 24×24 logical grids; no atlas rebake or external asset dependency. |
| `src/components/deepClaim/DeepClaimDiscoveryCard.tsx` | Compete entry using the same emblem and restrained company palette. |
| `src/components/deepClaim/renderer/DeepClaimCanvas.tsx` | Canvas 2D side-on company/mine renderer; implementation owned by the renderer module. |
| `src/components/deepClaim/renderer/artManifest.ts` | Procedural art manifest, palette and supported mineral/worker/building identities; authoritative coverage is the exported manifest, not an assumed external atlas. |
| `src/components/deepClaim/renderer/pixelArt.ts` | Original Canvas terrain, worker and building painters. |
| `src/components/deepClaim/renderer/DeepClaimIcons.tsx` | Matching local pixel SVG icons for resources, buildings and equipment in management views. |
| `src/components/deepClaim/renderer/productionVisuals.ts` | Public job-clock and owned-equipment presentation; it never grants output or invents a private job stage. |
| `src/components/deepClaim/renderer/fieldSprites.ts` | Original support/ventilation/pump/rail sprites and the six recovered-specimen illustrations. |
| `src/components/deepClaim/renderer/fieldAtlas.ts` | Bounded field-art caching, infrastructure states and selected Manhattan coverage. |
| `src/components/deepClaim/renderer/fieldVisuals.ts` | Known/depleted formation indexing and public recovered-find/time filtering. |
| `art/deep-claim/pack-v1.json` | Versioned authored mineral veins, building joinery, worker stitching, decorative pixel blocks and logical sprite specifications. |
| `art/deep-claim/README.md` | Editable-source provenance, compiled painter inputs, packing/anchor rules and reproducible generation commands. |
| `public/deep-claim/atlas-v1.png` | Committed compiled RGBA pixel atlas, loaded from the application itself. |
| `src/components/deepClaim/renderer/generated/atlas-v1.json` | Generated sprite rectangles, dimensions, source fingerprint and compressed-byte metadata. |
| `src/components/deepClaim/renderer/authoredAtlas.ts` | One shared asynchronous atlas decode, bounded loading and local-painter fallback. |
| `art/deep-claim/v1-source/` | Twelve byte-frozen original inputs including the Phase 6 compiler, plus one import-resolution support file, mapped to baseline commit `e2498e9`. |
| `art/deep-claim/pack-v2.json` | Original additive Ancient Deep, sixth-shaft, nickel/sulfur/alloy and heat-shield source art. |
| `public/deep-claim/atlas-v2.png` / `src/components/deepClaim/renderer/generated/atlas-v2.json` | Separate small add-on image and generated frame metadata; v1 remains unchanged. |
| `src/components/deepClaim/renderer/frameScheduler.ts` | Visibility-aware, bounded rendering cadence and explicit reduced-motion invalidation. |
| `src/lib/deepClaim/visualProjection.ts` | Reusable indexes and path geometry from immutable validated public arrays only. |
| `src/components/deepClaim/renderer/DeepClaimClubArt.tsx` / `clubSprites.ts` | Static sanitized club emblems, project illustrations, identity crests and specimen cases. |
| `src/lib/deepClaim/audioScore.ts` | Six original written MIDI arrangements, including the additive Ancient Deep score, material timbres and explicit audio budgets. |
| `src/lib/deepClaim/audio.ts` | Gesture-gated Web Audio score, ambience and cues with independent gain buses and lifecycle cleanup. |
| `src/components/deepClaim/menu/illustratedScene.ts` / `DeepClaimMenuBackdrop.tsx` | Fixed original title/founding composition with bounded cached layers; no company/world input. |
| `src/components/deepClaim/tutorial/DeepClaimPortrait.tsx` | Original local pixel SVG portraits for Gus, Mara, Ivo and Tessa, with six expression identities. |
| `src/lib/deepClaim/tutorial/dialogue.ts` | Structured original dialogue lines, speaker/expression identities and stable text keys. |

Renderer and audio filenames are integration contracts. Check their actual committed contents and the implementation ledger before treating a listed capability as delivered. There are no stock-image, runtime image-generation or external audio-service dependencies in this pack.

The follow-up visual refinement reuses these assets for tactile CSS buttons, compact navigation and actual-reward displays. Reduced-motion styles remove decorative button motion; this presentation pass leaves atlas bytes, gameplay and persistence unchanged. Its verification/publication status is recorded in the implementation ledger.

## Phase 6 authored pack and fallback

The pack source deliberately authors rectangles in logical pixels. Established original painter silhouettes are combined with unique mineral veins, building-level joinery, worker-role stitching and local decorations, then compiled into a committed PNG. This is a reproducible source-art pipeline rather than a download from a commercial library. It contains no world seed, hidden terrain, private plan or reward data.

Stable identities cover ten raw mineral treatments, nineteen inventory goods, twelve equipment definitions, nine building identities with their actual level ranges, seven worker specialties, four infrastructure types and six specimen kinds. Worker frame specifications are 24×32 logical pixels with an anchor at `(12, 28)`, four frames and a 220ms pose cadence. Runtime role, appearance, direction and actual owned functioning gear remain layered from the disclosed worker state. A sprite sheet cannot invent an assignment, excavation or upgrade.

Atlas loading is asynchronous and shared, with a bounded decode deadline. Until it succeeds, the original local painters keep the game usable. Dimension mismatch, fetch failure, decode failure or draw failure selects the fallback rather than blocking navigation or economic controls. The atlas is cosmetic and its loading state never changes a validated puzzle, rule, job or balance.

The current compiled pack has 2,255 registered frame references sharing 454 unique pixel rectangles. Deduplicated aliases are references, not additional distinct drawings. Its committed dimensions are 1024×800, compressed PNG size is 30,335 bytes and base decoded RGBA pixels occupy 3,276,800 bytes (3.125MiB). Browser/GPU copies and object overhead are outside that pixel-byte calculation.

| Presentation resource | Enforced or declared limit |
|---|---|
| Atlas geometry | Width at most 1024; height at most 2048; RGBA pixel storage at most 8MiB |
| Compressed atlas gate | 256KiB |
| Registered frame references | At most 4,096 in the independent budget check |
| Atlas load/decode | One shared image; 10-second deadline; session-terminal failure uses painters without automatic retry loops |
| Fallback terrain / field texture caches | 384 / 72 entries |
| Render cadence | Targets at most 30 paints/s normally, 12 with reduced graphics; reduced motion paints on explicit invalidation |

Reproduce v1 with `node scripts/build-deep-claim-atlas.mjs`; verify its committed outputs without rewriting them with `node scripts/build-deep-claim-atlas.mjs --check`. The router executes the archived original compiler against its frozen inputs, retaining original source fingerprints and output bytes even when current gameplay gains new materials. Build/check the separate add-on with `node scripts/build-deep-claim-addon.mjs` and `node scripts/build-deep-claim-addon.mjs --check`.

The independent `node scripts/check-deep-claim-presentation.mjs --phase=6` retains the original strict eighteen-source presentation gate. For the authorized Ancient Deep rule extension, use `node scripts/check-deep-claim-presentation.mjs --phase=7`: it checks seven old migration hashes and five old canonical catalogs, allows only the additive `0700` migration, freezes the original v1 pack/PNG/metadata and archived compiler inputs, then audits both PNGs' dimensions, bounded decompression, byte budgets and sprite bounds. It does not silently rewrite the Phase 6 baseline to excuse new rules. These source/art checks do not replace browser decoding, functional gameplay tests or physical-device measurement.

For the metadata-only menu/journal release, `--phase=8` additionally permits the `0800` educational migration while preserving the eight prior sources and existing economic rule/catalog/art fingerprints. It does not authorize another gameplay rebalance or an atlas rewrite.

## Cinematic title and narrative portraits

The title is an explicitly illustrative 960×760 logical scene. Fixed scenery combines the mine office, shaft, warehouse, workshop, distant silhouettes, rail cart, moving lift, workers, lanterns and authored underground seams. These cosmetic tunnels are not the player's geology. No snapshot, world seed, company map or pending reward enters the backdrop API.

The composition reuses original painters and available v1 art with separate sky/ground caches, gentle parallax and restrained activity. One display Canvas and two cached bitmaps each have at most one million backing pixels; normal DPR is capped at two and reduced graphics at one. The existing scheduler targets thirty paints per second or twelve in reduced graphics, while reduced motion paints a static composition on invalidation. Hidden/inactive scenes stop scheduling; unmount releases observers, frames and bitmap storage. An original SVG scene remains available if Canvas or asset drawing fails, and menu controls remain independent of illustration success. These are source budgets rather than a physical-device performance measurement.

Gus, Mara, Ivo and Tessa have original 96×112 pixel SVG portraits. Neutral, amused, skeptical, excited, concerned and proud use authored facial details, with additional Gus poses. Named speakers and readable text remain the accessible identity; decorative duplicate portraits are hidden from assistive technology. The portraits are source-authored vector pixel geometry, with no remote image service, stock likeness, runtime AI generation or new workforce record. The existing atlas v1/v2 images and compiled metadata remain byte-preserved.

Dialogue advances immediately by touch, mouse or keyboard and can be skipped or revisited in history. There is no forced typewriter wait or recorded voice claim. Optional Gus commentary belongs to the company Training Journal; manual help remains available. See [the menu/tutorial guide](DEEP_CLAIM_MENU_TUTORIAL.md) for event, persistence and current verification details.

## Phase 7 Ancient Deep add-on

The Ancient Deep has known-ground basalt and hydrothermal detail, pale nickel seams and distinct sulfur beds. The nickel-alloy inventory icon is processed metal, never a generated terrain resource. A sixth-shaft appearance communicates constructed powered access; working Nickel Heat Shield art follows the actual owned head-slot item and its condition. The larger region introduces no hidden room prediction, speculative ore painting or decorative claim of installed ventilation.

V2 has 1,043 registered frame references sharing 345 unique pixel rectangles. Its committed dimensions are 512×384, compressed size is 8,782 bytes and base RGBA pixels occupy 786,432 bytes. The independent gate bounds it to 512×1024, 2MiB decoded pixels, 128KiB compressed and 2,048 registered references. The two committed atlases together use 4,063,232 base RGBA bytes (3.875MiB), excluding browser/GPU copies and object overhead.

This is an original additive source-art pack, not a replacement or rebake of the published v1 image. Cache keys include the known regional style so shallow and Ancient Deep rock cannot reuse an incorrect cached texture. Both images load without blocking play and retain observable failure/painter fallback. Regional rendering and audio consume public view context only; content below the supported 999m limit remains future work.

Small-phone review must verify both detailed and reduced-graphics output, real building hit regions and accessible list alternatives. Static public club illustrations continue to receive sanitized public data only; the authored private-mine atlas is not a reason to pass another member's save to a showcase.

## Phase 3 underground presentation

Known formations add cavern, wet cavern, crystal cavern and ruins treatments to the existing mine. Paint only formations present on revealed public tiles; the renderer must not reproduce the private generation algorithm or preview an undiscovered room. Keep the four regional styles—Surface, Ironworks, Glittering and Forgotten—coherent with coal/earth/brass rather than introducing unrelated visual themes at each chunk edge. This expansion keeps ten raw minerals and sixteen inventory identities; a decorative crystal is not a new resource ID.

Supports, ventilation, pump and rail markers represent actual infrastructure records. Building state should look like a crew project; installed state should clearly match the functional type and coverage information available in the operation UI. Remove decorative tunnel shoring that could be mistaken for installed protection. A visible timber cannot promise a mitigation bonus without the corresponding server record.

Find artwork covers banded geode, fern fossil, survey journal, rail relic, crystal cluster and meteorite fragment. Use distinct silhouettes and readable details, with quality accents that preserve the industrial-frontier palette. Map/cabinet imagery appears only for public recovered finds, not a future private roll. Keep/sell/salvage confirmations must identify the actual item and server value/materials rather than implying research, DH points or a complete museum system.

The mine shaft receives a real fifth-level appearance, while all seven company buildings remain in the initial camp overview. Map interactions retain named keyboard/list alternatives. Deep known-site focus may move the camera on request, but reduced motion must avoid long camera travel and no marker may reveal a hidden location.

Incident presentation explains a bounded setup delay. Do not draw a destroyed tunnel, injury, missing cargo or active gas event before the server publishes it. Optional local motion is communication only; it cannot choose a roll, resolve a project or reveal new terrain. Survey and infrastructure completion show field reports rather than decorative empty-haul collection buttons.

The Phase 3 procedural coverage includes four infrastructure types at three grades with construction/installed states, six specimens with four quality frames, and shaft level five. Formation joins follow known open neighbors only. Survey and construction use clipboard/scope or hammer poses without mining debris or mining audio; generic cosmetic underground shoring is removed. Explicit Locate requests focus a known point rather than selecting an unseen future room.

## Terrain and resources

The Canvas displays only the provided public chunks and committed terrain. Support dark unexplored fog, revealed rock, excavated passages, central access infrastructure, supports and bounded cargo details. Fog must conceal information cleanly; it should not suggest a visible vein that the server has not revealed.

The initial resource set is stone, clay, coal, copper ore, tin ore, iron ore, quartz and silver ore. Give each an identifiable vein pattern and restrained accent. Stone reads as broken gray facets, clay as warm horizontal bands, coal as charcoal fractures, copper as warm mineral flecks, tin as pale metallic grains, iron as rusty inclusions, quartz as angular light crystals and silver as sparse cool highlights. These are art cues; actual resource availability comes from the authoritative game state.

Phase 2 adds genuine deep amethyst and gold-bearing ore. Their illustrations must follow the new public terrain identities rather than painting unconfirmed deposits into the old mine. Keep processed copper, tin, iron and silver bars, polished quartz and cut amethyst visually distinct from raw ore. Finished bars use ingot silhouettes; polished/cut gems use deliberate facets. Their inventory icons describe owned goods or a clearly labelled recipe, never an uncollected reward already added to stock.

Avoid giant unbounded DOM tile grids. Cull chunks outside the viewport and paint pixels through Canvas 2D. Keep hit regions and overlays aligned with the same logical tile coordinates used by projection and camera transforms. Do not fetch or pre-render untouched private world data for decorative depth.

## Workers and buildings

Seven specialty silhouettes are part of the art framework: Miner, Geologist, Hauler, Engineer, Surveyor, Demolitionist and Safety Officer. Different tools, hats, packs and posture should identify roles before relying on a colored shirt. Phase 2 reuses these identities for daily candidates and hired workers; persistent worker identity must not be replaced by an anonymous repeated miner icon.

Worker states should communicate idle, walking, mining and hauling. Choose state and safe positions from the server’s expedition stage/projection. Short local animation loops are presentation only: they cannot excavate a block, reveal ore, grant cargo or advance a job.

The mine office, shaft, warehouse and tool station need level variants that visibly correspond to actual upgrades. Add structure, useful storage, machinery or access improvements; avoid presenting a number badge as the only visual change. Surface building targets must have accessible named alternatives in the operations UI.

Phase 2 adds workers’ quarters, smeltery and gem workshop, plus a fourth shaft level. Fit all seven operational buildings in the initial surface overview using their shared logical positions and actual sprite bounds. Level-zero/unbuilt structures must read as construction opportunities, not functional occupied buildings. Painting, pointer hitboxes and keyboard/list alternatives must reference the same building identities. Do not use the name FORGE for the tool station: DH Club already has an unrelated workout feature with that identity.

Equipment illustrations need recognizable pickaxes, lanterns, helmets and hauling/survey gear. Distinguish useful tiers without depending only on color, and give worn/broken items explicit condition indicators and text. Gear cards represent one owned item ID or a labelled recipe; they cannot suggest that a single item belongs to several workers. Production station effects can communicate an active server job without implying new inventory before settlement and collection.

Small surface crates, paths and fog overlays can reuse the painter's palette and geometry. Decorative objects must not look like clickable buttons, imitate installed underground protection or signal a reward that has not been earned.

Phase 4 adds Research Office and Trading Post variants tied to their real unlocked tiers. All nine building identities need accessible operational alternatives even when the player pans the surface. New bronze, steel and gold bars use distinct physical markings and labels; steel tool and cargo equipment must remain identifiable beyond hue. The business office uses the same industrial typography, brass focus treatment and compact portaled panels. No scene illustration or animation may imply a research reward or contract delivery before server confirmation.

Club presentation uses original static emblems, six project illustrations, company identity crests and kept-specimen display cases. Locked/open/completed artwork and progress derive from the authoritative public project state. Empty cabinets remain visibly empty. Public SVG components accept sanitized identities/specimens only; they never receive the private mine Canvas, employee roster, coordinates, jobs or full discovery records. The six established specimen silhouettes and quality frames remain consistent with the private cabinet. Shared presentation adds no animation loop or external art download.

## Camera, motion and performance

The side-on viewport supports deliberate pan/zoom, crew focus and keyboard alternatives. Pinch/wheel behavior must not hijack ordinary menu scrolling or make controls difficult to reach. Mobile controls respect safe areas and use approximately 44px touch targets where practical.

Use restrained feedback for confirmed mining, cargo, sales and construction. Reduced motion removes camera travel, nonessential looping movement and celebratory motion while preserving state readability. Reduced graphics should reduce decorative work without hiding functional information. Stop background frames when the page is hidden; renderer animation must never become the game’s clock.

Avoid heavy particle systems, excessive blur and large game-engine dependencies. Reuse procedural pieces and bounded effects. Actual frame scheduling, culling and cleanup behavior must be covered by renderer tests or browser verification, rather than assumed from this specification.

## Audio direction and controls

Phase 1 introduced a short synthesized frontier motif and mining/company cues. Phase 6 replaces that repeating bed with five source-composed sixteen-bar, sixty-four-beat miniatures. Each has written melody, bass, sparse harmonic pad and answering notes, retaining a shared claim motif. Playback uses oscillators and a deterministic locally generated noise buffer rather than downloaded recordings.

| Scene | Original miniature | Tempo | One 64-beat arrangement |
|---|---|---:|---:|
| Surface | Lanterns at the Claim | 84 BPM | About 45.71s |
| Shallow mine | Footfalls Under Clay | 72 BPM | About 53.33s |
| Ironworks | The Copper Counterweight | 78 BPM | About 49.23s |
| Crystal region | A Prism Keeps the Light | 68 BPM | About 56.47s |
| Forgotten region | The Archive Below | 64 BPM | 60s |
| Ancient Deep | A Lantern in the Ancient Deep | 64 BPM | 60s |

Phase 7 adds the Ancient Deep miniature without changing the five earlier composition fingerprints. These are adaptive looping arrangements, with one scene score at a time. Scene selection uses the visible surface/mine view and public depth, with known formation ambience only. Stone, earth, carbon, metal and crystal material families have distinct mining timbres; disclosed nickel and sulfur receive the new material treatments. Unknown or undisclosed materials use a generic stone cue.

Audio starts only after a user gesture and opt-in. Master volume is supplemented by independent `musicVolume`, `ambientVolume` and `sfxVolume` settings between zero and one. Older saved settings default each new bus to one and retain their existing master choice and volume. Existing application master/category gates remain authoritative. In-game occlusion pauses background music/ambience while permitted interface/reward cues can remain available; the title reuses the existing surface arrangement. Menu selection/back, title and tutorial step/chapter cues share the existing controller, buses and voice budget. Hidden/inactive pages, mute and disposal stop scheduling and release voices; a delayed context resume cannot revive muted or disposed playback.

The total cap remains fourteen voices, with at most eight music and three ambient voices. Music scheduling uses a 0.65-second lookahead at 250ms intervals; ambient-only scheduling sleeps for 1,000ms between checks. A muted or background-paused scene has no continuing music/ambient interval. One second of mono float noise is generated locally: 192,000 bytes at a 48kHz context rate, with actual buffer size proportional to the browser's sample rate. This is a concrete memory description rather than a physical-device performance guarantee.

Preference storage must be documented using the actual renderer/audio implementation’s keys. No account, company, inventory or private expedition content belongs in a device-wide audio preference record.

Logical terrain tiles remain 16×16 pixels with crisp Canvas scaling and no image smoothing. The initial worker animation used four poses at 220ms with alternating legs and pickaxe directions; the authored pack retains that timing contract, and reduced motion holds a stable pose. Phase 2 initially covered sixteen inventory goods, ten equipment definitions and seven buildings. Later phases extend these to nineteen goods, twelve equipment definitions and nine buildings, with shaft levels one through five, research-office levels zero through two and the other added buildings zero through three. Actual atlas coverage belongs to the generated manifest rather than an assumed purchased pack.

Production effects derive activity from the public job’s real start/end timestamps; ready indicators require the server-ready status. Worker attachments require an actual owned assignment and respect broken condition. Early renderer expansions did not add music; the Phase 6 score is explicitly documented above.

Audio settings use `dh:deep-claim:audio:v1:<encoded-user-id>`. Graphics/motion preferences use `dh:deep-claim:visuals:v1:<user-id>`. Discovery presentation receipts use `dh:deep-claim:reveals:v1:<user-id>:<club-id>:<company-id>` and contain only reveal bookkeeping, never ownership or a keep/sell/salvage decision. These are device preferences, separate from company state and the pending-transaction recovery namespace. Audio attenuates distant effects and honors the existing app sound gate. Its native browser scheduling tests do not establish performance on physical phones or audio hardware.

## Attribution and future replacement

The original inline SVGs, source-authored pixel primitives, pack details and written score are project artwork. Synthesized notes and deterministic noise use no third-party recording. Any later external font, image, texture, animation or recorded audio must be listed with its source and license before shipping. Do not describe generated source primitives as commissioned painting or an untracked download as original.

A future pack must preserve stable asset IDs, logical dimensions, worker-state semantics and building-level references so art upgrades do not invalidate saved companies. Additional animation, recorded music and broader authored scenes can replace pieces incrementally after visual, accessibility and hardware review; game mechanics remain independent of the painter.
