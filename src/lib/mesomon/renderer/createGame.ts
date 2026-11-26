import type PhaserTypes from 'phaser';
import type { Direction, GameSession, MapDefinition, MapObject, SpeciesId, TileKind } from '../types';
import { CREATURES, MESOMON_ASSETS, PEOPLE, SCENERY, TILES, personArt, propArt } from '../assets';
import { paintBattleStage } from './battleStage';
import { paintTerrainDepth } from './terrain';
import { canWalk, getMap, getVisibleObjects } from '../engine';

export interface MesomonViewOptions {
  onInteract?: (id: string) => void;
  onFirstFrame?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
  /** Opt in only when sealAccuracy() also drives the caller’s input. */
  sealRing?: boolean;
}
export interface MesomonView {
  update(session: GameSession): void;
  pause(paused: boolean): void;
  sealAccuracy(): number;
  destroy(): void;
}
const DIRECTION_FRAME: Record<Direction, number> = { down: 0, left: 3, right: 6, up: 9 };
const CREATURE_DIRECTION: Record<Direction, number> = { down: 0, left: 2, right: 4, up: 6 };
const TILE: Record<TileKind, string> = { water: 'water', stone: 'stone', wood: 'dock', wall: 'wall', roof: 'roof', reeds: 'reeds', sand: 'sand', floor: 'floor', 'dark-water': 'water2', stairs: 'stair', grass: 'grass' };

const sheets = [
  { key: 'ms:tiles', url: MESOMON_ASSETS.tiles, size: 16, columns: TILES.length, rows: 1 },
  { key: 'ms:people', url: MESOMON_ASSETS.people, size: 16, columns: 15, rows: PEOPLE.length },
  { key: 'ms:creatures', url: MESOMON_ASSETS.creatures, size: 16, columns: 8, rows: CREATURES.length },
  { key: 'ms:battle', url: MESOMON_ASSETS.battle, size: 48, columns: CREATURES.length, rows: 1 },
];
const artwork = [
  ...sheets.map(sheet => ({ url: sheet.url, width: sheet.columns * sheet.size, height: sheet.rows * sheet.size })),
  { url: MESOMON_ASSETS.scenery, width: 128, height: 64 },
];
const artError = 'The harbor artwork could not load. Retry when your connection returns.';
const closed = () => new DOMException('Mesomon view was closed.', 'AbortError');

async function loadArtwork(signal?: AbortSignal) {
  if (signal?.aborted) throw closed();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 18000);
  try {
    return await Promise.all(artwork.map(sheet => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const cleanup = () => {
        image.onload = null;
        image.onerror = null;
        controller.signal.removeEventListener('abort', cancel);
      };
      const cancel = () => {
        cleanup();
        image.removeAttribute('src');
        reject(signal?.aborted ? closed() : new Error(artError));
      };
      controller.signal.addEventListener('abort', cancel, { once: true });
      image.onerror = () => { cleanup(); reject(new Error(artError)); };
      image.onload = async () => {
        try {
          await image.decode();
          if (image.naturalWidth !== sheet.width || image.naturalHeight !== sheet.height) {
            throw new Error(artError);
          }
          resolve(image);
        } catch {
          reject(new Error(artError));
        } finally {
          cleanup();
        }
      };
      image.src = sheet.url;
    })));
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}

