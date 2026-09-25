# The Drop — full-screen social feed

## Goal
Make the Club feed feel like a polished Reels-style experience: one Drop fills the available screen, media is the focus, and likes, comments, sharing, author details, and captions stay easy to reach.

## What will change
- Collapse the large masthead into a compact feed header so each Drop uses nearly the full mobile screen above navigation.
- Turn each feed item into a stable full-height slide with edge-to-edge media, clear position/progress, and swipe/snap navigation.
- Move author, caption, tags, and date into a readable lower overlay for visual posts, with an accessible structured treatment for articles and text-only Drops.
- Add a familiar right-side action rail for one-tap like, comments, and sharing; keep reaction counts and existing reaction choices available.
- Open comments in an opaque, portaled bottom sheet without leaving the feed, including comment loading, posting, deletion permissions, and retry states.
- Improve YouTube, TikTok, Instagram, X, and Facebook embeds with provider-specific sizing, loading placeholders, clear failure fallbacks, and automatic unloading when a slide leaves view.
- Keep Calendar and Search as clean conventional screens, preserve the selected tab and feed position, and retain light/dark and reduced-motion support.

## Technical details
- Reuse the existing Drop queries, reactions, comments, sharing, safe-link parsing, and link-preview function; no data-model changes.
- Make only the active or nearby slide mount rich media to reduce bandwidth and prevent multiple players running together.
- Use semantic Drop tokens in the shared styles; overlays remain opaque where interaction requires it.
- Verify mobile and desktop, light and dark, snap behavior, comments, reaction updates, media fallbacks, and production build health.
