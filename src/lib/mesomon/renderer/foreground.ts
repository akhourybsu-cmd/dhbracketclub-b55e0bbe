import type { MapId } from '../types';
import { paintQuayFixture, quayFixtures, type QuayFixture } from './quaySquare';

interface WallFixture {
  id: 'pier-hoist' | 'lamp-bracket' | 'gauge-arm';
  x: number;
  y: number;
  width: number;
  height: number;
  /** World y of the fixed support, used for the same foot sorting as actors. */
  footY: number;
}

export type ForegroundPiece = WallFixture | QuayFixture;

const pieces: Partial<Record<MapId, readonly ForegroundPiece[]>> = {
  // The upright stands in water immediately outside the arrival pier.
  harbor: [{ id: 'pier-hoist', x: 446, y: 438, width: 30, height: 34, footY: 472 }, ...quayFixtures],
  // The bracket's backplate attaches to the east wall above the harbor window.
  workshop: [{ id: 'lamp-bracket', x: 211, y: 119, width: 21, height: 23, footY: 142 }],
  // The projecting gauge hangs from the masonry west of the entry towpath.
  passage: [{ id: 'gauge-arm', x: 23, y: 281, width: 24, height: 25, footY: 306 }],
};

export function foregroundForMap(id: MapId): readonly ForegroundPiece[] {
  return pieces[id] ?? [];
}

/** Draw once into a transparent texture sized to the piece, origin at top left. */
export function paintForeground(ctx: CanvasRenderingContext2D, piece: ForegroundPiece) {
  if (piece.id === 'quay-bell' || piece.id === 'rope-stock') return paintQuayFixture(ctx, piece);
  const palette: Record<string, string> = {
    K: '#293739', d: '#534b40', w: '#83694c', h: '#bf996a',
    g: '#78847a', b: '#bba577', l: '#e8c98a', y: '#f7e4a5',
  };
  // The gaps inside each cutout reveal the actor and moving water behind it.
  const stamp = (x: number, y: number, rows: string[]) => {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = palette[row[dx]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    });
  };
  if (piece.id === 'pier-hoist') {
    // A bronze block, hanging link chain and hook on a timber cantilever.
    stamp(19, 1, [
      '  KddddK', ' KhhhhhwK', ' KwwwwwdK', '  KhwwdK',
      ...Array<string>(19).fill('  KhwwdK'),
      ' KgKgggdK', ' KbdKggdK', ' KKKKKKKK', '  KhwwdK',
      '  KhwwdK', '  KwwwdK', ' KgKKKKgK', ' KggggggK', '  KKKKKK',
    ]);
    stamp(0, 3, [
      '   KhhhhhhhhhhhhhhhhhhhhK',
      '  KhwwwwwwwwwwwwwwwwwwwdK',
      '  KwwdddddddddddddddddddK',
      '   KKKKKKKKKKKKKKKKKKKKK',
      '  KbbK          KhwdK',
      ' KbgKbK          KhwdK',
      ' KggKbK           KhwdK',
      '  KbbK             KhwdK',
      '   KK               KhwdK',
    ]);
    stamp(1, 12, [
      '  Kg', ' K gK', '  gK', '  Kg', ' K gK', '  gK',
      '  Kg', ' K gK', '  gK', '  KK', '  KgK', '   KgK',
      ' K  gK', ' KgKgK', '  KKK',
    ]);
  } else if (piece.id === 'lamp-bracket') {
    stamp(0, 0, [
      '              KggK', '             KgbgK', '  KggggggggggggggK',
      ' KgbKKKKKKKKK  KgK', '  KK       KgK KdK', '  K         KgKKgK',
      '  b          KgKgK', '  K           KggK', ' KdK           KgK',
      'KbbbK          KgK', ' KbK           KbK', 'KgggK          KKK',
      'KbybK', 'KbylK', 'KbylK', 'KbybK', 'KgggK', ' KdK', '  K',
    ]);
  } else {
    stamp(0, 0, [
      '  KggK', ' KggggK', ' KbKKgK', '  KgKgK', '  KgKgK',
      '  KgKggggggggggggggggK', '  KgKbbbbbbbbbbbbbbbgK',
      '  KgKKKKKKKKKKKKKKgKK', '  KggK     KgK     K',
      '  KgKgK   KgK      b', '  KgKKgK KgK       K',
      '  KgK KgKgK       KbK', '  KgK  KgK        KbK',
      '  KbK             KlK', '  KgK             KbK', '  KKK             KlK',
      '                  KbK', '                  KlK', '                  KgK',
      '                  KgK', '                   K',
    ]);
  }
}
