/** Pixel offsets on the native 160 × 144 stage. A beat can animate once. */
export function battlePose(
  side: 'ally' | 'enemy',
  cue: 'ready' | 'act' | 'hit',
  elapsedMs: number,
  reducedMotion: boolean,
) {
  const baseX = side === 'ally' ? 45 : 116;
  const baseY = side === 'ally' ? 98 : 67;
  const facing = side === 'ally' ? 1 : -1;
  if (reducedMotion || cue === 'ready') return { x: baseX, y: baseY, spark: false };

  // A small anticipation frame, a strong pose, then a quick settle.
  const t = Math.max(0, elapsedMs);
  if (cue === 'act') {
    const stride = t < 65 ? -2 : t < 140 ? 5 : t < 210 ? 3 : t < 260 ? 1 : 0;
    return { x: baseX + stride * facing, y: baseY - (stride > 2 ? 2 : 0), spark: false };
  }
  const recoil = t < 90 ? 4 : t < 155 ? 2 : 0;
  return { x: baseX - recoil * facing, y: baseY - (recoil ? 1 : 0), spark: t < 140 };
}
