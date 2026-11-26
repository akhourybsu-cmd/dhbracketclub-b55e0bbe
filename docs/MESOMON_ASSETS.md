# Mesomon · Port Marche art and audio

Port Marche combines native pixel art for the world with illustrated creature plates for close views. The master artwork, pose definitions and rendering code are kept in the repository.

## Pixel specification

- World tiles:16×16px. Native camera:160×144px, with smoothing disabled and integer logical positions.
- Tavian and people:16×16px cells. Each row has down/left/right/up × idle/two walking frames, then interaction, bracing and hurt frames. Tavian's anatomical left cuff is explicitly placed per direction.
- Creature overworld atlas:16×16px cells with a dedicated front, profile and back drawing for each species. Down, left, right and up each have two movement frames. Boots and paws meet the lower tile edge. The winged species hovers above a grounded shadow.
- Human dialogue portraits use 48×48px cells. Five original full-body creature illustrations supply both battle poses and Field Guide plates. Rillik’s sea-glass tail ring, Muddren’s layered scutes, Gleamwing’s lantern windows, Tressel’s curled rope tail and the Wretch’s floating shards remain legible in silhouette.
- The 320×180px cover places Tavian and Rillik on a timber jetty, with a moored sailing boat, a tide beacon and a distant customs skyline.
- The 216×90px Fieldcase still life shows Tavian’s brass survey cuff and unlit Edenite core beside cord and a folded letter in a felt-lined travel case.
- The transparent 128×64px scenery atlas holds a 48×48px cargo crane, a 32×32px tide-stair wheel and a 48×32px skiff. The underwharf sluice has its own 16×24px lever cabinet. Its red grip drops and the counterweight rises when the crossing drains.
- `renderer/interiors.ts` paints room illustrations into the cached map at native resolution. Edda’s workbench, the unfinished sail and her tide plots sit on the workshop floor plan. The passage’s barred outfall, tide staff and pier posts follow its existing masonry and walking lanes.
- Upper-left light, charcoal contours, warm brass and sea-glass accents unite the world and the field plates. The creature illustrations use finer edges and directional shading on fur, armor, wing membranes and stone.

Slate joints, dock planks and water use lower-contrast accents around the actors. The Wayfarer’s copper vent hood, glazed door and portholes fit one 48×48px deckhouse illustration, sliced into nine terrain cells. Each human speaker has a dedicated three-quarter bust, with trade clothing and personal details visible at dialogue scale. Both travel atlases share the 16-pixel ground grid, and the camera centers on the player’s tile midpoint.

Run `python scripts/generate-mesomon-assets.py` with Pillow to rebuild the native pixel art and manifest. Dialogues use individual PNGs so they can display independently of Phaser.

The five transparent master cutouts in `art/mesomon/creatures/` were made for Port Marche with the built-in image generator and cleaned against their original matte. Run `python scripts/build-mesomon-creature-art.py` to compile them, or add `--check` to compare the published pixels with the masters. The compiler produces five 512×512 transparent WebP field plates and a 768×960 battle atlas. Each row is one species, facing right. Its four 192×192 cells show rest, ready, action and recoil. Articulated pose definitions and a shared foot baseline keep wings, paws and loose shards attached to the same figure through a turn.

The battle camera draws the atlas on a 640×576 backing canvas while preserving the stage’s 160×144 logical composition. Opponents face each other. Reduced motion shows each action as a fixed pose. Opening **Start → Field Guide** loads plates for the species the player has encountered. Existing save receipts populate the guide on first open.

## Rendering

`exteriors.ts` paints the ferry and quay architecture. `workshop.ts` places Edda’s furniture, documents and exit against the interaction grid. `tideworks.ts` paints the wheel rack, crossing and basin from their saved story flags. The renderer rebuilds the relevant cached room when its mechanism changes. `environmentMotion.ts` draws short sequences of integer-pixel water, light and air details within the camera bounds. Opening the chart pauses the scene.

Foreground fixtures have a world-space foot position so an actor can walk behind the hoist, lantern and tide gauge. In the lower quay, the bell and rope rack share their workers’ tiles and the survey compass lies flush with the paving. Transparent interaction art sits directly on the scene. Taps on a painted desk, doorway or gangplank use the visible object’s bounds. In the chamber, the basin water blocks movement and a dry service platform leads up to the rift.

