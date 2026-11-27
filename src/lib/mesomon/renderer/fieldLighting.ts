import type { MapDefinition } from '../types';

/** A single translucent, world-sized plate. Overlay blending retains the
 * pigment and ink of each surface, including a coat as it crosses a doorway.
 * The plate is rebuilt with the room, never while the camera moves. */
export function paintFieldLighting(
  ctx: CanvasRenderingContext2D, map: MapDefinition, hearthLit: boolean, riftSealed: boolean,
) {
  const width = map.width * 16, height = map.height * 16;
  // An elliptical falloff follows the plane of the ground, so light from a
  // window spreads across the floor, while an alcove lamp stays close to it.
  function pool(x: number, y: number, rx: number, ry: number, rgb: string, intensity: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    light.addColorStop(0, `rgba(${rgb},${intensity})`);
    light.addColorStop(0.48, `rgba(${rgb},${intensity * 0.62})`);
    light.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = light;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  function ambient(color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }
  switch (map.id) {
    case 'ship':
      // Low morning sun grazes the port rail. The deckhouses throw their
      // shared cool lee across the starboard scuppers.
      pool(74, 108, 122, 100, '255,193,122', .48);
      pool(206, 121, 52, 105, '38,87,115', .57);
      pool(130, 213, 112, 44, '31,93,112', .46);
      break;
    case 'harbor':
      pool(320, 225, 310, 160, '255,205,141', .45);
      pool(150, 213, 83, 39, '55,96,122', .56);
      pool(426, 460, 79, 95, '248,189,110', .52);
      pool(357, 511, 62, 84, '35,112,127', .58);
      pool(551, 300, 92, 96, '66,114,135', .32);
      break;
    case 'workshop':
      ambient('rgba(54,52,77,.41)');
      pool(133, 65, 112, 96, '255,197,121', .88);
      pool(229, 160, 50, 85, '104,175,176', .53);
      pool(82, 120, hearthLit ? 53 : 26, hearthLit ? 45 : 20, '255,149,64', hearthLit ? .84 : .25);
      break;
    case 'tide-stairs':
      ambient('rgba(58,92,102,.24)');
      pool(130, 98, 117, 116, '253,216,157', .69);
      pool(245, 179, 77, 94, '45,129,144', .52);
      break;
    case 'passage':
      ambient('rgba(34,66,88,.67)');
      pool(150, 170, 91, 84, '153,207,199', .72);
      pool(312, 145, 63, 55, '255,171,77', .95);
      pool(274, 36, 88, 75, '126,193,196', .58);
      break;
    case 'chamber':
      ambient(riftSealed ? 'rgba(40,76,88,.48)' : 'rgba(50,44,82,.57)');
      pool(152, 88, 92, 68, riftSealed ? '116,218,184' : '204,146,223', .84);
      pool(101, 116, 35, 35, '255,185,95', .68);
      pool(184, 132, 37, 35, '255,185,95', .65);
      break;
  }
}
