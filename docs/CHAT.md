# Chat refinement

Chat uses one full-screen conversation surface across phones, tablets and desktop. The installed chat asset and existing club RLS remain the access boundary. No migration or live message edits are part of this pass.

Home and Chat are fixed mobile navigation destinations; usage only chooses the remaining two slots. The bar stays available inside Chat, with its measured height reserved below the composer. It hides while the software keyboard is open and returns when it closes. Desktop and immersive game shells retain their existing navigation.

Channel loading no longer depends on optional category labels or message previews. Rooms become usable before preview/read-marker enrichment finishes; required channel failures retain an explicit retry. Inline markdown avoids RegExp lookbehind so older iOS/WebKit can load the Chat module.

The directory keeps its stable channel order, readable previews, mention counts and unread badges. Opening the directory does not mark a room read. The conversation has a consistent reading lane, 15px message text, distinct theme-aware own/incoming bubbles, direct search access, and an optional member panel. Mobile actions use portaled sheets; desktop composer accessories and autocomplete use anchored portals that escape the scroll area. Primary controls remain 44px. Reduced motion is respected.

Text drafts keep the existing `dh_chat_draft_v1:<user>:<channel>` device storage. Pending attachment drafts stay with their room during the open chat session. Upload and send failures retain attachments and successful uploads are reused on retry. Composition and phone Return do not accidentally send a message; desktop Enter sends and Shift+Enter inserts a line break. Chat feedback appears above the conversation rather than covering Send.

Editing a caption preserves its private attachments without showing storage addresses. The timeline offers a keyboard entry point: Up/Down moves through messages and Enter opens the same message actions used on touch.

Message pages use `(created_at, id)` cursors and ID deduplication. Request generations and the shared active-channel reference discard stale asynchronous work. Older pages preserve the reading position, edits/reactions/server acknowledgements do not count as arrivals, and a conversation's position survives opening and closing search. Older search/quoted-message context has an explicit return to the actual latest server window. Reconnect refreshes preserve loaded history. Own messages from another device are included.

Reactions update immediately, serialize duplicate in-flight operations and roll back only the caller's contribution on a failed save. Other members' changes remain intact. Realtime echoes expire rather than masking later activity. Typing labels come from the verified member roster; unknown broadcasters are ignored. Private-session visibility continues to come from the server policies.

Validation:

- `npx tsc -p tsconfig.app.json --noEmit`, scoped ESLint, `npm run test:unit`, `npm run build`.
- `node scripts/check-chat.mjs` uses production components, hooks and the app shell with an isolated Supabase transport. It creates no live messages, notifications or uploads. Set `CHAT_QA_URL` when Vite uses a port other than 8080. `CHAT_QA_INTERACTIONS_ONLY=1` runs the conversation-state checks without repeating the viewport matrix.
- `node scripts/check-chat-loading.mjs` verifies category/preview failures, required-channel retry, pinned Chat despite other high-usage destinations, and composer clearance above the tab bar.
- The browser matrix covers nine screen sizes in both themes, touch targets, search, autocomplete, accessories, mobile/IME input, room drafts, failed attachment retries, older-history continuity, genuine arrival counts, saved reading position, old-result navigation, reconnect state and a simulated visual-viewport keyboard.
- `chatTimeline`, `chatMessages`, `chatComposer`, `chatActions` and `chatRealtime` unit suites cover the data and mutation boundaries, including API errors, same-time messages, stale requests, mixed asynchronous updates and private typing identity exclusion.
