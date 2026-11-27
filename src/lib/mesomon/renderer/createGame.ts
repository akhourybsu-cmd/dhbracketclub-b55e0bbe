import type PhaserTypes from 'phaser';
import type { Direction, GameSession, MapDefinition, MapObject, SpeciesId, TileKind } from '../types';
import { CREATURES, MESOMON_ASSETS, PEOPLE, SCENERY, TILES, personArt, propArt } from '../assets';
import { mountBattleBackdrop } from './battleStage';
import { BATTLE_CELL, BATTLE_LANDING, BATTLE_POSES, BATTLE_RENDER_SCALE, FIELD_SCREEN, battleFrame, battleOpacity, battlePose, fighterMotion } from './battleMotion';
import { impactDefense, paintBattleEffect } from './battleEffects';
import { getBattleBeat, getBattleHitSide } from '../battlePlayback';
import { paintInterior, paintInteriorFloor } from './interiors';
import { paintTerrainDepth } from './terrain';
import { paintTidalWater } from './tidalWater';
import { paintChamberInstrument } from './chamberInstrument';
import { paintExteriors } from './exteriors';
import { paintQuaySquare } from './quaySquare';
import { paintTideworks, type TideworksState } from './tideworks';
import { paintEnvironmentMotion } from './environmentMotion';
import { paintCastShadow, paintFootfall, strideLift, type FieldStep } from './fieldStride';
import { foregroundForMap, paintForeground } from './foreground';
import { INTERACTION_ART, interactionArtKey, paintInteractionArt } from './interactionsArt';
import { WALK_STEP_MS } from '../input';
import { canWalk, DELTAS, getMap, getPhase, getVisibleObjects, nearbyInteractions } from '../engine';

// Native pixels relative to the interaction tile. Raised desks and recessed doors
// can be tapped on their visible faces, even where they project into the next tile.
const paintedHits: Record<string, [number, number, number, number]> = {
  chart: [-5, -10, 27, 27], 'field-map': [-2, -9, 21, 25], 'satchel-hook': [-2, -19, 21, 35],
  'workshop-note': [-2, -11, 22, 27], kettle: [-2, -13, 19, 29], 'rest-rope': [-2, -4, 20, 20],
  'workshop-exit': [-2, 0, 21, 24], gangplank: [-4, 0, 24, 40],
  'workshop-door': [-7, -39, 30, 55], 'tide-door': [0, 0, 16, 16],
  'passage-door': [0, -12, 38, 33], 'chamber-door': [-9, -26, 33, 42],
};
interface TilePoint { x: number; y: number }

