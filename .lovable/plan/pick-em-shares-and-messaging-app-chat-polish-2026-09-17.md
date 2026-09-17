# Pick’em shares and messaging-app chat polish

## Goal
Make a locked NFL Pick’em week shareable directly into a DH chat as a polished, trustworthy weekly card, then make Chat’s menus, accessory bars, keyboard behavior, and scrolling feel like a native messaging app.

## What will change

### 1. Share a weekly Pick’em card to DH Chat
- Replace the current text-only share action with a share sheet that includes **Share to DH Chat** while retaining the device share/copy fallback.
- Let the member choose an eligible channel in their active club; hide channels they cannot post in.
- Send one normal chat message containing a canonical Pick’em week link and a recognizable share marker.
- Render that message as a compact NFL card in Chat: member name, week, completion summary, selected team logos/abbreviations, tiebreaker when present, and a clear **View picks** action.
- Load the shared picks from the real Pick’em records using the message author and week, so the card cannot be forged by editing message text and can reflect final results later.
- Keep existing reveal rules: sharing remains available only when the week is locked, and database permissions continue to decide which picks recipients may see.
- Send the usual chat notification after posting and deep-link the new message so the sender can jump straight to it.

### 2. Convert mobile chat menus to bottom sheets
- Add one reusable, portaled Chat bottom sheet with safe-area spacing, backdrop dismissal, Escape handling, reduced-motion support, and a short spring snap.
- Use it for the mobile channel action menu, composer attachment/tools menu, message actions, expanded reaction picker, and larger member/pinned/search controls where appropriate.
- Keep compact anchored menus on desktop, where pointer interaction benefits from them.
- Enforce one open transient surface at a time so attachment, emoji, formatting, reactions, and message actions never stack or fight for focus.

### 3. Make chat movement behave like a messaging app
- Preserve the visible message when opening or closing sheets, loading older messages, switching channels, and loading images.
- Keep the composer attached to the visible keyboard edge without repeated jumps during keyboard animation.
- Auto-scroll only when the member is already near the latest message; otherwise retain position and show the new-message control.
- Make reply, edit, delete, reactions, attachments, GIFs, mentions, formatting, pinned messages, search, member list, and channel settings open and close consistently.
- Close stale menus on channel changes and restore composer focus only when that is helpful, without forcing the phone keyboard open.

## Technical details
- Follow the existing specialized rich-message pattern used by draft invites: add a Pick’em share parser and a dedicated compact chat card, then route matching links through the chat message renderer.
- Pass the message author into the specialized card and query existing Pick’em week/game/pick data; no duplicate pick snapshot or client-authored score data.
- Centralize chat transient-surface state instead of independent booleans where practical.
- Use existing semantic NFL/chat tokens, team logo components, shadcn controls, and the app’s portal convention.
- Add focused tests for share parsing, channel eligibility, card data mapping, scroll anchoring, and mutually exclusive sheets.

## Verification
- Type-check and run focused tests.
- Test the full locked-week flow: open share, choose a channel, post, open the resulting message, and follow **View picks**.
- Verify Chat on phone and desktop for attachments, emoji, formatting, reactions, reply/edit/delete, search, pins, members, channel switching, incoming messages, image loading, and keyboard open/close.
- Check light and dark themes and reduced-motion behavior.
