// Native world pixels at landmarks reached on foot. These windows exclude the
// player and interaction marker, so an idle sprite cannot stand in for scenery.
const windows = {
  ship: { motion: [100, 214, 20, 9] },
  harbor: { motion: [480, 487, 13, 14] },
  workshop: { motion: [19, 107, 13, 14], states: { stove: [83, 119, 11, 10] } },
  'tide-stairs': { motion: [155, 160, 34, 8], states: { rack: [146, 139, 42, 30] } },
  passage: { motion: [163, 181, 28, 53], states: { crossing: [163, 181, 27, 48], float: [180, 246, 27, 25] } },
  chamber: { motion: [131, 85, 46, 22], states: { rift: [138, 70, 26, 22] } },
};

export async function sampleField(page, mapId, observeMotion, motionWindow) {
  return page.locator('.mm-screen canvas[data-scene="field"]').evaluate(async (canvas, {mapId, areas, observeMotion}) => {
    const { width, height } = canvas;
    if (width !== 160 || height !== 144) throw Error('Unexpected field resolution: ' + width + 'x' + height);
    const ctx = canvas.getContext('2d');
    const state = await window.mmQa.readSave();
    if (state.player.mapId !== mapId) throw Error('Saved position is in ' + state.player.mapId);
    const map = window.mmQa.getMap(state);
    const originX = Math.max(0, Math.min(map.width * 16 - width, state.player.x * 16 + 8 - width / 2));
    const originY = Math.max(0, Math.min(map.height * 16 - height, state.player.y * 16 + 8 - height / 2));
    function getCrop([x,y,w,h]) {
      const left = Math.max(0, x - originX), top = Math.max(0, y - originY);
      const right = Math.min(width, x - originX + w), bottom = Math.min(height, y - originY + h);
      if (right <= left || bottom <= top) throw Error('Scenery window is outside ' + mapId + ' viewport');
      return {left, top, width: right-left, height: bottom-top, worldX: left+originX, worldY: top+originY};
    }
    function sample(crop) {
      return new Uint32Array(ctx.getImageData(crop.left, crop.top, crop.width, crop.height).data.buffer);
    }
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const colors = new Set();
    let opaque = 0, missingGreen = 0;
    for (let i=0; i<pixels.length; i+=4) {
      const color = (pixels[i] << 16) | (pixels[i+1] << 8) | pixels[i+2];
      colors.add(color);
      if (pixels[i+3] === 255) opaque++;
      if (color === 0x00ff00 && pixels[i+3]) missingGreen++;
    }
    const zone = getCrop(areas.motion);
    const basePixels = sample(zone);
    const full = new Uint32Array(pixels.buffer);
    let changedPixels = 0, changedFieldPixels = 0;
    if (observeMotion) {
      // Sample through several authored 420ms phases at a non-multiple of the
      // cadence. Stop once a moving scene has actually changed; a still area
      // is observed for the full window.
      for (let i=0; i<10; i++) {
        await new Promise(resolve => setTimeout(resolve, 185));
        const next = sample(zone);
        let changed = 0;
        for (let j=0; j<next.length; j++) if (basePixels[j] !== next[j]) changed++;
        changedPixels = Math.max(changedPixels, changed);
        if (state.settings.reducedMotion) {
          const current = new Uint32Array(ctx.getImageData(0, 0, width, height).data.buffer);
          let different = 0;
          for (let j=0; j<current.length; j++) if (full[j] !== current[j]) different++;
          changedFieldPixels = Math.max(changedFieldPixels, different);
        } else if (changedPixels) break;
      }
    }
    const landmarks = Object.entries(areas.states || {}).map(([name, rect]) => {
      const crop = getCrop(rect);
      return { name, crop, pixels: Array.from(sample(crop)) };
    });
    return {
      position: { x: state.player.x, y: state.player.y }, zone, reduced: state.settings.reducedMotion,
      palette: colors.size, opaque, missingGreen, changedPixels, changedFieldPixels, landmarks,
      image: canvas.toDataURL('image/png'),
    };
  }, {mapId, areas: {...windows[mapId], motion: motionWindow ?? windows[mapId].motion}, observeMotion});
}

export async function fieldContactSheet(page, zones) {
  return page.evaluate(async zones => {
    const scale = 2, w = 160 * scale, h = 144 * scale, gutter = 12, caption = 32;
    const sheet = document.createElement('canvas');
    sheet.width = 3*(w+gutter)+gutter;
    sheet.height = 2*(h+caption+gutter)+gutter;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#192a28'; ctx.fillRect(0,0,sheet.width,sheet.height);
    ctx.imageSmoothingEnabled = false;
    ctx.font = 'bold 16px sans-serif'; ctx.textBaseline = 'top';
    for (const [index, zone] of zones.entries()) {
      const image = new Image();
      image.src = zone.image;
      await image.decode();
      const x = gutter + (index%3)*(w+gutter), y = gutter + Math.floor(index/3)*(h+caption+gutter);
      ctx.drawImage(image,x,y,w,h);
      ctx.fillStyle = '#f0e5c7'; ctx.fillText(zone.title,x,y+h+7);
    }
    return sheet.toDataURL('image/png');
  }, zones);
}