export interface MesomonViewOptions {
  onInteract?: (id: string) => void;
  onTap?: (tile: TilePoint, objectId?: string) => void;
  walkDestination?: () => TilePoint | undefined;
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
  { key: 'ms:battle', url: MESOMON_ASSETS.battle, size: BATTLE_CELL, columns: BATTLE_POSES.length, rows: CREATURES.length },
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
    private mapState = false;
    private nearbyTarget: string | undefined;
    private mapTexture: string | null = null;
    private background: PhaserTypes.GameObjects.Image | null = null;
    private foreground: PhaserTypes.GameObjects.Image[] = [];
    private tavian: PhaserTypes.GameObjects.Sprite | null = null;
    private companion: PhaserTypes.GameObjects.Sprite | null = null;
    private objects: { data: MapObject; sprite: PhaserTypes.GameObjects.Sprite; shadow: PhaserTypes.GameObjects.Ellipse | null }[] = [];
    private objectSignature = '';
    private decorations: PhaserTypes.GameObjects.Graphics | null = null;
    private effects: PhaserTypes.GameObjects.Graphics | null = null;
    private battleSprites: PhaserTypes.GameObjects.Sprite[] = [];
    private battleMode = false;
    private battleBeatKey = '';
    private beatElapsedMs = 0;
    private hitSide: 'ally' | 'enemy' | null = null;
    private battleStage: PhaserTypes.GameObjects.Graphics | null = null;
    private frameAt = 0;
    private approachKey = '';
    private approachElapsed = 0;
    private moveStart = 0;
    private fieldStep?: FieldStep;
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
      this.textures.createCanvas('ms:touch-tile', 16, 16);
      for (const key of INTERACTION_ART.keys) {
        const texture = this.textures.createCanvas(`ms:interaction:${key}`, INTERACTION_ART.width, INTERACTION_ART.height);
        if (!texture) continue;
        paintInteractionArt(texture.context, key);
        texture.refresh();
      }
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
      this.game.canvas.dataset.scene = 'field';
      this.game.canvas.style.imageRendering = 'pixelated';
      this.game.canvas.style.touchAction = 'none';
      this.scale.updateBounds();
      this.input.on('pointerup', (pointer: PhaserTypes.Input.Pointer, over: PhaserTypes.GameObjects.GameObject[]) => {
        if (paused || disposed || !latest || getPhase(latest) !== 'explore' || pointer.getDistance() > 8 || pointer.button > 0) return;
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const hit = over.find(object => object.getData('interactionId'));
        const id: string | undefined = hit?.getData('interactionId');
        if (options.onTap) options.onTap({ x: Math.floor(world.x / 16), y: Math.floor(world.y / 16) }, id);
        else if (id) options.onInteract?.(id);
      });
      if (latest) this.apply(latest);
      if (paused) this.scene.pause();
    }
    apply(session: GameSession): void {
      if (!this.ready || disposed) return;
      const map = getMap(session.save);
      const tide: TideworksState = { gateOpen: session.save.questFlags.gate_opened === true, sluiceOpen: session.save.questFlags.sluice_open === true, sealed: session.save.rifts['port-marche'] === 'sealed' };
      const pageFound = session.save.questFlags.page_found === true;
      const mapState = ((map.id === 'workshop' || map.id === 'harbor') && pageFound) || (map.id === 'tide-stairs' && tide.gateOpen) || (map.id === 'passage' && tide.sluiceOpen) || (map.id === 'chamber' && tide.sealed);
      if (this.mapId !== map.id || this.mapState !== mapState) {
        this.mapState = mapState;
        this.rebuildMap(map, tide, pageFound);
      }
      this.nearbyTarget = getPhase(session) === 'explore' ? nearbyInteractions(session.save)[0]?.id : undefined;
      if (awaitingFirstFrame) {
        awaitingFirstFrame = false;
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (!disposed) options.onFirstFrame?.();
        });
      }
      const visible = getVisibleObjects(session.save);
      const signature = visible.map(o => `${o.id}:${o.sprite}:${o.x}:${o.y}:${o.direction ?? ''}`).join('|') + `:${tide.gateOpen}:${tide.sluiceOpen}:${tide.sealed}`;
      if (signature !== this.objectSignature) { this.rebuildObjects(visible, tide); this.objectSignature = signature; }
      const { player } = session.save;
      const nextPosition = `${player.mapId}:${player.x}:${player.y}`;
      const next = { x: player.x * 16 + 8, y: player.y * 16 + 16 };
      if (nextPosition !== this.previousPosition) {
        const jump = this.previousPosition.split(':')[0] !== player.mapId || !this.tavian || Math.abs(next.x - this.target.x) + Math.abs(next.y - this.target.y) > 18;
        if (jump) this.fieldStep = undefined;
        else {
          const x = (this.target.x - 8) / 16, y = this.target.y / 16 - 1;
          const direction = next.x > this.target.x ? 'right' : next.x < this.target.x ? 'left' : next.y > this.target.y ? 'down' : 'up';
          this.fieldStep = { x, y, surface: map.tiles[y][x], direction };
        }
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
    private rebuildMap(map: MapDefinition, tide: TideworksState, pageFound: boolean): void {
      const entering = this.mapId !== map.id;
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
          if (kind === 'water' || kind === 'dark-water') continue;
          let tile = TILE[kind];
          if (map.ambience === 'underwharf' && kind === 'wall') tile = 'rock';
          if (map.ambience === 'underwharf' && kind === 'floor') tile = 'stone';
          if (map.id === 'ship') {
            if (kind === 'wall') tile = x === 3 ? 'port' : x === 12 ? 'starboard' : 'bow';
            if (kind === 'roof') tile = `cabin-${x - (x < 9 ? 4 : 9)}-${y - 3}`;
          }
          context.drawImage(atlas, Math.max(0, TILES.indexOf(tile as typeof TILES[number])) * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
          // Wall footings, window rhythm and reeds are painted into the cached layer.
          if (kind === 'wall' && map.id !== 'ship' && map.ambience !== 'underwharf' && (x + y) % 4 === 0) context.drawImage(atlas, TILES.indexOf('window') * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
          if (kind === 'stone' && (x * 7 + y * 13) % 29 === 0) { context.fillStyle = '#657D55'; context.fillRect(x * 16 + 2, y * 16 + 12, 3, 1); }
          if (kind === 'wood' && (x * 3 + y) % 17 === 0 && map.tiles[y + 1]?.[x] === 'water') context.drawImage(atlas, TILES.indexOf('rope') * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
        }
        if (map.id === 'workshop') {
          for (const [x, y] of [[3, 3], [4, 3], [11, 3], [12, 3]]) context.drawImage(atlas, TILES.indexOf('shelf') * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
        }
        paintTidalWater(context, map);
        paintInteriorFloor(context, map);
        paintTerrainDepth(context, map);
        paintInterior(context, map.id, { pageFound, sluiceOpen: tide.sluiceOpen });
        paintExteriors(context, map, pageFound);
        paintQuaySquare(context, map);
        paintTideworks(context, map, tide);
        if (map.id === 'chamber') paintChamberInstrument(context, tide.sealed);
        if (map.id === 'harbor') {
          const skiff = SCENERY.skiff;
          // Moored in the water directly alongside the west edge of the arrival pier.
          context.drawImage(images[sheets.length], skiff.x, skiff.y, skiff.width, skiff.height, 21 * 16, 31 * 16, skiff.width, skiff.height);
        }
        // The same map data remains the collision source; these marks never add invisible blockers.
        texture.refresh(); this.background = this.add.image(0, 0, this.mapTexture).setOrigin(0).setDepth(-100);
      }
      this.cameras.main.setBounds(0, 0, map.width * 16, map.height * 16);
      if (entering) {
        this.previousPosition = '';
        for (const image of this.foreground) {
          const key = image.texture.key;
          image.destroy();
          this.textures.remove(key);
        }
        this.foreground = [];
        for (const piece of foregroundForMap(map.id)) {
          const key = `ms:foreground:${map.id}:${piece.id}`;
          const layer = this.textures.createCanvas(key, piece.width, piece.height);
          if (!layer) continue;
          paintForeground(layer.context, piece);
          layer.refresh();
          this.foreground.push(this.add.image(piece.x, piece.y, key).setOrigin(0).setDepth(piece.footY - 0.25));
        }
      }
    }
    private rebuildObjects(objects: MapObject[], tide: TideworksState): void {
      this.objects.forEach(o => { o.sprite.destroy(); o.shadow?.destroy(); }); this.objects = [];
      for (const data of objects) {
        const person = personArt(data.id, data.sprite);
        const peopleRow = PEOPLE.indexOf(person as typeof PEOPLE[number]);
        const creatureRow = CREATURES.indexOf(data.sprite as SpeciesId);
        const actor = peopleRow >= 0 || creatureRow >= 0;
        const objectTile = data.sprite === 'rift' && latest?.save.rifts['port-marche'] === 'sealed' ? 'stone' : data.id === 'tide-lattice' && latest?.save.questFlags.gate_opened === true ? 'bridge' : propArt(data.sprite);
        const texture = peopleRow >= 0 ? 'ms:people' : creatureRow >= 0 ? 'ms:creatures' : 'ms:tiles';
        const frame = peopleRow >= 0 ? peopleRow * 15 + DIRECTION_FRAME[data.direction ?? 'down'] : creatureRow >= 0 ? creatureRow * 8 + CREATURE_DIRECTION[data.direction ?? 'down'] : Math.max(0, TILES.indexOf(objectTile as typeof TILES[number]));
        const x = data.x * 16 + 8, y = data.y * 16 + 16;
        const landmark = data.sprite === 'crane' ? 'crane' : data.id === 'gate-wheel' ? 'wheel' : null;
        let shadow: PhaserTypes.GameObjects.Ellipse | null = null;
        if (landmark === 'wheel') {
          shadow = this.add.ellipse(x + 3, y - 1, 16, 5, 0x102224, 0.32);
        } else if (actor) {
          shadow = this.add.ellipse(x, y - 1, 10, 3, 0x102224, 0.25);
        }
        shadow?.setDepth(y - 0.5);
        const area = paintedHits[data.id];
        const art = interactionArtKey(data, tide);
        let key: string = texture;
        let objectFrame: number | string | undefined = frame;
        if (landmark) { key = 'ms:scenery'; objectFrame = landmark; }
        if (art) { key = `ms:interaction:${art}`; objectFrame = undefined; }
        if (area) { key = 'ms:touch-tile'; objectFrame = undefined; }
        const sprite = this.add.sprite(x, y, key, objectFrame)
          .setOrigin(landmark === 'crane' ? 18 / SCENERY.crane.width : 0.5, 1).setDepth(y);
        if (area) {
          sprite.setInteractive({ hitArea: new Phaser.Geom.Rectangle(...area), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
        } else {
          sprite.setInteractive({ useHandCursor: true, pixelPerfect: Boolean(landmark) });
        }
        sprite.setData('interactionId', data.id);
        this.objects.push({ data, sprite, shadow });
      }
    }
    private setupBattle(session: GameSession): void {
      this.battleBeatKey = '';
      this.beatElapsedMs = 0;
      this.hitSide = null;
      this.battleStage?.destroy(); this.battleStage = null;
      this.battleSprites.forEach(s => s.destroy()); this.battleSprites = [];
      this.background?.setVisible(!this.battleMode); this.objects.forEach(o => { o.sprite.setVisible(!this.battleMode); o.shadow?.setVisible(!this.battleMode); });
      this.foreground.forEach(image => image.setVisible(!this.battleMode));
      // Between the stage and portraits, so spray and currents never hide the art.
      this.effects?.setDepth(this.battleMode ? 8900 : 10000);
      this.game.canvas.dataset.scene = this.battleMode ? 'battle' : 'field';
      const scale = this.battleMode ? BATTLE_RENDER_SCALE : 1;
      const width = FIELD_SCREEN.width * scale, height = FIELD_SCREEN.height * scale;
      this.scale.resize(width, height);
      const camera = this.cameras.main.setViewport(0, 0, width, height).setZoom(scale);
      if (!this.battleMode || !session.save.battle) {
        const map = getMap(session.save);
        camera.setBounds(0, 0, map.width * 16, map.height * 16).centerOn(this.target.x, this.target.y - 8);
        return;
      }
      camera.removeBounds().centerOn(FIELD_SCREEN.width / 2, FIELD_SCREEN.height / 2);
      this.battleStage = this.add.graphics().setDepth(8000);
      mountBattleBackdrop(this, this.battleStage, session.save.battle.id, getMap(session.save).ambience === 'harbor');
      this.battleSprites = (['ally', 'enemy'] as const).map(side => {
        const foot = BATTLE_LANDING[side];
        return this.add.sprite(foot.x, foot.y, 'ms:battle', 0).setOrigin(0.5, 1).setScale(1 / scale).setFlipX(side === 'enemy').setDepth(9000);
      });
    }
    private updateBattle(session: GameSession): void {
      const battle = session.save.battle;
      if (!battle || this.battleSprites.length < 2) return;
      const playback = battle.playback;
      const key = playback ? `${battle.id}:${battle.turn}:${playback.index}` : '';
      if (key !== this.battleBeatKey) {
        this.battleBeatKey = key;
        this.beatElapsedMs = 0;
        this.hitSide = getBattleHitSide(battle);
      }
      // A resumed encounter can be paused before the first animation tick.
      this.drawBattle(session, 0);
    }
    private drawBattle(session: GameSession, delta: number): void {
      const battle = session.save.battle;
      if (!battle || !this.effects) return;
      const beat = getBattleBeat(battle);
      const activeIndex = beat?.activeIndex ?? battle.activeIndex;
      const ally = battle.allies[activeIndex];
      this.beatElapsedMs += Math.min(64, delta);
      this.effects.clear();
      const reduced = session.save.settings.reducedMotion;
      if (beat && battle.playback) {
        const prior = battle.playback.beats[battle.playback.index - 1];
        const secondPulse = prior?.kind === 'impact' && prior.side === beat.side;
        const defense = impactDefense(battle, this.hitSide);
        if (defense) paintBattleEffect(this.effects, defense, this.beatElapsedMs, true, false);
        paintBattleEffect(this.effects, beat, this.beatElapsedMs, reduced, secondPulse);
      }
      for (const [index, sprite] of this.battleSprites.entries()) {
        const side = index === 0 ? 'ally' : 'enemy';
        const fighter = index === 0 ? ally : battle.enemy;
        const hp = index === 0 ? beat?.allyVitality[activeIndex] : beat?.enemyVitality;
        const conscious = (hp ?? fighter.vitality) > 0;
        const cue = fighterMotion(side, beat, this.hitSide);
        const pose = battlePose(side, cue, this.beatElapsedMs, reduced || (!conscious && cue === 'ready'));
        const frame = battleFrame(fighter.speciesId, pose.cel);
        if (Number(sprite.frame.name) !== frame) sprite.setFrame(frame);
        sprite.setPosition(pose.x, pose.y).setAlpha(battleOpacity(conscious, side === this.hitSide, this.beatElapsedMs, reduced));
        if (pose.spark && !beat?.cue) {
          const x = pose.x + (index === 0 ? 10 : -10), y = pose.y - 21;
          this.effects.fillStyle(0xffe6a0).fillRect(x - 3, y, 7, 1).fillRect(x, y - 3, 1, 7);
        }
        if (beat?.side === side) {
          const foot = BATTLE_LANDING[side];
          this.effects.fillStyle(index === 0 ? 0xb1dec6 : 0xe6bb8e, 0.9);
          this.effects.fillRect(foot.x - 6, foot.y + 1, 12, 1);
        }
      }
    }
    update(time: number, delta: number): void {
      const session = latest;
      if (!session || !this.ready || disposed || paused || !this.tavian || !this.effects || !this.decorations) return;
      const reduced = session.save.settings.reducedMotion;
      const map = getMap(session.save);
      const progress = reduced ? 1 : Math.min(1, Math.max(0, time - this.moveStart) / WALK_STEP_MS);
      this.tavian.setPosition(Math.round(this.from.x + (this.target.x - this.from.x) * progress), Math.round(this.from.y + (this.target.y - this.from.y) * progress));
      const walking = progress < 1 && (this.from.x !== this.target.x || this.from.y !== this.target.y);
      this.tavian.setFrame(DIRECTION_FRAME[session.save.player.facing] + (walking ? 1 + Math.floor(progress * 2) : 0)).setDepth(this.tavian.y + 1);
      const lift = walking ? strideLift(progress) : 0;
      this.tavian.setDisplayOrigin(8, 16 + lift);
      this.playerShadow?.setVisible(this.tavian.visible).setPosition(this.tavian.x + 1, this.tavian.y - 2).setScale(lift ? 0.8 : 1, 1).setDepth(this.tavian.y - 0.5);
      this.companionShadow?.setVisible(Boolean(this.companion?.visible));
      if (!this.battleMode) this.cameras.main.centerOn(this.tavian.x, this.tavian.y - 8);
      if (this.companion?.visible) {
        const x = Math.round(this.companionFrom.x + (this.companionTarget.x - this.companionFrom.x) * progress), y = Math.round(this.companionFrom.y + (this.companionTarget.y - this.companionFrom.y) * progress);
        const species = CREATURES.indexOf(session.save.party[0].speciesId);
        const frame = species * 8 + CREATURE_DIRECTION[this.companionFacing] + (walking ? Math.floor(progress * 2) : 0);
        this.companion.setPosition(x, y).setDepth(y).setFrame(frame);
        this.companionShadow?.setPosition(x, y - 2).setDepth(y - 0.5);
      }
      this.decorations.clear();
      if (this.battleMode) {
        this.drawBattle(session, delta);
        return;
      }
      this.effects.clear();
      const view = this.cameras.main.worldView;
      paintEnvironmentMotion(this.decorations, map, view, time, {
        pageFound: session.save.questFlags.page_found === true,
        gateOpened: session.save.questFlags.gate_opened === true,
        sluiceOpen: session.save.questFlags.sluice_open === true,
        riftSealed: session.save.rifts['port-marche'] === 'sealed', reducedMotion: reduced, paused,
      });
      if (this.fieldStep && !reduced) paintFootfall(this.decorations, this.fieldStep, time - this.moveStart);
      paintCastShadow(this.decorations, map.id, this.tavian.x, this.tavian.y);
      if (this.companion?.visible) paintCastShadow(this.decorations, map.id, this.companion.x, this.companion.y);
      const stop = options.walkDestination?.();
      if (stop) {
        const x = stop.x * 16 + 3, y = stop.y * 16 + 10;
        this.decorations.lineStyle(1, 0xf1d098, 0.9);
        this.decorations.strokeRect(x, y, 10, 3);
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
      const approach = session.dialogue?.approach;
      if (!approach) this.approachKey = '';
      for (const o of this.objects) {
        if (approach && o.data.id === approach.actor) {
          const key = approach.actor + ':' + approach.steps.length;
          if (this.approachKey !== key) { this.approachKey = key; this.approachElapsed = 0; }
          this.approachElapsed += delta;
          const progress = reduced ? 1 : Math.min(1, this.approachElapsed / WALK_STEP_MS);
          const direction = approach.steps[0], step = DELTAS[direction];
          const x = Math.round((o.data.x + step.x * progress) * 16) + 8;
          const y = Math.round((o.data.y + step.y * progress) * 16) + 16;
          const row = PEOPLE.indexOf(personArt(o.data.id, o.data.sprite) as typeof PEOPLE[number]);
          o.sprite.setPosition(x, y).setDepth(y).setFrame(row * 15 + DIRECTION_FRAME[direction] + (progress < .5 ? 1 : 2));
          o.shadow?.setPosition(x, y - 1).setDepth(y - .5);
        }
        if (o.shadow && o.sprite.x >= view.left - 16 && o.sprite.x <= view.right + 16 &&
            o.sprite.y >= view.top - 16 && o.sprite.y <= view.bottom + 24) {
          paintCastShadow(this.decorations, map.id, o.sprite.x, o.sprite.y);
        }
        if (o.data.id === this.nearbyTarget) {
          const area = paintedHits[o.data.id];
          const x = o.data.x * 16 + (area ? Math.round(area[0] + area[2] / 2) : 8);
          const top = area ? o.data.y * 16 + area[1] : o.sprite.y - o.sprite.height;
          const y = Math.max(Math.round(view.top) + 3, top - 5);
          this.effects.fillStyle(0x263638, 1).fillTriangle(x - 4, y, x + 4, y, x, y + 5);
          this.effects.fillStyle(0xf0cc81, 1).fillTriangle(x - 2, y + 1, x + 2, y + 1, x, y + 3);
        }
        const sensed = o.data.id === 'sense-eddy' ? session.save.questFlags.current_eddy : session.save.questFlags.current_channel;
        if (o.data.kind === 'sense' && !sensed && session.save.party.length > 0) {
          this.effects.lineStyle(1, 0x9FD6B1, 0.7);
          const radius = reduced ? 9 : 6 + Math.floor(time / 180) % 5;
          this.effects.strokeEllipse(o.data.x * 16 + 8, o.data.y * 16 + 10, radius * 2, radius);
        }
        if (o.data.id !== this.nearbyTarget && ['clue', 'pickup', 'crystal'].includes(o.data.kind)) {
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
    type: Phaser.CANVAS, parent, width: FIELD_SCREEN.width, height: FIELD_SCREEN.height, backgroundColor: '#102224',
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