### Walking through the port

| Location | Field artwork and motion |
| --- | --- |
| Wayfarer | Two deckhouses frame the captain’s aisle. The rigging rises above a compass set into the deck. A tern perches on the rail and the starboard tackle can pass in front of Tavian. |
| Lower quay | Timbers and wet braces support the freight wharf. Its tide staff sits in the water beside the arrival pier. Stalls and workstations line the paved route from the docks. |
| Edda’s workshop | The loft windows look across to the opposite quay. A test pennant stirs beside the spools. After Tavian recovers the page, the kettle glows and sends steam up from its spout. |
| Old tide stairs | Raking light reveals worn steps and a brass rail. Repairing the wheel carries runoff around the service dock and through an outfall in the east bank. |
| Under-wharf passage | A float behind glass follows the level of the crossing. Opening the sluice lowers the float and sends water to the three outlets beneath the grille. |
| Rift chamber | Vaults rise behind the stone dial. Two currents cross the basin in opposite directions. After the seal, the pools equalize and reflections move together. |

Foreground pieces share the walking characters’ depth order. Tavian’s shadow stays on the ground as his foot lifts, and soft ground briefly shows a heel mark or a bent reed. Reduced motion draws the stationary scene for the current story state, including the kettle fire, float height and water levels.

Phaser3 is loaded inside `createMesomonView` after entry to the lazy Mesomon route. A cached terrain canvas is built from the authoritative typed map; the viewport draws that layer plus a small number of actors and bounded water/current effects. No React DOM element represents an individual tile. Only the current map's terrain texture is retained. NPC interaction taps pass IDs to the pure reducer, which owns proximity and story authorization.

The renderer does not move the canonical player, resolve battles, change quests, determine rewards or write saves. Walking interpolation illustrates committed tile movement. Canvas is hidden from assistive technology because the shell supplies map/objective text and nearby interaction controls. All effects become static under reduced motion. The app’s accessible DOM seal ring owns both its phase and input accuracy; Seal Assist bypasses timing in the engine. An optional renderer ring is available to callers that use its matching `sealAccuracy()` method, and is disabled in the app to avoid competing clocks.

Before starting the scene, the browser decodes the local PNG sheets. The renderer checks the source dimensions and registered frame counts before it marks the canvas ready. This lets the UI offer a retry when a browser cannot decode the art. The browser suite also samples the painted scene at native resolution. A view queues updates during preload, reports asset failure through `onError`, and exposes a bounded boot timeout. Route cancellation can abort before import or during preload; `destroy()` removes the canvas and Phaser input/timer/texture lifecycle. No global keyboard or browser gesture handler is registered by the renderer.

### Battle locations and move effects

The maintenance sluice, lantern alcove and rift chamber each have a painted waterline and two landing surfaces aligned to the creatures’ feet. The cropped original environment artwork is in `art/mesomon/battle-scenes/`. Run `python scripts/build-mesomon-battle-scenes.py` to compile the 640×576 WebP stages or use `--check` to verify the shipped files. The game requests a stage on entering that encounter. Native geometry supports the entire fight while the image loads or if the device is offline.

Version 3 turns store the move or field action on each beat. Phaser uses this to place the water jet, splinters, veil, healing glints and rift pulses on the right fighter. Reduced motion uses fixed cues. Older saved turns can finish with their original action and impact poses.

## Audio

`MesomonAudio` synthesizes an original compact score with Web Audio. No audio context exists until a player gesture calls `unlock()`. Harbor, workshop, under-wharf, battle and Rift Wretch phrases have different rhythms and registers. Move-specific attack, support and impact sounds follow the saved turn. Short confirm/cancel/menu cues, species cries, a spare four-note bond motif and a dissonance-to-resolution seal cue use the same bounded voice pool.

Music and ambient volumes are independent, and the saved mute preference applies to every bus. Background/menu pause stops scheduled voices and the single scheduling timer. Destroy closes the context and disconnects every node. Browsers lacking Web Audio remain playable. Audio is presentation only and never advances gameplay.
