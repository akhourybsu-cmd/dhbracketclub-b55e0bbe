# The Drop — social feed

The Drop uses the shared app shell and its bottom navigation. The main experience is a native body-scrolling feed, with one post composer entry, Latest/Yours filtering, and compact Search/Archive controls. It has no wheel interception, nested snap carousel, forced full-screen mode or navigation when a video is tapped. The shell scrolls on document.body, so successful posts reset that scroller rather than window.scrollY.

Posts have consistent author/caption/media/actions. Likes update immediately; comments open over the current feed and keep their draft while the sheet is closed. A single caption composer infers text, link or photo; optional tools add a link, photo or tags. It retains drafts after dismissal/failure, blocks duplicate activation and returns to the feed after publishing. Shared text/URL and compose deep links remain supported. Existing detail and archive URLs still work.

Share opens a compact selector for postable channels in the active club, plus Copy link/device Share. Chat remains asset-gated. Sharing to Chat uses the existing Drop marker/permalink and opens the resulting conversation. Clipboard and API failures show retry states rather than false success.

## Media

FindLinkPreview loads metadata near the viewport, with a bounded request and useful source fallback. Direct mp4/webm/m4v/ogv links use native inline controls and no video download until tapped. Allowlisted YouTube, TikTok, Instagram, X and Facebook links use official embeds. A shared playback owner permits one active player. Switching players, scrolling away, hiding the tab, opening a sheet or leaving the route stops playback and unloads active sources.

No provider HTML is injected. Iframe error/loading timeouts offer retry; direct source links remain available. Cross-origin login/region/embed restrictions cannot be reliably detected from iframe load events, so third-party availability remains under the provider's control. Posters and media frames reserve their dimensions.

## Data and integration

useDropFeed reads 30-item pages in descending created_at/id order with compound cursors, removing the old 60-day/500-item primary-feed cutoff. Query keys include club/account scope. Mutations update loaded feed/detail/search caches; a failed reaction rolls back only the caller's contribution. Posts and comments reuse an in-session client UUID after uncertain replies. This protects immediate retries; it is not an authoritative server idempotency protocol across remounts/devices.

Successful writes invalidate Home signals and DH Score/Feats. Existing server awards, row-level policies, upload bucket and schema stay unchanged. Signed photos have bounded loading, path-scoped cache entries and retry states. All browser QA uses isolated data; it posts no live messages, comments or rewards.

## Verification

- Application TypeScript, scoped ESLint, full unit suite and production build.
- DROP_QA_URL=http://127.0.0.1:8087 node scripts/check-drop-social.mjs — five phone/tablet/desktop sizes in both themes, native scrolling, 44px controls, composer geometry, search/archive, reactions, comments, sharing, failure recovery, posting in place, pagination and iframe lifecycle.
- DROP_QA_INTERACTIONS_ONLY=1 skips the visual matrix for targeted debugging.
- DROP_QA_URL=http://127.0.0.1:8087 node scripts/check-drop-native.mjs — actual native video decode/play, single-player ownership and offscreen unload. It generates a local test pattern with ffmpeg when the test clip is absent; DROP_QA_CLIP can select an existing local webm.
- dropData, dropCompose, dropShare, dropMedia and dropPlayback unit suites cover pagination, scoped caches, peer-preserving rollback, uncertain writes, drafts, platform allowlists and player cleanup.
