# Draft Arena Player Themes and Command Center Polish

## Goal
Keep the existing Heritage Ledger design as the default while making every live draft room feel polished for each player on desktop and mobile. Add optional player-selected color palettes across the entire Draft Arena, with complete light and dark variants.

## Experience
- Preserve Space Grotesk titles, DM Sans body text, current Draft Arena structure, and all draft behavior.
- Offer four palettes: Heritage Bronze, Broadcast Blue, Club Emerald, and Signal Red.
- Add a compact appearance selector in the Draft Arena header with named color swatches, selected state, keyboard access, and a reset/default option.
- Remember each player's choice on their device and apply it immediately throughout Draft Arena, including live rooms and the projector kiosk.
- Keep light/dark mode independent from palette choice so every palette works in either mode.

## Command center polish
- Desktop: retain the command masthead, sticky clock/control rail, dominant board, and separate selection log; improve visual hierarchy, spacing, active-state emphasis, and section boundaries.
- Mobile: surface the live status and clock first, keep the board easy to swipe, make the selection action prominent, and present the activity log as a clean final section without squeezing desktop panels into the phone width.
- Give hosts and participants equally polished views; host-only controls remain permission-gated.
- Use restrained status pulses and panel entrance motion with reduced-motion fallbacks.

## Technical details
- Define all four palette families as scoped semantic CSS variables under Draft Arena rather than hardcoded component colors.
- Add a small reusable Draft Arena appearance hook and selector; synchronize selection across open Arena views on the same device.
- Apply the palette attribute at the Draft Arena shell and kiosk roots so every existing semantic control, board cell, sheet, dialog, and status treatment inherits correctly.
- Keep the existing global light/dark theme switch and current live-draft logic unchanged.

## Verification
- Run the production build and focused checks.
- Browser-check the Draft hub and live room at desktop and phone sizes.
- Verify all four palettes in light and dark mode, persistence after reload, keyboard labels, overflow, and reduced-motion behavior.
