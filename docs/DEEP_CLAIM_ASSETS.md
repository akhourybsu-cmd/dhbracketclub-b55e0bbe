# Deep Claim visual and audio specification

Deep Claim uses an original industrial-frontier identity: a working company and an inhabited mine, with restrained pixel geometry, warm metal, worn earth and readable equipment. The game should feel physical and useful, with ore and the active crew carrying the brightest accents.

This is the Phase 0 art direction and the Phase 1–5 asset contract. The implementation ledger records which renderer/audio features have been verified. **The original procedural artwork is not a finished commercial sprite atlas; the complete atlas, expanded animations and full soundtrack remain Phase 6 work.**

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

## Source inventory and ownership

| Source | Purpose |
|---|---|
| `src/components/deepClaim/DeepClaimMark.tsx` | Original inline SVG shaft-and-ore emblem for the game and discovery surfaces. |
| `src/components/deepClaim/DeepClaimDiscoveryCard.tsx` | Compete entry using the same emblem and restrained company palette. |
| `src/components/deepClaim/renderer/DeepClaimCanvas.tsx` | Canvas 2D side-on company/mine renderer; implementation owned by the renderer module. |
| `src/components/deepClaim/renderer/artManifest.ts` | Procedural art manifest, palette and supported mineral/worker/building identities; authoritative coverage is the exported manifest, not an assumed external atlas. |
| `src/components/deepClaim/renderer/pixelArt.ts` | Original Canvas terrain, worker and building painters. |
| `src/components/deepClaim/renderer/DeepClaimIcons.tsx` | Matching local pixel SVG icons for resources, buildings and equipment in management views. |
| `src/components/deepClaim/renderer/productionVisuals.ts` | Public job-clock and owned-equipment presentation; it never grants output or invents a private job stage. |
| `src/components/deepClaim/renderer/fieldSprites.ts` | Original support/ventilation/pump/rail sprites and the six recovered-specimen illustrations. |
| `src/components/deepClaim/renderer/fieldAtlas.ts` | Bounded field-art caching, infrastructure states and selected Manhattan coverage. |
| `src/components/deepClaim/renderer/fieldVisuals.ts` | Known/depleted formation indexing and public recovered-find/time filtering. |
| `src/lib/deepClaim/audio.ts` | Original synthesized mining/company cues and an initial musical motif; user-gesture activation only. |

Renderer and audio filenames are integration contracts. Check their actual committed contents and the implementation ledger before treating a listed capability as delivered. There are no stock image, runtime image-generation or external audio-service dependencies in the Phase 1–3 art plan.

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

Small shoring details, crates, paths and fog overlays can reuse the procedural painter’s palette and geometry. Decorative objects must not look like clickable buttons or signal a reward that has not been earned.

Phase 4 adds Research Office and Trading Post variants tied to their real unlocked tiers. All nine building identities need accessible operational alternatives even when the player pans the surface. New bronze, steel and gold bars use distinct physical markings and labels; steel tool and cargo equipment must remain identifiable beyond hue. The business office uses the same industrial typography, brass focus treatment and compact portaled panels. No scene illustration or animation may imply a research reward or contract delivery before server confirmation.

Club presentation uses original static emblems, six project illustrations, company identity crests and kept-specimen display cases. Locked/open/completed artwork and progress derive from the authoritative public project state. Empty cabinets remain visibly empty. Public SVG components accept sanitized identities/specimens only; they never receive the private mine Canvas, employee roster, coordinates, jobs or full discovery records. The six established specimen silhouettes and quality frames remain consistent with the private cabinet. Shared presentation adds no animation loop or external art download.

## Camera, motion and performance

The side-on viewport supports deliberate pan/zoom, crew focus and keyboard alternatives. Pinch/wheel behavior must not hijack ordinary menu scrolling or make controls difficult to reach. Mobile controls respect safe areas and use approximately 44px touch targets where practical.

Use restrained feedback for confirmed mining, cargo, sales and construction. Reduced motion removes camera travel, nonessential looping movement and celebratory motion while preserving state readability. Reduced graphics should reduce decorative work without hiding functional information. Stop background frames when the page is hidden; renderer animation must never become the game’s clock.

Avoid heavy particle systems, excessive blur and large game-engine dependencies. Reuse procedural pieces and bounded effects. Actual frame scheduling, culling and cleanup behavior must be covered by renderer tests or browser verification, rather than assumed from this specification.

## Audio direction and controls

Phase 1 audio consists of original Web Audio synthesis: a restrained frontier/pentatonic motif and useful cues for mining, hauling/cargo and building actions. This is initial audio, not a licensed recording collection or a complete soundtrack.

Audio starts only after a user gesture and opt-in. Provide master, music, effects and ambient controls, a clear mute state and persisted preferences. Suspend playback when the page is hidden and limit overlapping voices. Avoid a loud effect for every background frame or simulated worker swing. A returning player must not be greeted by unsolicited autoplay.

Preference storage must be documented using the actual renderer/audio implementation’s keys. No account, company, inventory or private expedition content belongs in a device-wide audio preference record.

The Phase 1 logical terrain tile is 16×16 pixels with crisp Canvas scaling and no image smoothing. Its procedural worker animation uses four poses sampled at 220ms, with two alternating leg positions and two pickaxe directions; reduced motion holds a still pose. The Phase 2 manifest covers ten raw mineral treatments, sixteen inventory icons and ten equipment definitions across five archetypes/two tiers with broken states. Seven buildings fit the camp overview: the shaft has levels one through four, the other original buildings one through three, and the new buildings zero through three. It remains a procedural first pass, not a completed sprite-pack commission.

Production effects derive activity from the public job’s real start/end timestamps; ready indicators require the server-ready status. Worker attachments require an actual owned assignment and respect broken condition. The existing audio module is unchanged in Phase 2; renderer expansion does not imply a new soundtrack.

Audio settings use `dh:deep-claim:audio:v1:<encoded-user-id>`. Graphics/motion preferences use `dh:deep-claim:visuals:v1:<user-id>`. These are device preferences, separate from company state and from the private pending-transaction recovery namespace. Audio limits fourteen simultaneous voices, attenuates distant effects, honors the existing app sound gate, and suspends scheduling while backgrounded. The synthesized motif is original initial presentation, not the promised complete Phase 6 soundtrack.

## Attribution and future replacement

Phase 1–3 inline SVG and procedural shapes are original project artwork; synthesized notes and effects require no third-party sample attribution. Any later external font, image, texture, animation or recorded audio must be listed with its source and license before shipping. Do not claim that an untracked downloaded asset is original.

A later atlas should preserve stable asset IDs, logical dimensions, worker-state semantics and building-level references so art upgrades do not invalidate saved companies. Phase 6 can replace procedural pieces incrementally after visual and accessibility review; game mechanics remain independent of the painter.
