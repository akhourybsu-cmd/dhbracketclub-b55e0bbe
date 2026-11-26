import type Phaser from 'phaser';
import type { BattleBeat, BattleState } from '../types';
import { BATTLE_LANDING, type FighterSide } from './battleMotion';

type Graphics = Phaser.GameObjects.Graphics;
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

function glint(g: Graphics, x: number, y: number, size: number) {
  g.lineBetween(x - size, y, x + size, y).lineBetween(x, y - size, x, y + size);
}

/** Keep a successful defensive stance visible while a committed strike lands.
 * Mud Wrap hardens only for the first hit, even in a two-hit pulse. */
export function impactDefense(battle: BattleState, hit: FighterSide | null): BattleBeat | null {
  const playback = battle.playback;
  if (!playback || hit !== 'ally') return null;
  const current = playback.beats[playback.index];
  if (current.side !== 'enemy' || current.kind !== 'impact') return null;
  let firstHit = true;
  for (let i = playback.index - 1; i >= 0; i--) {
    const beat = playback.beats[i];
    if (beat.side === 'enemy' && beat.kind === 'impact') firstHit = false;
    if (beat.side !== 'ally' || beat.kind !== 'notice' || beat.activeIndex !== current.activeIndex) continue;
    if (beat.cue === 'guard' || beat.cue === 'tidal-veil' || (beat.cue === 'mud-wrap' && firstHit)) return beat;
  }
  return null;
}

