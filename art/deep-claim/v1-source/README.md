# Released v1 authoring archive

These twelve inputs are copied byte-for-byte from commit `e2498e9a313a7d26c1b3eb4da6dbbf6548af42e9`. `archive.json` records their original paths, individual SHA-256 values and published aggregate source hash. Preserve these files when extending future art packs.

The live `scripts/build-deep-claim-atlas.mjs` router executes the archived original compiler with its imports rooted here. Only its output paths are redirected to the existing runtime PNG and metadata. Its original compiler bytes and all original relative input names remain part of the unchanged provenance hash. This keeps `node scripts/build-deep-claim-atlas.mjs --check` reproducible as live gameplay types and future artwork evolve.

Version 2 is an independent authored add-on. It does not rebuild or recolor these released v1 images.
