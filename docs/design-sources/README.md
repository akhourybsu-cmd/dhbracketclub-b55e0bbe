# Draft Arena emblem source

`draft-emblem-master.png` is the unchanged 1024×1024 RGBA source, retained for future design work. It is outside the runtime asset graph.

All nine app consumers use `src/assets/draft-emblem.webp`: 512×512, 56,398 bytes, preserving the composition and transparent padding. The previous delivery was 1,124,477 bytes. The delivery asset is about 95% smaller and covers the current maximum 232px presentation at double density.

Repeatable encoding (ImageMagick with WebP support):

```sh
magick docs/design-sources/draft-emblem-master.png -resize 512x512 -quality 92 -define webp:alpha-quality=100 src/assets/draft-emblem.webp
```

This is a delivery optimization of the same artwork, with no generated replacement or branding change. Alpha comparison against the 512px reference is part of the visual pass.