/** Only committed beats carry an effect. These graphics sit behind the portraits. */
export function paintBattleEffect(g: Graphics, beat: BattleBeat, elapsedMs: number, reduced: boolean, secondPulse: boolean) {
  const cue = beat.cue;
  if (!cue) return;
  const source: FighterSide = beat.side === 'enemy' ? 'enemy' : 'ally';
  const other = source === 'ally' ? 'enemy' : 'ally';
  // Forced switches, mud on the crew, and retreat are field notices at the near landing.
  // A broken double pulse is a field notice at the Wretch's own feet.
  const location = beat.side === 'field' ? cue === 'rift-lash' ? 'enemy' : 'ally'
    : beat.kind === 'impact' && cue !== 'tincture' ? other : source;
  const dir = source === 'ally' ? 1 : -1;
  const sourceFoot = BATTLE_LANDING[source], targetFoot = BATTLE_LANDING[other];
  const feet = BATTLE_LANDING[location];
  const front = location === 'ally' ? 1 : -1;
  const sx = sourceFoot.x + 17 * dir, sy = sourceFoot.y - 22;
  const tx = targetFoot.x - 17 * dir, ty = targetFoot.y - 21;
  const settles = beat.kind === 'notice' && (cue === 'resonant-cry' || cue === 'lantern-dust');
  const impact = beat.kind === 'impact' || settles || (beat.side === 'field' && cue === 'rift-lash');
  const t = reduced ? 0.73 : Math.min(1, Math.max(0, elapsedMs / 270));
  const ease = 1 - (1 - t) ** 2;
  const x = impact ? feet.x + front * 17 : lerp(sx, tx, ease);
  const y = impact ? feet.y - 21 : lerp(sy, ty, ease);
  // The settled mark stays legible if Next is set to manual. No repeating flashes.
  const alpha = reduced ? 0.88 : 0.96 - 0.32 * t;
  const face = feet.x + front * 18;

  switch (cue) {
    case 'brine-snap': {
      if (!impact) {
        const tail = Math.max(0, ease - 0.48);
        const bx = lerp(sx, tx, tail), by = lerp(sy, ty, tail);
        g.lineStyle(4, 0x348798, alpha).lineBetween(bx, by, x, y);
        g.lineStyle(1.3, 0xc8f4e5, alpha).lineBetween(bx, by - 1, x, y - 1);
        g.fillStyle(0x83d5d4, alpha).fillCircle(x, y, 2.4);
      } else {
        g.lineStyle(1.4, 0xa8eee2, alpha);
        for (let i = -1; i <= 1; i++) {
          const length = 5 + ease * 5;
          g.lineBetween(x, y, x + front * length, y + i * (4 + ease * 5));
          g.fillStyle(0x80d0d7, alpha).fillCircle(x + front * (length + 2), y + i * (6 + ease * 5), 1.2);
        }
      }
      break;
    }
    case 'splinter-swipe':
    case 'quick-tackle': {
      const swipe = cue === 'splinter-swipe';
      g.lineStyle(swipe ? 1.5 : 1.1, swipe ? 0xf7d29b : 0xd2eddc, alpha);
      for (let i = -1; i <= 1; i++) {
        if (swipe) {
          const dx = dir * (6 + ease * 3);
          g.lineBetween(x - dx, y + i * 3 + 4, x, y + i * 3 - 1)
            .lineBetween(x, y + i * 3 - 1, x + dx * 0.35, y + i * 3 - 4);
        } else {
          const length = 9 - Math.abs(i) * 3;
          g.lineBetween(x - dir * length, y + i * 3 + 2, x + dir * 2, y + i * 3 - 1);
        }
      }
      break;
    }
    case 'bank-break': {
      const groundY = impact ? feet.y - 2 : lerp(sourceFoot.y, targetFoot.y, ease) - 3;
      for (let i = 0; i < 3; i++) {
        const rx = x - dir * i * 5;
        const height = 4 + (2 - i) * 2 + ease * 3;
        g.fillStyle(0xa98d68, alpha).fillTriangle(rx - 3, groundY, rx - 1, groundY - height, rx + 4, groundY);
        g.lineStyle(1, 0xf2d9a6, alpha).lineBetween(rx - 3, groundY - 1, rx - 1, groundY - height);
      }
      break;
    }
    case 'rift-lash': {
      const sign = secondPulse || beat.side === 'field' ? -1 : 1;
      const ax = impact ? x + front * 12 : sx, ay = impact ? y - sign * 8 : sy;
      const bx = lerp(ax, x, 0.53), by = lerp(ay, y, 0.53);
      const bolt = (width: number, color: number) => {
        g.lineStyle(width, color, alpha).lineBetween(ax, ay, bx + dir * 2, by + 4 * sign)
          .lineBetween(bx + dir * 2, by + 4 * sign, bx - dir * 2, by - 3 * sign)
          .lineBetween(bx - dir * 2, by - 3 * sign, x, y);
      };
      bolt(3.4, 0x88629c);
      bolt(1.1, 0xf1ccf4);
      g.lineBetween(bx, by, bx - dir * 4, by - 5 * sign);
      break;
    }
    case 'resonant-cry':
      if (settles) {
        g.lineStyle(1, 0x9cd6bb, alpha).strokeEllipse(feet.x, feet.y - 2, 21 + ease * 6, 5);
        break;
      }
      g.lineStyle(1.3, 0x9cd6bb, alpha);
      for (let i = 0; i < 3; i++) {
        const step = impact ? i * 3 : i * 4;
        g.strokeEllipse(x - dir * step, y, 3 + i * 2, 7 + i * 3 + 3 * ease);
      }
      break;
    case 'lantern-dust':
      for (let i = 0; i < 5; i++) {
        const offset = i % 2 === 0 ? -1 : 1;
        const fraction = Math.max(0, ease - i * 0.09);
        const px = impact ? x + front * (3 + i * 2) : lerp(sx, tx, fraction);
        const py = (impact ? y : lerp(sy, ty, fraction)) + offset * (2 + i) - 5 * Math.sin(Math.PI * fraction);
        g.lineStyle(1, i % 2 ? 0xf0db96 : 0xfff1c0, alpha);
        glint(g, px, py, i % 2 ? 1 : 2);
      }
      break;
    case 'guard':
      g.lineStyle(2, 0xefcf8e, alpha)
        .lineBetween(face, feet.y - 31, face + front * 4, feet.y - 26)
        .lineBetween(face + front * 4, feet.y - 26, face + front * 4, feet.y - 18)
        .lineBetween(face + front * 4, feet.y - 18, face, feet.y - 14);
      g.lineStyle(1, 0xffedc5, alpha).lineBetween(face + front, feet.y - 24, face + front, feet.y - 19);
      break;
    case 'tidal-veil':
      g.lineStyle(1.5, 0x9ce8df, alpha).strokeEllipse(face, feet.y - 20, 8, 26 + ease * 2);
      g.lineStyle(0.8, 0x65acbb, alpha).strokeEllipse(face, feet.y - 20, 12, 31);
      break;
    case 'mud-wrap':
    case 'mudbound': {
      const groundY = feet.y - 2;
      const color = cue === 'mud-wrap' ? 0xd6b994 : 0xae916e;
      for (let i = 0; i < 4; i++) {
        const dx = feet.x - 17 + i * 10;
        g.fillStyle(0x776551, alpha).fillEllipse(dx, groundY - i % 2, 10, 4 + ease * 2);
        g.lineStyle(1, color, alpha).lineBetween(dx - 3, groundY - 2, dx, groundY - 3);
      }
      break;
    }
    case 'reedstep':
    case 'dodge':
      g.lineStyle(1.2, 0xaad7a8, alpha);
      for (let i = 0; i < 3; i++) {
        const rx = feet.x - front * (16 + i * 2);
        g.lineBetween(rx, feet.y - 3, rx - front * (4 + i * 1.5), feet.y - 10 - i * 2);
      }
      break;
    case 'tincture':
      if (beat.kind === 'action') {
        const bx = feet.x + front * 18, by = feet.y - 28 - ease * 2;
        g.fillStyle(0xc5ad85, alpha).fillRect(bx - 1, by - 6, 2, 3);
        g.fillStyle(0xadd8bd, alpha).fillEllipse(bx, by, 7, 8);
        g.lineStyle(0.9, 0xf4e7c7, alpha).lineBetween(bx - 1.5, by - 1.5, bx - 1.5, by + 1);
        break;
      }
      for (let i = 0; i < 3; i++) {
        g.lineStyle(1.4, 0xbbebc3, alpha);
        glint(g, feet.x + (i - 1) * 14, feet.y - 35 - ease * 6 - i % 2 * 3, i === 1 ? 2.5 : 1.5);
      }
      break;
    case 'switch':
    case 'flee':
      g.lineStyle(1.3, cue === 'switch' ? 0xf4d5a1 : 0xbcc4b6, alpha)
        .strokeEllipse(feet.x, feet.y - 2, 17 + 19 * ease, 3 + 4 * ease);
      break;
    case 'resonate': {
      const bx = face + front * (4 + 3 * ease), by = feet.y - 25;
      g.fillStyle(0x9bc7ac, alpha).fillTriangle(bx - 3, by, bx, by - 5, bx + 3, by);
      g.fillStyle(0xf3e1ab, alpha).fillTriangle(bx - 3, by, bx + 3, by, bx, by + 5);
      break;
    }
  }
}
