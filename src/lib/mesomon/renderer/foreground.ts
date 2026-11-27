import type { MapId } from '../types';
import { paintQuayFixture, quayFixtures, type QuayFixture } from './quaySquare';
import { exteriorRelief } from './exteriors';
import { workshopRelief } from './workshop';
import { chamberRelief } from './chamberInstrument';
import { tideRelief } from './tideworks';

export interface FieldRelief {
  mapId: MapId;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  footY: number;
  paint(ctx: CanvasRenderingContext2D): void;
}

interface WallFixture {
  id: 'pier-hoist' | 'lamp-bracket' | 'gauge-arm' | 'sheet-block' | 'rail-finial' | 'pool-sight';
  x: number;
  y: number;
  width: number;
  height: number;
  /** World y of the fixed support, used for the same foot sorting as actors. */
  footY: number;
}

export type ForegroundPiece = WallFixture | QuayFixture | FieldRelief;

const pieces: Record<MapId, readonly (WallFixture | QuayFixture)[]> = {
  // Rigged to the starboard chainplate; only the tackle reaches over the deck.
  ship: [{ id: 'sheet-block', x: 181, y: 144, width: 17, height: 28, footY: 171 }],
  // The upright stands in water immediately outside the arrival pier.
  harbor: [{ id: 'pier-hoist', x: 446, y: 438, width: 30, height: 34, footY: 472 }, ...quayFixtures],
  // The bracket's backplate attaches to the east wall above the harbor window.
  workshop: [{ id: 'lamp-bracket', x: 211, y: 119, width: 21, height: 23, footY: 142 }],
  // The projecting gauge hangs from the masonry west of the entry towpath.
  passage: [{ id: 'gauge-arm', x: 23, y: 281, width: 24, height: 25, footY: 306 }],
  'tide-stairs': [{ id: 'rail-finial', x: 185, y: 134, width: 8, height: 18, footY: 151 }],
  chamber: [{ id: 'pool-sight', x: 183, y: 140, width: 18, height: 25, footY: 164 }],
};

const raisedFixtures: readonly FieldRelief[] = [...exteriorRelief, ...workshopRelief, ...chamberRelief, ...tideRelief];

export function foregroundForMap(id: MapId): readonly ForegroundPiece[] {
  return [...pieces[id], ...raisedFixtures.filter(fixture => fixture.mapId === id)];
}

/** Draw once into a transparent texture sized to the piece, origin at top left. */
export function paintForeground(ctx: CanvasRenderingContext2D, piece: ForegroundPiece) {
  if ('paint' in piece) return piece.paint(ctx);
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
  if (piece.id === 'sheet-block') {
    // A double sheave hangs from the angled davit. The gap below the
    // tackle leaves a silhouette visible as it crosses the player's coat.
    stamp(1, 0, [
      '  KhhK', ' KbhwdKK', ' K KKhwdKK', ' b   KKhwdKK',
      ' K     KKhwdKK', ' b       KKhwwK', ' K         KbwK',
      'KbK        KhwK', 'KgdK       KhwK', 'KhlK       KhwK',
      'KgdK       KhwK', ' KbK       KhwK', '  K        KhwK',
      '  b        KhwK', '  K        KhwK', '  K        KhwK',
      '  Kb       KhwK', '   K       KhwK',
    ]);
    stamp(11, 18, [' KhwK', ' KhwK', ' KbgK', ' KgdK', ' KhwK', ' KhwK', 'KggggK', ' KbdK', ' KddK', '  KK']);
  } else if (piece.id === 'rail-finial') {
    // A cast-brass end cap above the lower flight's bronze rail.
    stamp(0, 0, [
      '   bK', '  KylK', ' KbylbK', '  KbgK', '  KbgK', ' KbbbgK',
      '  KbdK', '  KbdK', '  KhdK', '  KhdK', '  KhdK', '  KhdK',
      '  KhdK', ' KbbgdK', ' KgggdK', 'KgggggdK', ' KgggdK', '   ddK',
    ]);
  } else if (piece.id === 'pool-sight') {
    // An optical sight on the pool wall. The open brass ring lets the
    // player remain visible through the instrument when passing behind it.
    stamp(0, 1, [
      '            bK', '           KylK', '         KbbbbgK',
      '        KbK   KgK', '        KbK   KgK', 'KbbbbbbbbbbgbbggK',
      ' KgggggggggggddK', '         KbK KgK', '          KbbgK',
      '           KbK', '          KbbgK', '           KhdK',
      '           KhdK', '           KhdK', '           KhdK',
      '           KhdK', '           KhdK', '          KbbgdK',
      '          KgggdK', '         KbggggdK', '         KgggggdK',
      '          KgggdK', '           KddK', '            KK',
    ]);
  } else if (piece.id === 'pier-hoist') {
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
