# Cinematic live-pick reveal

## Experience
- When a new kiosk pick arrives, keep its board slot temporarily concealed.
- Run a staged full-screen sequence: **Pick locked** suspense, **The pick is in**, then a slow selection reveal.
- Finish by visually carrying the revealed selection into its exact board slot, which flashes as it settles.
- Resume the ticker and normal clock view only after the landing completes.

## Motion and accessibility
- Use projector-scale light sweeps, restrained gold energy, typography, and sound cues that fit Draft Arena’s existing style.
- Keep the sequence legible on projector and smaller screens.
- Replace the long sequence with a brief crossfade when reduced motion is enabled.

## Technical details
- Model the reveal as timed phases driven by each newly received pick.
- Render the new cell as pending until the final phase so the board cannot spoil the reveal.
- Use stable element measurements to animate from the reveal panel to the destination board cell.
- Queue picks received during an active reveal so rapid selections are not lost.
- Verify type safety, production build, and kiosk behavior in the browser.
