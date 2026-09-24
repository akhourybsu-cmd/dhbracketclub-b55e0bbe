# The Drop: Immersive Media Feed

## What will change
- Turn the main Club feed into a vertical, one-Drop-per-screen experience with snap scrolling, while keeping Calendar and Search as conventional views.
- Preserve reactions, comments, sharing, author/date details, tags, and the existing one-per-day rule on every full-screen Drop.
- Keep the current tab and filter in the address so returning from another screen restores the same place.

## Media treatment
- Embed YouTube videos and Shorts directly inside their Drop with a native-looking play experience, poster image, title, and an external YouTube fallback.
- Present articles as image-led editorial stories using the page’s header image, source, headline, summary, and a clear “Read the full story” action.
- Keep uploaded photos immersive and edge-to-edge; retain a clean fallback for links whose site blocks previews or embeds.
- Load only nearby media, pause videos when their Drop leaves view, and respect reduced-motion and data-conscious browser behavior.

## Navigation and responsiveness
- Use the available screen height above the app navigation on mobile and a centered, wider stage on desktop.
- Add clear progress/position cues and keyboard, wheel, swipe, and touch scrolling without trapping normal navigation.
- Keep menus and overlays opaque, portaled, safe-area aware, and usable in both light and dark modes.

## Technical details
- Reuse the authenticated link-preview service, its SSRF protections, YouTube detection, and article Open Graph metadata.
- Add a dedicated safe media renderer for allowlisted providers instead of accepting arbitrary embed HTML.
- Extend preview typing to include media type, and use existing timeout/loading/error patterns.
- Verify YouTube Short, standard YouTube link, article preview, image Drop, fallback link, comments, sharing, light/dark, mobile/desktop, reduced motion, type check, and production build.
