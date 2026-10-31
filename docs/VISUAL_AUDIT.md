# Visual layers and current assets

This pass inventories repository-owned assets and route declarations, checks current feature entry points, and exercises representative production screens against isolated fixtures. It does not delete member uploads, club logos or saved game data. Rune Delve's Combat Archive remains available.

## Changes

| Layer | Finding and correction |
| --- | --- |
| Branding and sharing | Replaced the old generated preview screenshot and unrelated social handle with the current green DH mark. Corrected the installed-app icon's declared dimensions, reused the smaller current icon for the favicon, and allowed responsive app rotation. |
| Retired assets | Removed the unreferenced 2.16 MB blue DH Bracket Club logo and the obsolete 341 KB eight-creature sheet. Current Rune portraits, realm artwork and Archive assets remain connected. |
| Shared shell | Header elevation and active-tab return-to-top now follow the actual body scroller. Drawer dismissal returns focus to its opener without moving the page; navigation dismissal leaves the destination's focus alone. Reduced motion removes tab travel. |
| Shared overlays | Dialog close and theme controls have 44px targets. Long default dialogs stay within the viewport and can scroll to their final action. Headings reserve space for the close control. |
| Feature introductions | Updated Nexus, Portfolio Wars, Rankings, The Drop, Discussions and Shared Media to their actual current behavior. One onboarding icon map supplies both introduction flows. The Home introduction describes the current Home screen. |
| Feature catalog | Updated five public catalog descriptions and aligned Posts with the visible Discussions name. Before/after fingerprints matched for all installation settings and club installations. |
| Connections | The activity feed's Post link now opens the real discussion composer. Missing route titles are present. Older Rune recovery, hero-creation and back links return to the Combat Archive, including the result compatibility redirect. |
| Rune scenery | Puzzle scenery derives from its room or puzzle frontier and no longer reads archived combat progression. The three puzzle chapters retain their corresponding current realm art. |
| Retired Drop styling | Removed 48 unused classes, 92 obsolete rules and two old animations, about 10.8 KB. Current feed, calendar, Home and compatibility styles remain. |
| Thumbnail layers | Calendar and Chat thumbnails no longer contain nested retry buttons. Their outer date/navigation button stays the sole action; full-card photo retry remains available. |
| Touch and layout | Lore filters wrap instead of hiding offscreen. Chat reply/reaction controls, Rune mastery, Nexus branding, and landing/auth/recovery controls have appropriately sized touch targets. Landing links no longer nest interactive elements. |

## Verification and scope

- **930 unit tests pass**, along with app TypeScript, scoped ESLint and the production build.
- The generated [asset inventory](VISUAL_ASSETS.json) covers **25 owned files**, **3,465 local references** and a conservative main-entry module graph. It reports zero missing local references or asset/metadata errors. Current icon delivery aliases and the retained public placeholder are explicitly documented.
- Navigation tests check registered navigation and onboarding destinations against the application's declared routes. The browser harness inventories **141 route patterns**.
- The final browser smoke pass visits **27 screen states across 25 production routes** at **390×844 in dark mode**. Its **39 checks pass** with no runtime errors, failed visible assets, clipping findings or remaining small-target findings in those states. It includes Home, Compete, Club, Chat, The Drop, Feats, member tools, landing/auth/recovery, Rune's three chapter views, gameplay/rules/guide, Archive, Bestiary and error recovery, plus Nexus entry/loadout/research.
- Drawer stacking/focus, notifications, body scrolling, default long dialogs, current game imagery and route connectivity are exercised through production components. All fixture data is isolated; no live messages, posts, rewards or account actions are made.

This is a static asset/route audit plus a representative runtime audit. It does not claim every admin/detail route, all live-data states, uploaded media or every viewport/theme combination has been inspected. The harness also provides an extended matrix for further visual coverage.

## Repeatable checks

```sh
node scripts/audit-visual-assets.mjs --write
node scripts/audit-visual-assets.mjs --check
node scripts/check-app-visuals.mjs --smoke
node scripts/check-app-visuals.mjs
```

Regenerate the asset report after changing source references or owned assets. When feature behavior changes, update its onboarding registry and public catalog copy together; retain deliberate Archive routes and URL compatibility. Extend the browser cases when adding a new visual layer.
