# Mesomon · Port Marche art and audio

This chapter uses an original, cohesive first-pass pixel-art set authored for the game. These are working game assets, rather than commissioned final character illustrations. Every tile, sprite silhouette, portrait, scene composition and musical phrase is defined in the repository; no commercial game image, map, recording, font or melody supplied source material.

## Pixel specification

- World tiles:16×16px. Native camera:160×144px, with smoothing disabled and integer logical positions.
- Tavian and people:16×16px cells. Each row has down/left/right/up × idle/two walking frames, then interaction, bracing and hurt frames. Tavian's anatomical left cuff is explicitly placed per direction.
- Creature overworld atlas:16×16px cells with a dedicated front, profile and back drawing for each species. Down, left, right and up each have two movement frames. Boots and paws meet the lower tile edge. The winged species hovers above a grounded shadow.
- Battle illustrations and dialogue/party portraits:48×48px transparent images. Rillik's tail-ring, Muddren's reinforced back, Gleamwing's lantern-like wings, Tressel's rope-tail and the Wretch's broken asymmetry distinguish silhouettes.
- Cover:320×180px, showing the working harbor, the skyline beyond the district, a crane, Tavian and Rillik.
- Light comes from the upper left. Hard edges, charcoal outlines, warm brass and sea-glass accents unite the set. No blur, antialiasing, emoji or external image-generation request is used.

Dock planks, paving, grass and wave marks use lower-contrast detail around the actors. Both travel atlases share the 16-pixel ground grid, and the camera centers on the player’s tile midpoint.

The source is `scripts/generate-mesomon-assets.py`. Run `python scripts/generate-mesomon-assets.py` with Pillow to regenerate the exact files in `public/games/mesomon/`. This authoring tool is not shipped in the browser and adds no runtime dependency. `manifest.json` and `src/lib/mesomon/assets.ts` describe frame geometry and filenames. Individual `/games/mesomon/portraits/{id}.png` files serve accessible DOM dialogue and party panels without loading Phaser.

## Rendering

Phaser3 is loaded inside `createMesomonView` after entry to the lazy Mesomon route. A cached terrain canvas is built from the authoritative typed map; the viewport draws that layer plus a small number of actors and bounded water/current effects. No React DOM element represents an individual tile. Only the current map's terrain texture is retained. NPC interaction taps pass IDs to the pure reducer, which owns proximity and story authorization.

The renderer does not move the canonical player, resolve battles, change quests, determine rewards or write saves. Walking interpolation illustrates committed tile movement. Canvas is hidden from assistive technology because the shell supplies map/objective text and nearby interaction controls. All effects become static under reduced motion. The app’s accessible DOM seal ring owns both its phase and input accuracy; Seal Assist bypasses timing in the engine. An optional renderer ring is available to callers that use its matching `sealAccuracy()` method, and is disabled in the app to avoid competing clocks.

A view queues updates during preload, reports asset failure through `onError`, and exposes a bounded boot timeout. Route cancellation can abort before import or during preload; `destroy()` removes the canvas and Phaser input/timer/texture lifecycle. No global keyboard or browser gesture handler is registered by the renderer.

## Audio

`MesomonAudio` synthesizes an original compact score with Web Audio. No audio context exists until a player gesture calls `unlock()`. Harbor, workshop, under-wharf, battle and Rift Wretch phrases have different rhythms and registers. Short confirm/cancel/menu cues, species cries, a spare four-note bond motif and a dissonance-to-resolution seal cue use the same bounded voice pool.

Music and ambient volumes are independent, and the saved mute preference applies to every bus. Background/menu pause stops scheduled voices and the single scheduling timer. Destroy closes the context and disconnects every node. Browsers lacking Web Audio remain playable. Audio is presentation only and never advances gameplay.
