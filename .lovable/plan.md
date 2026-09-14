# NFL Game Center and Draft Arena theme readiness

## What will change

- Add a visible theme switch to both standalone center headers so light and dark mode remain available inside each experience.
- Convert the NFL Stadium Night styling into paired semantic palettes: a crisp daylight score-sheet theme and the existing night broadcast theme.
- Remove the final Draft Arena rule that currently forces the Heritage Ledger dark palette in light mode, replacing it with a complete parchment and charcoal light variant.
- Cover shared cards, navigation, fields, status chips, dialogs, sheets, scoreboards, loading states, and action states in both themes without changing gameplay or data behavior.

## Technical details

- Keep all theme values scoped to `.pk-mode` and `.da-mode` through CSS variables, with `.light` overrides and the existing dark defaults.
- Replace remaining shell-specific `text-white` assumptions in the Draft header with semantic classes.
- Preserve the Stadium Night and Heritage Ledger identities, typography, responsive layouts, and accessibility targets.

## Verification

- Run the TypeScript check and focused existing NFL/Draft tests.
- Inspect the NFL hub, Crazy Chain, Draft hub, and a Draft room at 411×738 and 1280×1800 in both light and dark modes.
- Check contrast, overflow, dialogs, focus states, and theme switching without a reload.