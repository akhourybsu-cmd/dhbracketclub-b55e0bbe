export function interiorBrushes(ctx: CanvasRenderingContext2D) {
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  // Integer raster lines keep ropes, tools and curved stonework on the same pixel grid as actors.
  const line = (color: string, x: number, y: number, tx: number, ty: number) => {
    const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy;
    while (true) {
      rect(color, x, y, 1, 1);
      if (x === tx && y === ty) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  };
  return { rect, line };
}