/** Phaser is imported only after the lazy Mesomon route mounts. Rules stay in engine.ts. */
export async function createMesomonView(parent: HTMLElement, options: MesomonViewOptions = {}): Promise<MesomonView> {
  const Phaser = (await import('phaser')).default;
  const images = await loadArtwork(options.signal);
  if (options.signal?.aborted) throw closed();
  let latest: GameSession | null = null;
  let currentScene: PortMarcheScene | null = null;
  let disposed = false;
  let paused = false;
  let awaitingFirstFrame = true;
  let bootTimer: ReturnType<typeof setTimeout> | null = null;
  const sealPhase = (time: number) => (time % 1800) / 1800;
  class PortMarcheScene extends Phaser.Scene {
    private ready = false;
    private mapId = '';
    private mapTexture: string | null = null;
    private background: PhaserTypes.GameObjects.Image | null = null;
    private tavian: PhaserTypes.GameObjects.Sprite | null = null;
    private companion: PhaserTypes.GameObjects.Sprite | null = null;
    private objects: { data: MapObject; sprite: PhaserTypes.GameObjects.Sprite; shadow: PhaserTypes.GameObjects.Ellipse | null }[] = [];
    private objectSignature = '';
    private decorations: PhaserTypes.GameObjects.Graphics | null = null;
    private effects: PhaserTypes.GameObjects.Graphics | null = null;
    private battleSprites: PhaserTypes.GameObjects.Sprite[] = [];
    private battleMode = false;
    private battleStage: PhaserTypes.GameObjects.Graphics | null = null;
    private frameAt = 0;
    private moveStart = 0;
    private from = { x: 0, y: 0 };
    private target = { x: 0, y: 0 };
    private companionFacing: Direction = 'down';
    private playerShadow: PhaserTypes.GameObjects.Ellipse | null = null;
    private companionShadow: PhaserTypes.GameObjects.Ellipse | null = null;
    private previousPosition = '';
    private companionFrom = { x: 0, y: 0 };
    private companionTarget = { x: 0, y: 0 };
    constructor() { super({ key: 'PortMarche' }); }
    create(): void {
      if (disposed) return;
      if (bootTimer) clearTimeout(bootTimer);
      bootTimer = null;
      for (const [i, sheet] of sheets.entries()) {
        const texture = this.textures.addSpriteSheet(sheet.key, images[i], { frameWidth: sheet.size, frameHeight: sheet.size });
        if (!texture || texture.getFrameNames().length !== sheet.columns * sheet.rows) {
          options.onError?.(artError);
          return;
        }
      }
      const scenery = this.textures.addImage('ms:scenery', images[sheets.length]);
      if (!scenery) { options.onError?.(artError); return; }
      for (const [name, frame] of Object.entries(SCENERY)) {
        scenery.add(name, 0, frame.x, frame.y, frame.width, frame.height);
      }
      this.ready = true; registerScene(this);
      this.cameras.main.setRoundPixels(true);
      this.decorations = this.add.graphics().setDepth(-20);
      this.effects = this.add.graphics().setDepth(10000);
      this.playerShadow = this.add.ellipse(0, 0, 10, 3, 0x102224, 0.3);
      this.companionShadow = this.add.ellipse(0, 0, 9, 3, 0x102224, 0.3).setVisible(false);
      this.tavian = this.add.sprite(0, 0, 'ms:people', 0).setOrigin(0.5, 1);
      this.companion = this.add.sprite(0, 0, 'ms:creatures', 0).setOrigin(0.5, 1).setVisible(false);
      this.game.canvas.setAttribute('aria-hidden', 'true');
      this.game.canvas.style.imageRendering = 'pixelated';
      this.game.canvas.style.touchAction = 'none';
      this.scale.updateBounds();
      if (latest) this.apply(latest);
      if (paused) this.scene.pause();
    }
    apply(session: GameSession): void {
      if (!this.ready || disposed) return;
      const map = getMap(session.save);
      if (this.mapId !== map.id) this.rebuildMap(map);
      if (awaitingFirstFrame) {
        awaitingFirstFrame = false;
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (!disposed) options.onFirstFrame?.();
        });
      }
      const signature = getVisibleObjects(session.save).map(o => `${o.id}:${o.sprite}:${o.x}:${o.y}`).join('|') + `:${session.save.questFlags.gate_opened}:${session.save.rifts['port-marche']}`;
      if (signature !== this.objectSignature) { this.rebuildObjects(getVisibleObjects(session.save)); this.objectSignature = signature; }
      const { player } = session.save;
      const nextPosition = `${player.mapId}:${player.x}:${player.y}`;
      const next = { x: player.x * 16 + 8, y: player.y * 16 + 16 };
      if (nextPosition !== this.previousPosition) {
        const jump = this.previousPosition.split(':')[0] !== player.mapId || !this.tavian || Math.abs(next.x - this.target.x) + Math.abs(next.y - this.target.y) > 18;
        this.from = jump ? next : { x: this.tavian?.x ?? next.x, y: this.tavian?.y ?? next.y };
        const adjacent = [[0, 1], [-1, 0], [1, 0], [0, -1]].find(([dx, dy]) => canWalk(session.save, player.x + dx, player.y + dy));
        const previousFollower = this.companionTarget;
        this.companionTarget = jump ? { x: next.x + (adjacent?.[0] ?? 0) * 16, y: next.y + (adjacent?.[1] ?? 0) * 16 } : { ...this.target };
        this.companionFrom = jump ? this.companionTarget : {
          x: this.companion?.visible ? this.companion.x : previousFollower.x,
          y: this.companion?.visible ? this.companion.y : previousFollower.y,
        };
        const dx = jump ? next.x - this.companionTarget.x : this.companionTarget.x - previousFollower.x;
        const dy = jump ? next.y - this.companionTarget.y : this.companionTarget.y - previousFollower.y;
        if (dx !== 0) this.companionFacing = dx > 0 ? 'right' : 'left';
        else if (dy !== 0) this.companionFacing = dy > 0 ? 'down' : 'up';
        this.target = next; this.moveStart = this.time.now; this.previousPosition = nextPosition;
        if (jump) this.tavian?.setPosition(next.x, next.y);
      }
      this.tavian?.setVisible(!session.save.battle).setFrame(DIRECTION_FRAME[player.facing]);
      this.companion?.setVisible(!session.save.battle && session.save.party.length > 0 && session.save.questFlags.companion_released === true);
      const hasBattle = Boolean(session.save.battle);
      if (hasBattle !== this.battleMode) { this.battleMode = hasBattle; this.setupBattle(session); }
      if (hasBattle) this.updateBattle(session);
    }
    private rebuildMap(map: MapDefinition): void {
      this.background?.destroy(); this.background = null;
      if (this.mapTexture) this.textures.remove(this.mapTexture);
      this.mapId = map.id; this.objectSignature = '';
      this.mapTexture = `ms:map:${map.id}`;
      const texture = this.textures.createCanvas(this.mapTexture, map.width * 16, map.height * 16);
      if (texture) {
        const context = texture.context;
        const atlas = this.textures.get('ms:tiles').getSourceImage() as CanvasImageSource;
        context.imageSmoothingEnabled = false;
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
          const kind = map.tiles[y][x];
          let tile = TILE[kind];
          if (map.ambience === 'underwharf' && kind === 'wall') tile = 'rock';
          if (map.ambience === 'underwharf' && kind === 'floor') tile = 'stone';
          if (map.id === 'ship') {
            if (kind === 'wall') tile = x === 3 ? 'port' : x === 12 ? 'starboard' : 'bow';
            if (kind === 'roof') tile = `cabin-${x - (x < 9 ? 4 : 9)}-${y - 3}`;
          }
          if (kind === 'water' && (x + y) % 2) tile = 'water2';
          context.drawImage(atlas, Math.max(0, TILES.indexOf(tile as typeof TILES[number])) * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
          // Wall footings, window rhythm and reeds are painted into the cached layer.
          if (kind === 'wall' && map.id !== 'ship' && map.ambience !== 'underwharf' && (x + y) % 4 === 0) context.drawImage(atlas, TILES.indexOf('window') * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
          if (kind === 'stone' && (x * 7 + y * 13) % 29 === 0) { context.fillStyle = '#657D55'; context.fillRect(x * 16 + 2, y * 16 + 12, 3, 1); }
          if (kind === 'wood' && (x * 3 + y) % 17 === 0 && map.tiles[y + 1]?.[x] === 'water') context.drawImage(atlas, TILES.indexOf('rope') * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
        }
        if (map.id === 'workshop') {
          for (const [x, y] of [[3, 3], [4, 3], [11, 3], [12, 3]]) context.drawImage(atlas, TILES.indexOf('shelf') * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
        }
        paintTerrainDepth(context, map);
        if (map.id === 'harbor') {
          const skiff = SCENERY.skiff;
          // Moored in the water directly alongside the west edge of the arrival pier.
          context.drawImage(images[sheets.length], skiff.x, skiff.y, skiff.width, skiff.height, 21 * 16, 31 * 16, skiff.width, skiff.height);
        }
        // The same map data remains the collision source; these marks never add invisible blockers.
        texture.refresh(); this.background = this.add.image(0, 0, this.mapTexture).setOrigin(0).setDepth(-100);
      }
      this.cameras.main.setBounds(0, 0, map.width * 16, map.height * 16);
      this.previousPosition = '';
    }
    private rebuildObjects(objects: MapObject[]): void {
      this.objects.forEach(o => { o.sprite.destroy(); o.shadow?.destroy(); }); this.objects = [];
      for (const data of objects) {
        const person = personArt(data.id, data.sprite);
        const peopleRow = PEOPLE.indexOf(person as typeof PEOPLE[number]);
        const creatureRow = CREATURES.indexOf(data.sprite as SpeciesId);
        const actor = peopleRow >= 0 || creatureRow >= 0;
        const objectTile = data.sprite === 'rift' && latest?.save.rifts['port-marche'] === 'sealed' ? 'stone' : data.sprite === 'gate' && latest?.save.questFlags.gate_opened === true ? 'bridge' : propArt(data.sprite);
        const texture = peopleRow >= 0 ? 'ms:people' : creatureRow >= 0 ? 'ms:creatures' : 'ms:tiles';
        const frame = peopleRow >= 0 ? peopleRow * 15 + DIRECTION_FRAME[data.direction ?? 'down'] : creatureRow >= 0 ? creatureRow * 8 + CREATURE_DIRECTION[data.direction ?? 'down'] : Math.max(0, TILES.indexOf(objectTile as typeof TILES[number]));
        const x = data.x * 16 + 8, y = data.y * 16 + 16;
        const landmark = data.sprite === 'crane' || data.sprite === 'wheel' ? data.sprite : null;
        let shadow: PhaserTypes.GameObjects.Ellipse | null = null;
        if (landmark === 'wheel') {
          shadow = this.add.ellipse(x + 3, y - 1, 16, 5, 0x102224, 0.32);
        } else if (actor) {
          shadow = this.add.ellipse(x, y - 1, 10, 3, 0x102224, 0.25);
        }
        shadow?.setDepth(y - 0.5);
        const sprite = this.add.sprite(x, y, landmark ? 'ms:scenery' : texture, landmark ?? frame)
          .setOrigin(landmark === 'crane' ? 18 / SCENERY.crane.width : 0.5, 1).setDepth(y);
        sprite.setInteractive({ useHandCursor: true, pixelPerfect: Boolean(landmark) });
        sprite.on('pointerup', () => { if (!disposed && !paused) options.onInteract?.(data.id); });
        this.objects.push({ data, sprite, shadow });
      }
    }
    private setupBattle(session: GameSession): void {
      this.battleStage?.destroy(); this.battleStage = null;
      this.battleSprites.forEach(s => s.destroy()); this.battleSprites = [];
      this.background?.setVisible(!this.battleMode); this.objects.forEach(o => { o.sprite.setVisible(!this.battleMode); o.shadow?.setVisible(!this.battleMode); });
      if (!this.battleMode || !session.save.battle) { this.cameras.main.setBounds(0, 0, getMap(session.save).width * 16, getMap(session.save).height * 16); return; }
      this.cameras.main.setScroll(0, 0).removeBounds();
      this.battleStage = this.add.graphics().setDepth(8000);
      paintBattleStage(this.battleStage, session.save.battle.enemy.speciesId === 'rift-wretch', getMap(session.save).ambience === 'harbor');
      this.battleSprites = [this.add.sprite(45, 98, 'ms:battle', 0).setOrigin(0.5, 1).setFlipX(true).setDepth(9000), this.add.sprite(116, 67, 'ms:battle', 0).setOrigin(0.5, 1).setDepth(9000)];
    }
    private updateBattle(session: GameSession): void {
      const battle = session.save.battle;
      if (!battle || this.battleSprites.length < 2) return;
      const ally = battle.allies[battle.activeIndex];
      this.battleSprites[0].setFrame(Math.max(0, CREATURES.indexOf(ally.speciesId)));
      this.battleSprites[1].setFrame(Math.max(0, CREATURES.indexOf(battle.enemy.speciesId)));
      this.battleSprites[0].setAlpha(ally.vitality > 0 ? 1 : 0.35); this.battleSprites[1].setAlpha(battle.enemy.vitality > 0 ? 1 : 0.35);
    }
    update(time: number): void {
      const session = latest;
      if (!session || !this.ready || disposed || paused || !this.tavian || !this.effects || !this.decorations) return;
      const reduced = session.save.settings.reducedMotion;
      const map = getMap(session.save);
      const progress = reduced ? 1 : Math.min(1, (time - this.moveStart) / 130);
      this.tavian.setPosition(Math.round(this.from.x + (this.target.x - this.from.x) * progress), Math.round(this.from.y + (this.target.y - this.from.y) * progress));
      const walking = progress < 1 && (this.from.x !== this.target.x || this.from.y !== this.target.y);
      this.tavian.setFrame(DIRECTION_FRAME[session.save.player.facing] + (walking ? 1 + Math.floor(time / 95) % 2 : 0)).setDepth(this.tavian.y + 1);
      this.playerShadow?.setVisible(this.tavian.visible).setPosition(this.tavian.x, this.tavian.y - 2).setDepth(this.tavian.y - 0.5);
      this.companionShadow?.setVisible(Boolean(this.companion?.visible));
      if (!this.battleMode) this.cameras.main.centerOn(this.tavian.x, this.tavian.y - 8);
      if (this.companion?.visible) {
        const x = Math.round(this.companionFrom.x + (this.companionTarget.x - this.companionFrom.x) * progress), y = Math.round(this.companionFrom.y + (this.companionTarget.y - this.companionFrom.y) * progress);
        const species = CREATURES.indexOf(session.save.party[0].speciesId);
        const frame = species * 8 + CREATURE_DIRECTION[this.companionFacing] + (walking ? Math.floor(time / 120) % 2 : 0);
        this.companion.setPosition(x, y).setDepth(y).setFrame(frame);
        this.companionShadow?.setPosition(x, y - 2).setDepth(y - 0.5);
      }
      this.effects.clear(); this.decorations.clear();
      if (this.battleMode) {
        const boss = session.save.battle?.enemy.speciesId === 'rift-wretch';
        this.battleSprites.forEach((sprite, i) => {
          const bob = reduced ? 0 : Math.floor(time / (boss && i === 1 ? 430 : 850)) % 2;
          sprite.setY((i === 0 ? 98 : 67) + bob);
        });
        return;
      }
      // At most one small effect per visible water row; no particles or per-frame React work.
      const view = this.cameras.main.worldView;
      if (!reduced && map.ambience === 'harbor') {
        this.decorations.fillStyle(0x9FD6B1, 0.25);
        const step = Math.floor(time / 650) % 3;
        for (let y = Math.max(0, Math.floor(view.top / 16)); y < Math.min(map.height, Math.ceil(view.bottom / 16)); y++) {
          const x = Math.max(0, Math.floor(view.left / 16)) + (y * 3 + step) % 10;
          if (map.tiles[y]?.[x] === 'water') this.decorations.fillRect(x * 16 + 3 + step, y * 16 + 7, 5, 1);
        }
      }
      if (map.id === 'passage' && session.save.questFlags.sluice_open !== true) {
        this.decorations.fillStyle(0x483F32); this.decorations.fillRect(160, 176, 32, 64);
        this.decorations.fillStyle(0xC09245); for (let x = 162; x < 191; x += 6) this.decorations.fillRect(x, 177, 2, 62);
        this.decorations.fillStyle(0x102224); this.decorations.fillRect(160, 188, 32, 3); this.decorations.fillRect(160, 222, 32, 3);
      }
      if (time - this.frameAt > 600) {
        this.frameAt = time;
        for (const o of this.objects) {
          const index = CREATURES.indexOf(o.data.sprite as SpeciesId);
          if (index >= 0) o.sprite.setFrame(index * 8 + CREATURE_DIRECTION[o.data.direction ?? 'down'] + (!reduced ? Math.floor(time / 600) % 2 : 0));
          const worker = PEOPLE.indexOf(personArt(o.data.id, o.data.sprite) as typeof PEOPLE[number]);
          if (worker >= 7) o.sprite.setFrame(worker * 15 + (!reduced && (o.data.direction ?? 'down') === 'down' && Math.floor(time / 1200) % 2 ? 12 : DIRECTION_FRAME[o.data.direction ?? 'down']));
        }
      }
      for (const o of this.objects) {
        if (o.data.kind === 'sense' && session.save.party.length > 0) {
          this.effects.lineStyle(1, 0x9FD6B1, 0.7);
          const radius = reduced ? 9 : 6 + Math.floor(time / 180) % 5;
          this.effects.strokeEllipse(o.data.x * 16 + 8, o.data.y * 16 + 10, radius * 2, radius);
        }
        if (['clue', 'pickup', 'crystal'].includes(o.data.kind)) {
          this.effects.fillStyle(0xE8E1C6, 0.85); this.effects.fillRect(o.sprite.x - 1, o.sprite.y - 19, 2, 2);
        }
      }
      if (session.save.seal.active && options.sealRing) this.drawSeal(time, reduced);
    }
    private drawSeal(time: number, reduced: boolean): void {
      if (!this.effects) return;
      const cx = this.target.x, cy = this.target.y - 30;
      this.effects.fillStyle(0x102224, 0.68); this.effects.fillCircle(cx, cy, 39);
      this.effects.lineStyle(2, 0x9FD6B1, 1); this.effects.strokeCircle(cx, cy, 30);
      this.effects.lineStyle(1, 0xE8E1C6, 0.9); this.effects.strokeCircle(cx, cy, reduced ? 30 : 8 + sealPhase(time) * 31);
      for (let i = 0; i < 3; i++) { this.effects.fillStyle(i < (latest?.save.seal.pulses ?? 0) ? 0x9FD6B1 : 0x30474A); this.effects.fillRect(cx - 10 + i * 8, cy + 1, 5, 5); }
    }
  }
  function registerScene(scene: PortMarcheScene) { currentScene = scene; }
  const game = new Phaser.Game({
    type: Phaser.CANVAS, parent, width: 160, height: 144, backgroundColor: '#102224',
    pixelArt: true, roundPixels: true, antialias: false, banner: false, autoFocus: false,
    audio: { noAudio: true }, input: { keyboard: false }, scene: PortMarcheScene,
    fps: { target: 60 }, render: { antialias: false, pixelArt: true, roundPixels: true },
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!disposed && game.isBooted) game.scale.updateBounds(); }) : null;
  resizeObserver?.observe(parent);
  bootTimer = setTimeout(() => { if (!disposed && !currentScene) options.onError?.('The harbor is taking too long to load. Retry to reopen the scene.'); }, 18000);
  const view: MesomonView = {
    update(session) { latest = session; currentScene?.apply(session); },
    pause(next) { paused = next; if (!currentScene) return; if (next) currentScene.scene.pause(); else currentScene.scene.resume(); },
    sealAccuracy() { if (latest?.save.settings.reducedMotion || latest?.save.settings.sealAssist) return 1; return Math.max(0, 1 - Math.abs(sealPhase(currentScene?.time.now ?? 0) - 22 / 31) / 0.3); },
    destroy() {
      if (disposed) return;
      disposed = true; resizeObserver?.disconnect(); if (bootTimer) clearTimeout(bootTimer); bootTimer = null;
      options.signal?.removeEventListener('abort', abort); currentScene = null; latest = null;
      game.destroy(true);
    },
  };
  function abort() { view.destroy(); }
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) view.destroy();
  return view;
}
