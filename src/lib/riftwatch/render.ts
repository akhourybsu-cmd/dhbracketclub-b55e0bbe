import type { RunEvent, RunState } from '../../../supabase/functions/_shared/arcade/model';
import { INPUT, PULSE_RADIUS } from '../../../supabase/functions/_shared/arcade/rules';
import { print, sprite } from './pixels';

export interface RiftwatchDisplay { highScore: number; reducedMotion: boolean; highContrast: boolean }

const ink = '#0b1320';
const energy = '#c9f4d8';
const teal = '#45c4b0';
const gold = '#e1b44c';
const coral = '#e35d6a';
const voids = new Map<boolean, HTMLCanvasElement>();
type Spark = Pick<RunEvent, 'kind' | 'x' | 'y' | 'value'> & { tick: number };
interface Playback { capturedTick: number; sparks: Spark[] }
const playback = new WeakMap<RunState, Playback>();

/** Works at the simulation tick rate so short score bursts survive a dropped render frame. */
export function captureRiftwatchEvents(state: RunState) {
  let view = playback.get(state);
  if (!view) {
    view = { capturedTick: -1, sparks: [] };
    playback.set(state, view);
  }
  if (view.capturedTick === state.tick) return;
  view.capturedTick = state.tick;
  while (view.sparks.length && state.tick - view.sparks[0].tick > 28) view.sparks.shift();
  for (const event of state.events) {
    if (event.kind === 'kill' || event.kind === 'ward' || event.kind === 'node' || event.kind === 'hit' || event.kind === 'pulse') {
      if (view.sparks.length === 16) view.sparks.shift();
      view.sparks.push({ ...event, tick: state.tick });
    }
  }
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function ridge(ctx: CanvasRenderingContext2D, points: readonly [number, number][], color: string) {
  for (let i = 1; i < points.length; i++) {
    const [left, start] = points[i - 1], [right, end] = points[i];
    for (let x = left; x < right; x++) {
      const y = Math.round(start + (end - start) * (x - left) / (right - left));
      pixel(ctx, x, y, color, 1, 144 - y);
    }
  }
}

function sky(contrast: boolean) {
  let plate = voids.get(contrast);
  if (plate) return plate;
  plate = document.createElement('canvas');
  plate.width = 160; plate.height = 144;
  const ctx = plate.getContext('2d');
  if (!ctx) return plate;
  pixel(ctx, 0, 0, ink, 160, 144);
  if (!contrast) {
    ridge(ctx, [[0,61],[24,55],[45,54],[66,46],[81,45],[108,34],[141,29],[160,19]], '#122234');
    ridge(ctx, [[0,88],[29,78],[56,80],[83,71],[107,73],[141,59],[160,57]], '#1b2e43');
    ridge(ctx, [[0,100],[16,94],[49,92],[66,94],[82,90],[104,86],[132,81],[148,82],[160,78]], '#31374b');
    ridge(ctx, [[0,108],[16,100],[33,96],[45,100],[68,102],[90,96],[106,95],[138,89],[150,90],[160,87]], '#493f53');
    ridge(ctx, [[0,109],[7,107],[21,106],[29,103],[47,108],[56,102],[67,99],[75,104],[84,98],[94,101],[108,96],[123,98],[134,93],[140,98],[150,94],[160,97]], '#25384b');
    ridge(ctx, [[0,107],[9,111],[26,112],[31,109],[47,115],[59,112],[76,117],[101,114],[118,115],[132,109],[144,112],[160,104]], '#152d3a');
    // High, oblique rift and its opposing dark face; values sit beneath every attack.
    for (let x = 0; x < 29; x++) {
      const y = 42 - Math.floor(x * .62) - (x > 11 && x < 19 ? 3 : 0);
      pixel(ctx, 108 + x, y, '#35354f', 1, 2 + (x % 7 === 0 ? 2 : 0));
      if (x > 5 && x < 24) pixel(ctx, 109 + x, y + 2, '#514461');
    }
    for (const [x,y] of [[103,45],[132,25],[123,25],[145,18],[133,32],[116,40]]) pixel(ctx,x,y,'#403a53',2);
    for (let i = 0; i < 48; i++) {
      const x = (i * 39 + i * i * 7 + 5) % 160;
      const y = (i * 29 + i * i * 13) % 78 + 16;
      pixel(ctx, x, y, i % 5 === 0 ? '#576477' : '#324657');
    }
    for (const [x,y] of [[4,100],[11,103],[148,99],[156,94]]) {
      pixel(ctx,x,y,'#132736',2,14); pixel(ctx,x-1,y+6,'#132736',4,8); pixel(ctx,x,y,'#8d7469');
    }
  }
  // Floor and strip light mark the exact defense line.
  pixel(ctx,0,139,contrast ? '#142638' : '#192d36',160,5);
  for (let x=1;x<160;x+=8) pixel(ctx,x,126,contrast ? '#788788' : '#4b6969',2);
  for (let x=2;x<160;x+=14) pixel(ctx,x,140,'#385150',6);
  voids.set(contrast, plate);
  return plate;
}

function drawHud(ctx: CanvasRenderingContext2D, s: RunState, best: number, contrast: boolean) {
  const caption = contrast ? '#c2d7cc' : '#94adab';
  pixel(ctx,0,0,'#0b1924',160,15);
  pixel(ctx,0,14,'#395157',160);
  print(ctx,'SCORE',2,1,caption); print(ctx,String(s.score),2,8,'#fff2ca');
  print(ctx,'BEST',38,1,caption); print(ctx,String(best),38,8,'#e7e6c9');
  print(ctx,'WAVE',75,1,caption); print(ctx,String(s.wave),75,8,energy);
  print(ctx,'HULL',97,1,caption);
  for (let n=0;n<3;n++) {
    const x=97+n*6, color = n < s.integrity ? gold : '#556169';
    pixel(ctx,x+2,8,color); pixel(ctx,x+1,9,color,3); pixel(ctx,x,10,color,5); pixel(ctx,x+1,11,color,3);
    if (n >= s.integrity) pixel(ctx,x+1,10,ink,3);
  }
  print(ctx,s.pulse >= 100 ? 'B READY' : 'PULSE',127,1,s.pulse >= 100 ? '#fff2b1' : caption);
  for(let i=0;i<6;i++) pixel(ctx,127+i*5,9,s.pulse >= (i+1)*100/6 ? (s.pulse>=100 ? gold : teal) : '#3a5259',4,3);
}

function drawEffects(ctx: CanvasRenderingContext2D, state: RunState, reduced: boolean) {
  for (const burst of playback.get(state)?.sparks ?? []) {
    const age = state.tick - burst.tick;
    const x = Math.round(burst.x), y = Math.round(burst.y);
    if (burst.kind === 'pulse') {
      if (age > 18) continue;
      const radius = reduced ? PULSE_RADIUS : Math.ceil(PULSE_RADIUS * (age+1)/19);
      // Octants are plotted with integer pixels, never a smoothed canvas stroke.
      for (let a = 0; a < 64; a++) {
        const angle = a * Math.PI / 32;
        pixel(ctx, x+radius*Math.cos(angle), y+radius*Math.sin(angle), age < 9 ? energy : teal);
      }
    } else {
      if (!reduced && age < 14) {
        const d = 2 + Math.floor(age/2), c = burst.kind === 'hit' ? coral : burst.kind === 'ward' ? teal : gold;
        pixel(ctx,x-d,y-1,c,2); pixel(ctx,x+d,y+1,c,2); pixel(ctx,x-1,y-d,c,1,2); pixel(ctx,x+1,y+d,c,1,2);
      }
      if (burst.kind === 'kill') {
        const score = '+' + burst.value;
        const left = Math.max(0,Math.min(160-score.length*4, x-score.length*2));
        const top = Math.max(16,y-4 - (reduced ? 0 : Math.floor(age/5)));
        print(ctx,score,left+1,top+1,ink);
        print(ctx,score,left,top,'#f6d693');
      }
    }
  }
}

export function drawRiftwatch(ctx: CanvasRenderingContext2D, state: RunState, options: RiftwatchDisplay) {
  const s = state, contrast = options.highContrast;
  captureRiftwatchEvents(s);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sky(contrast),0,0);
  ctx.save();
  ctx.beginPath(); ctx.rect(0,15,160,129); ctx.clip();
  const hitAge = s.tick - (s.invulnerableUntil - 120);
  if (s.invulnerableUntil && hitAge >= 0 && hitAge < 6 && !options.reducedMotion) {
    ctx.translate(hitAge < 3 ? 1 : -1,0);
  }
  if (!options.reducedMotion && !contrast) {
    for (let n=0;n<8;n++) {
      const y=18+(n*19+Math.floor(s.tick/(18+n)))%77;
      pixel(ctx,(n*31+17)%160,y,'#3b4a5b');
    }
  }
  for (const c of s.wards) {
    if (!c.hp) continue;
    if (c.hp === 1) {
      pixel(ctx,c.x-1,c.y-1,contrast ? '#c6d2ae' : '#9a9d86',2);
      pixel(ctx,c.x-1,c.y,'#577a78'); pixel(ctx,c.x,c.y+1,teal);
    } else {
      pixel(ctx,c.x-1,c.y-1,contrast ? '#75c4b8' : '#46877f',3,3);
      pixel(ctx,c.x-1,c.y-1,contrast ? '#ebf7cc' : '#a5ccb1',2);
      pixel(ctx,c.x+1,c.y+1,'#28555d',1);
    }
  }
  for (const w of s.warnings) {
    const x = Math.round(w.x), y = Math.round(w.y);
    const color = w.fireTick-s.tick < 10 ? '#ffdeb1' : gold;
    pixel(ctx,x-2,y,color); pixel(ctx,x+2,y,color); pixel(ctx,x,y+2,color);
    for (let depth=7;depth<=20;depth+=5) pixel(ctx,x+w.vx*depth,y+depth,contrast ? gold : '#aa825e');
  }
  for (const e of s.enemies) {
    const x=Math.round(e.x), y=Math.round(e.y);
    const fold = !options.reducedMotion && (Math.floor(s.waveTick/18)+e.id)%2===1;
    if (e.kind === 'anchor') {
      sprite(ctx,'anchor',x,y,contrast);
      for (let i=0;i<2;i++) {
        const nx = x+(i ? 9 : -9);
        pixel(ctx,nx-1,y-1,ink,3,5);
        if (e.nodes[i]) { pixel(ctx,nx,y,gold,1,3); pixel(ctx,nx-1,y+1,energy,3); }
        else pixel(ctx,nx-1,y+2,'#64526b',3);
      }
      if (!e.nodes[0] && !e.nodes[1]) {
        pixel(ctx,x-2,y,'#eeb790',5,2); pixel(ctx,x,y-1,energy,1,4);
      }
    } else sprite(ctx,fold ? `${e.kind}Fold` : e.kind,x,y,contrast);
    if (e.kind === 'diver' && e.tellUntil > s.tick) {
      pixel(ctx,e.diveTargetX-3,125,gold,2); pixel(ctx,e.diveTargetX+2,125,gold,2);
      pixel(ctx,e.diveTargetX,124,gold,1,3);
      pixel(ctx,x-3,y+5,gold,2); pixel(ctx,x+2,y+5,gold,2);
    }
    if (e.dazedUntil > s.tick) pixel(ctx,x-2,y-6,energy,4);
  }
  for (const p of s.projectiles) {
    const x=Math.round(p.x), y=Math.round(p.y);
    switch (p.kind) {
      case 'player': pixel(ctx,x,y-1,energy,1,4); pixel(ctx,x,y+3,teal); break;
      case 'shard': pixel(ctx,x,y-2,coral,2,2); pixel(ctx,x+1,y,'#ffd296',1,2); break;
      case 'heavy':
        pixel(ctx,x-1,y-2,'#e4a5c2',3,3); pixel(ctx,x-2,y-1,coral,5);
        pixel(ctx,x,y+1,gold,1,2); break;
      case 'anchor':
        pixel(ctx,x-2,y-2,'#ebbedf',1,3); pixel(ctx,x+2,y-2,'#ebbedf',1,3);
        pixel(ctx,x-1,y+1,gold,3); pixel(ctx,x,y+2,energy); break;
    }
  }
  const px=Math.round(s.playerX), py=s.playerY;
  if (s.integrity > 0) {
    if (!options.reducedMotion) pixel(ctx,px-1,py+3,Math.floor(s.tick/6)%2 ? teal : '#46a3ad',2,2 + Math.floor(s.tick/5)%2);
    const movingLeft = Boolean(s.input & INPUT.left), movingRight = Boolean(s.input & INPUT.right);
    sprite(ctx,movingLeft === movingRight ? 'skiff' : movingLeft ? 'bankLeft' : 'bankRight',px,py,contrast);
    if (s.tick-s.lastFire < 5) { pixel(ctx,px,py-6,energy,1,3); pixel(ctx,px-1,py-5,teal,3); }
    if (s.invulnerableUntil > s.tick) {
      const c = hitAge < 12 ? coral : energy;
      pixel(ctx,px-6,py-2,c,1,4); pixel(ctx,px+6,py-2,c,1,4);
      pixel(ctx,px-5,py+2,c,2); pixel(ctx,px+4,py+2,c,2);
    }
  } else {
    pixel(ctx,px-4,py-3,teal,2); pixel(ctx,px+3,py-3,gold,2);
    pixel(ctx,px-2,py+2,energy); pixel(ctx,px+4,py+3,'#626882',2);
  }
  drawEffects(ctx,s,options.reducedMotion);
  if (s.phase === 'tally') {
    pixel(ctx,36,51,'#203d47',88,39);
    pixel(ctx,37,52,ink,86,37);
    const header = 'WAVE '+s.wave+' CLEAR';
    print(ctx,header,80-header.length*2,55,energy);
    print(ctx,'CLEAR',41,64,'#b0c3c0'); print(ctx,String(s.waveBonus.clear),86,64,gold);
    print(ctx,'NO DAMAGE',41,72,'#b0c3c0'); print(ctx,String(s.waveBonus.perfect),86,72,gold);
    print(ctx,'WARDS',41,80,'#b0c3c0'); print(ctx,String(s.waveBonus.wards),86,80,gold);
  } else if (s.waveLimit-s.waveTick < 120 && s.phase === 'play') {
    print(ctx,'FINAL DESCENT',54,17,gold);
  }
  if (s.chain >= 2 && s.phase === 'play') {
    print(ctx,['','','1.25X','1.50X','1.75X','2.00X'][s.chain],2,136,'#fff0b9');
  }
  ctx.restore();
  drawHud(ctx,s,options.highScore,contrast);
  ctx.restore();
}
