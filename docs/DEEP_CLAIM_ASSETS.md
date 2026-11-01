# Deep Claim visual and audio specification

Deep Claim uses an original industrial-frontier identity: a working company and an inhabited mine, with restrained pixel geometry, warm metal, worn earth and readable equipment. The game should feel physical and useful, with ore and the active crew carrying the brightest accents.

This is the Phase 0 art direction and Phase 1 asset contract. The implementation ledger records which renderer/audio features have been verified. **Phase 1 procedural artwork is not a finished commercial sprite atlas; the complete atlas, expanded animations and full soundtrack remain Phase 6 work.**

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
| `src/components/deepClaim/renderer/artManifest.ts` | Planned/current procedural art manifest; authoritative coverage is the exported manifest, not an assumed external atlas. |
| `src/lib/deepClaim/audio.ts` | Original synthesized mining/company cues and an initial musical motif; user-gesture activation only. |

Renderer and audio filenames are integration contracts. Check their actual committed contents and the implementation ledger before treating a listed capability as delivered. There are no stock image, runtime image-generation or external audio-service dependencies in the Phase 1 art plan.

## Terrain and resources

The Canvas displays only the provided public chunks and committed terrain. Support dark unexplored fog, revealed rock, excavated passages, central access infrastructure, supports and bounded cargo details. Fog must conceal information cleanly; it should not suggest a visible vein that the server has not revealed.

The initial resource set is stone, clay, coal, copper ore, tin ore, iron ore, quartz and silver ore. Give each an identifiable vein pattern and restrained accent. Stone reads as broken gray facets, clay as warm horizontal bands, coal as charcoal fractures, copper as warm mineral flecks, tin as pale metallic grains, iron as rusty inclusions, quartz as angular light crystals and silver as sparse cool highlights. These are art cues; actual resource availability comes from the authoritative game state.

Avoid giant unbounded DOM tile grids. Cull chunks outside the viewport and paint pixels through Canvas 2D. Keep hit regions and overlays aligned with the same logical tile coordinates used by projection and camera transforms. Do not fetch or pre-render untouched private world data for decorative depth.

## Workers and buildings

Seven specialty silhouettes are part of the art framework: Miner, Geologist, Hauler, Engineer, Surveyor, Demolitionist and Safety Officer. Different tools, hats, packs and posture should identify roles before relying on a colored shirt. The existence of a silhouette does not imply that the corresponding hiring feature is available in Phase 1.

Worker states should communicate idle, walking, mining and hauling. Choose state and safe positions from the server’s expedition stage/projection. Short local animation loops are presentation only: they cannot excavate a block, reveal ore, grant cargo or advance a job.

The mine office, shaft, warehouse and tool station need level variants that visibly correspond to actual upgrades. Add structure, useful storage, machinery or access improvements; avoid presenting a number badge as the only visual change. Surface building targets must have accessible named alternatives in the operations UI.

Small shoring details, crates, paths and fog overlays can reuse the procedural painter’s palette and geometry. Decorative objects must not look like clickable buttons or signal a reward that has not been earned.

## Camera, motion and performance

The side-on viewport supports deliberate pan/zoom, crew focus and keyboard alternatives. Pinch/wheel behavior must not hijack ordinary menu scrolling or make controls difficult to reach. Mobile controls respect safe areas and use approximately 44px touch targets where practical.

Use restrained feedback for confirmed mining, cargo, sales and construction. Reduced motion removes camera travel, nonessential looping movement and celebratory motion while preserving state readability. Reduced graphics should reduce decorative work without hiding functional information. Stop background frames when the page is hidden; renderer animation must never become the game’s clock.

Avoid heavy particle systems, excessive blur and large game-engine dependencies. Reuse procedural pieces and bounded effects. Actual frame scheduling, culling and cleanup behavior must be covered by renderer tests or browser verification, rather than assumed from this specification.

## Audio direction and controls

Phase 1 audio consists of original Web Audio synthesis: a restrained frontier/pentatonic motif and useful cues for mining, hauling/cargo and building actions. This is initial audio, not a licensed recording collection or a complete soundtrack.

Audio starts only after a user gesture and opt-in. Provide master, music, effects and ambient controls, a clear mute state and persisted preferences. Suspend playback when the page is hidden and limit overlapping voices. Avoid a loud effect for every background frame or simulated worker swing. A returning player must not be greeted by unsolicited autoplay.

Preference storage must be documented using the actual renderer/audio implementation’s keys. No account, company, inventory or private expedition content belongs in a device-wide audio preference record.

The shipped logical terrain tile is 16×16 pixels with crisp Canvas scaling and no image smoothing. Procedural worker animation uses four poses sampled at 220ms, with two alternating leg positions and two pickaxe directions; reduced motion holds a still pose. Building level artwork adds actual structure and machinery across levels one through three. The manifest records all eight material treatments, seven specialty silhouettes and surface props.

Audio settings use `dh:deep-claim:audio:v1:<encoded-user-id>`. Graphics/motion preferences use `dh:deep-claim:visuals:v1:<user-id>`. These are device preferences, separate from company state and from the private pending-transaction recovery namespace. Audio limits fourteen simultaneous voices, attenuates distant effects, honors the existing app sound gate, and suspends scheduling while backgrounded. The synthesized motif is original initial presentation, not the promised complete Phase 6 soundtrack.

## Attribution and future replacement

Phase 1 inline SVG and procedural shapes are original project artwork; synthesized notes and effects require no third-party sample attribution. Any later external font, image, texture, animation or recorded audio must be listed with its source and license before shipping. Do not claim that an untracked downloaded asset is original.

A later atlas should preserve stable asset IDs, logical dimensions, worker-state semantics and building-level references so art upgrades do not invalidate saved companies. Phase 6 can replace procedural pieces incrementally after visual and accessibility review; game mechanics remain independent of the painter.
