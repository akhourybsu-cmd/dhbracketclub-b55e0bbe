const WHITE = { r: 1, g: 1, b: 1 };
const DARK_INK = { r: 0.025, g: 0.075, b: 0.05 };

function channelToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = Math.min(1, Math.max(0, saturation / 100));
  const l = Math.min(1, Math.max(0, lightness / 100));
  if (s === 0) return { r: l, g: l, b: l };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hueToRgb = (tInput: number) => {
    let t = tInput;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return {
    r: hueToRgb(h + 1 / 3),
    g: hueToRgb(h),
    b: hueToRgb(h - 1 / 3),
  };
}

/** Pick the higher-contrast button label for a stored `H S% L%` accent. */
export function getAccentTextColor(accent: string): string {
  const match = accent.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return 'hsl(var(--primary-foreground))';

  const background = hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
  const backgroundLuminance = relativeLuminance(background);
  const whiteRatio = contrastRatio(backgroundLuminance, relativeLuminance(WHITE));
  const darkRatio = contrastRatio(backgroundLuminance, relativeLuminance(DARK_INK));

  return whiteRatio >= darkRatio ? 'hsl(0 0% 100%)' : 'hsl(160 36% 7%)';
}
