import metadata from './generated/atlas-v2.json';
import { DeepClaimAtlas, type AuthoredAtlasMetadata } from './authoredAtlas';

export const DEEP_CLAIM_ADDON_URL = '/deep-claim/atlas-v2.png';
export const DEEP_CLAIM_ADDON_METADATA = metadata as AuthoredAtlasMetadata;
const addon = new DeepClaimAtlas(undefined, 10_000, { metadata: DEEP_CLAIM_ADDON_METADATA, url: DEEP_CLAIM_ADDON_URL });
export const preloadDeepClaimAddon = () => addon.preload();
export const subscribeDeepClaimAddon = (listener: () => void) => addon.subscribe(listener);
export const getDeepClaimAddonDiagnostics = () => addon.getDiagnostics();
export const drawDeepClaimAddon = (context: CanvasRenderingContext2D, key: string, x: number, y: number, width?: number, height?: number) => addon.draw(context, key, x, y, width, height);
