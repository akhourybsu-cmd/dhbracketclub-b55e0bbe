# Draft Arena asset and alignment pass

This pass preserves draft rules, scoring, permissions, saved picks and reports. It focuses on delivery, image lifecycle, alignment and navigation on small and large screens.

| Surface | Change |
| --- | --- |
| Arena emblem | All nine consumers load a 512px transparent WebP, 56,398 bytes instead of 1,124,477 bytes (about 95% smaller). The unchanged 1024px PNG master is retained under `docs/design-sources/`, outside the runtime bundle. |
| Pick artwork | Cover and contain layouts retain a fixed frame. Full-size failures retry available thumbnail variants before showing initials. Cached, slow, failed and stale image events cannot expose an old candidate or retain initials behind loaded artwork. |
| Image selection | Six choices per page, bounded preview and visible failure states. A broken or loading selection cannot be saved. The existing enrichment ID and the same three image metadata fields remain the only update target. |
| Identity | Shared initials preserve Unicode graphemes, including emoji and combining characters. Podium avatars use an error fallback and reset when identity changes. |
| Charts and clocks | Career chart gradients use unique SVG IDs. Clock rings keep their aspect ratio and allow halo overflow without changing timer calculations. |
| Controls and text | Draft action controls retain 44px targets; long titles, names and source labels wrap or truncate within bounded columns. The narrow draft desk puts management controls on their own row. |
| Round navigation | The selected round remains centered after viewport changes, including desktop-to-phone rotation. Hidden tracks cannot reset selection. Round buttons support Arrow, Home and End keys. Snake-order calculations are unchanged. |
| Secondary screens | Archive links avoid nested interactive controls. Recaps, podiums, magazine navigation, career charts and achievement controls use bounded layouts and reachable actions. |

## Verification

- 1,039 unit tests across 128 files pass, including artwork lifecycle, Unicode initials, hidden-track round selection and identity reset regressions.
- TypeScript and the production build pass. The build emits the 56.40kB WebP and excludes the original PNG master.
- The isolated browser harness passes 321 checks at eight distinct sizes: 320×568, 360×740, 390×844, 430×932, 768×1024, 844×390, 1440×900 and 1920×1080. Coverage includes light/dark themes, all four palettes, reduced motion, 200% root font sizing and a short focused creation viewport.
- Stress journeys exercise 20 participants, 10 rounds, 120 existing picks, long multilingual titles, final-player reachability, final-log-entry reachability, phone rotation and keyboard navigation. Artwork tests cover wide, portrait, square, broken and delayed renditions plus a tenth paginated choice.
- Secondary journeys cover archived season recaps, broken podium avatars, magazine timeline reachability and career chart gradients at phone, landscape and desktop sizes. Screenshots use the production font stack.
- Preservation checks retain 40 critical declarations, 12 byte-identical core files, and the projector's full AST apart from its explicitly allowed initials helper and import. Five negative probes reject unrelated projector changes.

Browser identity, images and network transport are local fixtures. These checks do not write to live player accounts or prove behavior on every physical device or third-party image service.

The [subsequent refinement pass](DRAFT_ARENA_REFINEMENT.md) extends this coverage to the real standalone projector, room transitions, recovery states and accessible host settings.
