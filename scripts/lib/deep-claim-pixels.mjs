/** Shared original dependency-free offline pixel compiler; the released v1 compiler remains archived unchanged. */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const colors = new Map();
function rgba(color) {
  if (colors.has(color)) return colors.get(color);
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(color)) throw new Error(`Unsupported source color ${color}`);
  const value = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16)); value.push(color.length === 9 ? Number.parseInt(color.slice(7, 9), 16) : 255);
  colors.set(color, value); return value;
}
export class PixelSurface {
  constructor(width, height) { this.width = width; this.height = height; this.pixels = new Uint8Array(width * height * 4); this.fillStyle = '#000000'; this.globalAlpha = 1; this.matrix = [1, 1, 0, 0]; this.stack = []; }
  save() { this.stack.push([this.matrix.slice(), this.fillStyle, this.globalAlpha]); }
  restore() { const previous = this.stack.pop(); if (!previous) throw new Error('Unbalanced painter restore.'); [this.matrix, this.fillStyle, this.globalAlpha] = previous; }
  translate(x, y) { this.matrix[2] += this.matrix[0] * x; this.matrix[3] += this.matrix[1] * y; }
  scale(x, y) { this.matrix[0] *= x; this.matrix[1] *= y; }
  fillRect(x, y, width, height) {
    const [sx, sy, tx, ty] = this.matrix, [red, green, blue, alpha] = rgba(this.fillStyle), opacity = alpha / 255 * this.globalAlpha;
    const left = Math.max(0, Math.round(Math.min(x * sx + tx, (x + width) * sx + tx))), right = Math.min(this.width, Math.round(Math.max(x * sx + tx, (x + width) * sx + tx)));
    const top = Math.max(0, Math.round(Math.min(y * sy + ty, (y + height) * sy + ty))), bottom = Math.min(this.height, Math.round(Math.max(y * sy + ty, (y + height) * sy + ty)));
    for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
      const offset = (py * this.width + px) * 4, existing = this.pixels[offset + 3] / 255, mixed = opacity + existing * (1 - opacity);
      for (const [channel, value] of [red, green, blue].entries()) this.pixels[offset + channel] = mixed ? Math.round((value * opacity + this.pixels[offset + channel] * existing * (1 - opacity)) / mixed) : 0;
      this.pixels[offset + 3] = Math.round(mixed * 255);
    }
  }
}


export function compileAtlas(frames, pack) {
// Identical authored frames share a rectangle. No gameplay/coordinate seed participates.
const unique = new Map(), aliases = new Map();
for (const frame of frames.values()) {
  const hash = `${frame.width}:${frame.height}:${createHash('sha256').update(frame.pixels).digest('hex')}`;
  if (!unique.has(hash)) unique.set(hash, frame);
  aliases.set(frame.key, unique.get(hash));
}
const atlasWidth = pack.specifications.atlas_width, padding = pack.specifications.padding_pixels;
let shelfX = padding, shelfY = padding, shelfHeight = 0;
for (const frame of [...unique.values()].sort((a, b) => b.height - a.height || b.width - a.width || a.key.localeCompare(b.key, 'en'))) {
  if (shelfX + frame.width + padding > atlasWidth) { shelfX = padding; shelfY += shelfHeight + padding * 2; shelfHeight = 0; }
  frame.x = shelfX; frame.y = shelfY; shelfX += frame.width + padding * 2; shelfHeight = Math.max(shelfHeight, frame.height);
}
const atlasHeight = Math.ceil((shelfY + shelfHeight + padding) / 32) * 32;
if (atlasHeight > pack.specifications.maximum_atlas_height) throw new Error(`Atlas exceeded its ${pack.specifications.maximum_atlas_height}px memory budget: ${atlasHeight}`);
const atlasPixels = new Uint8Array(atlasWidth * atlasHeight * 4);
for (const frame of unique.values()) for (let y = 0; y < frame.height; y++) atlasPixels.set(frame.pixels.subarray(y * frame.width * 4, (y + 1) * frame.width * 4), ((frame.y + y) * atlasWidth + frame.x) * 4);
const crcTable = Array.from({ length: 256 }, (_, entry) => { let value = entry; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
function pngChunk(name, payload) {
  const type = Buffer.from(name), body = Buffer.concat([type, payload]); let crc = 0xffffffff;
  for (const value of body) crc = crcTable[(crc ^ value) & 255] ^ crc >>> 8;
  const header = Buffer.alloc(4), footer = Buffer.alloc(4); header.writeUInt32BE(payload.length); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, footer]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(atlasWidth, 0); ihdr.writeUInt32BE(atlasHeight, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((atlasWidth * 4 + 1) * atlasHeight);
for (let y = 0; y < atlasHeight; y++) raw.set(atlasPixels.subarray(y * atlasWidth * 4, (y + 1) * atlasWidth * 4), y * (atlasWidth * 4 + 1) + 1);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);

return {png, width:atlasWidth, height:atlasHeight, uniqueSprites:unique.size, frames:Object.fromEntries([...aliases].sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,frame])=>[key,{x:frame.x,y:frame.y,width:frame.width,height:frame.height}]))};
}
