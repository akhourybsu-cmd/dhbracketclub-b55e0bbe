# Frontier Pixel Pack v1

This is original source-authored pixel artwork for Deep Claim. It is compiled pixel geometry, not a commissioned or commercially painted sprite pack. It contains no stock art, emoji, runtime image generation, private world seeds or player state.

`pack-v1.json` is the editable palette-coordinate source for distinct mineral veins, building joinery, worker stitching and small atmospheric props. The existing `pixelArt.ts` and `fieldSprites.ts` files author the underlying silhouettes, upgrade stages, worker poses and field assets. All are recorded as explicit source dependencies in the generated manifest.

Run `node scripts/build-deep-claim-atlas.mjs` after editing the source. Commit both `public/deep-claim/atlas-v1.png` and `src/components/deepClaim/renderer/generated/atlas-v1.json`. Run the same command with `--check` to verify byte-for-byte reproducibility. The compiler uses the repository's existing TypeScript development dependency and Node built-ins, including its own small RGBA rasterizer and PNG encoder. It needs no image editor, native graphics library or new package.

The atlas is 1,024 pixels wide, has one pixel of transparent padding, and cannot exceed 2,048 pixels high or 8 MiB of decoded RGBA memory. Identical frames share source rectangles. Registered frame references and unique pixel rectangles are different counts. Metadata includes the source SHA-256, compressed size and exact frame bounds.

Terrain uses 16×16 logical pixels. Worker bodies use 24×32 frames anchored at 12,28; four 220 ms frames cover each of seven roles, seven declared poses and four existing appearance variants. Actual tools, helmets, utility gear, damage and small activity effects are composed over these bodies without multiplying every equipment combination into a new image. Building bases cover all nine real buildings and supported levels; unbuilt structures remain marked plots. Furnace light, research light, ready crates and other operational overlays continue to use actual server state.

The renderer preloads one image without blocking play. Native decoding must succeed and match the declared dimensions before the atlas is used. Loading, decoding, timeout or drawing failure retains source-painted artwork and functional controls, with no automatic retry loop. Subscribers receive readiness changes so reduced-motion canvases also update without polling. Public club showcases keep their sanitized inline SVG artwork and never receive a private mine snapshot.
