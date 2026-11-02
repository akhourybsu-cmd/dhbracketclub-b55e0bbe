import metadata from './generated/atlas-v1.json';

export interface AuthoredFrame { x: number; y: number; width: number; height: number }
export interface AuthoredAtlasMetadata { version: number; width: number; height: number; sourceHash: string; pngBytes: number; frames: Record<string, AuthoredFrame> }
export type DeepClaimAtlasState = 'idle' | 'loading' | 'ready' | 'failed';
export interface DeepClaimAtlasDiagnostics {
  state: DeepClaimAtlasState; width: number; height: number; spriteCount: number; decodedBytes: number; draws: number;
}
export const DEEP_CLAIM_ATLAS_URL = '/deep-claim/atlas-v1.png';
export const DEEP_CLAIM_ATLAS_METADATA = metadata as AuthoredAtlasMetadata;

/** One bounded, shared decoded image. Loading never blocks controls or the source-art fallback. */
export class DeepClaimAtlas {
  private state: DeepClaimAtlasState = 'idle';
  private image: HTMLImageElement | null = null;
  private pending: Promise<'ready' | 'failed'> | null = null;
  private listeners = new Set<() => void>();
  private draws = 0;
  private readonly metadata: AuthoredAtlasMetadata;
  private readonly url: string;
  private readonly registeredFrameCount: number;
  constructor(private readonly createImage: () => HTMLImageElement = () => new Image(), private readonly timeoutMs = 10_000, configuration?: { metadata: AuthoredAtlasMetadata; url: string }) {
    this.metadata = configuration?.metadata ?? DEEP_CLAIM_ATLAS_METADATA; this.url = configuration?.url ?? DEEP_CLAIM_ATLAS_URL;
    this.registeredFrameCount = Object.keys(this.metadata.frames).length;
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { for (const listener of this.listeners) listener(); }
  getDiagnostics(): DeepClaimAtlasDiagnostics {
    const { width, height } = this.metadata;
    // spriteCount counts registered frame references; identical pixels share a rectangle.
    return { state: this.state, width, height, spriteCount: this.registeredFrameCount, decodedBytes: this.state === 'ready' ? width * height * 4 : 0, draws: this.draws };
  }
  preload(): Promise<'ready' | 'failed'> {
    if (this.state === 'ready' || this.state === 'failed') return Promise.resolve(this.state);
    if (this.pending) return this.pending;
    this.state = 'loading';
    this.pending = new Promise(resolve => {
      let image: HTMLImageElement, settled = false;
      const finish = (state: 'ready' | 'failed') => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (image) { image.onload = null; image.onerror = null; }
        this.image = state === 'ready' ? image : null; this.state = state;
        this.notify(); resolve(state);
      };
      const timer = setTimeout(() => finish('failed'), this.timeoutMs);
      try {
        image = this.createImage(); image.decoding = 'async';
        image.onload = () => {
          if (image.naturalWidth !== this.metadata.width || image.naturalHeight !== this.metadata.height) { finish('failed'); return; }
          const decode = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
          void decode.then(() => finish('ready'), () => finish('failed'));
        };
        image.onerror = () => finish('failed');
        image.src = this.url;
      } catch { finish('failed'); }
    });
    this.notify();
    return this.pending;
  }
  draw(context: CanvasRenderingContext2D, key: string, x: number, y: number, width?: number, height?: number): boolean {
    if (this.state !== 'ready' || !this.image) return false;
    const frame = this.metadata.frames[key];
    if (!frame || ![x, y, width ?? frame.width, height ?? frame.height].every(Number.isFinite) || (width ?? frame.width) <= 0 || (height ?? frame.height) <= 0) return false;
    try {
      context.drawImage(this.image, frame.x, frame.y, frame.width, frame.height, x, y, width ?? frame.width, height ?? frame.height);
      this.draws = Math.min(Number.MAX_SAFE_INTEGER, this.draws + 1); return true;
    } catch {
      this.image = null; this.state = 'failed'; this.notify(); return false;
    }
  }
}

const atlas = new DeepClaimAtlas();
export const preloadDeepClaimAtlas = () => atlas.preload();
export const subscribeDeepClaimAtlas = (listener: () => void) => atlas.subscribe(listener);
export const getDeepClaimAtlasDiagnostics = () => atlas.getDiagnostics();
export const drawAuthoredSprite = (context: CanvasRenderingContext2D, key: string, x: number, y: number, width?: number, height?: number) => atlas.draw(context, key, x, y, width, height);
