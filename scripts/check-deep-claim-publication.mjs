// Read-only public asset proof. The release SHA is association metadata, not a
// claim that the web server exposes its Git revision. No credentials or writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_MS = 240_000, REQUEST_MS = 20_000, DELAY_MS = 10_000;
const SHA256 = /^[a-f\d]{64}$/i;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateRelease(value) {
  assert.ok(object(value), 'Release metadata must be an object.');
  const url = new URL(value.url);
  assert.ok(url.protocol === 'https:' && !url.username && !url.password, 'Release URL must be HTTPS without credentials.');
  assert.match(value.source_sha ?? '', /^[a-f\d]{40}$/i, 'source_sha must be a full Git SHA supplied by release metadata.');
  assert.ok(object(value.css) && /^DeepClaimPage-[\w-]+\.css$/.test(value.css.filename), 'css.filename must identify the expected Deep Claim CSS bundle.');
  assert.match(value.css.sha256 ?? '', SHA256, 'css.sha256 must be a SHA256 hash.');
  for (const name of ['js_markers', 'css_styles']) {
    assert.ok(Array.isArray(value[name]) && value[name].length > 0 && value[name].length <= 64
      && value[name].every(marker => typeof marker === 'string' && marker.length > 0 && marker.length <= 512), `${name} must contain 1–64 nonempty markers.`);
  }
  assert.ok(Array.isArray(value.atlases) && value.atlases.length === 2, 'Exactly two original atlas hashes are required.');
  const paths = new Set();
  for (const atlas of value.atlases) {
    assert.ok(object(atlas) && /^\/deep-claim\/[\w-]+\.png$/.test(atlas.path), 'Atlas paths must identify same-origin Deep Claim PNG files.');
    assert.match(atlas.sha256 ?? '', SHA256, 'Each atlas requires a SHA256 hash.');
    paths.add(atlas.path);
  }
  assert.equal(paths.size, 2, 'Atlas paths must be distinct.');
  return { ...value, url: url.href };
}

function assetUrl(path, base, origin) {
  const url = new URL(/^(?:\.\/)?assets\//.test(path) ? `/${path.replace(/^\.\//, '')}` : path, base);
  assert.ok(url.protocol === 'https:' && url.origin === origin && !url.username && !url.password, 'Public asset URLs must remain on the release HTTPS origin.');
  return url;
}

function gameAsset(entry, entryUrl, extension, origin) {
  const urls = new Set();
  const pattern = /["'`]([^"'`\s]*DeepClaimPage-[\w-]+\.(?:js|css)(?:\?[^"'`\s]*)?)["'`]/g;
  for (const match of entry.matchAll(pattern)) {
    const url = assetUrl(match[1], entryUrl, origin);
    if (url.pathname.endsWith(`.${extension}`)) urls.add(url.href);
  }
  assert.equal(urls.size, 1, `Expected exactly one served Deep Claim ${extension} bundle in the public entry.`);
  return new URL([...urls][0]);
}

/** One complete attempt; injected fetch is used only by offline verification. */
export async function inspectPublication(release, { fetchImpl = fetch, deadline = Date.now() + BUDGET_MS, now = Date.now } = {}) {
  release = validateRelease(release);
  const origin = new URL(release.url).origin;
  const evidence = { urls: { public: release.url }, http: {}, actual_hashes: { atlases: {} }, js_markers: {}, css_styles: {} };
  async function get(url, label) {
    const remaining = deadline - now();
    assert.ok(remaining > 0, 'Publication proof time budget exhausted.');
    const request = new URL(url);
    request.searchParams.set('__dc_publication', `${release.source_sha}-${now()}`);
    const response = await fetchImpl(request, {
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'Accept-Encoding': 'identity', 'User-Agent': 'DH-Club-publication-verification' },
      signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_MS, remaining))),
      redirect: 'error',
    });
    evidence.urls[label] = response.url || request.href;
    evidence.http[label] = response.status;
    assert.equal(response.status, 200, `Public ${label} returned HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length <= 16 * 1024 * 1024, `Public ${label} exceeds the verification size limit.`);
    return bytes;
  }
  try {
    const html = (await get(release.url, 'html')).toString('utf8');
    const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map(match => match[0]);
    const moduleTag = tags.find(tag => /\btype\s*=\s*["']module["']/i.test(tag) && /\bsrc\s*=/i.test(tag));
    const src = moduleTag?.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&');
    assert.ok(src, 'Public HTML has no module entry script.');
    const entryUrl = assetUrl(src, release.url, origin);
    const entry = (await get(entryUrl, 'entry')).toString('utf8');
    const gameUrl = gameAsset(entry, entryUrl, 'js', origin);
    const cssUrl = gameAsset(entry, entryUrl, 'css', origin);
    const cssFilename = cssUrl.pathname.split('/').at(-1);
    evidence.css_filename = cssFilename;
    assert.equal(cssFilename, release.css.filename, 'Served CSS filename differs from the tested release.');
    const game = await get(gameUrl, 'game');
    evidence.actual_hashes.game_js = sha256(game);
    const gameText = game.toString('utf8');
    evidence.js_markers = Object.fromEntries(release.js_markers.map(marker => [marker, gameText.includes(marker)]));
    assert.ok(Object.values(evidence.js_markers).every(Boolean), 'Public game bundle is missing required release markers.');
    const css = await get(cssUrl, 'css');
    evidence.actual_hashes.css = sha256(css);
    assert.equal(evidence.actual_hashes.css, release.css.sha256.toLowerCase(), 'Public CSS bytes differ from the tested CSS hash.');
    const cssText = css.toString('utf8');
    evidence.css_styles = Object.fromEntries(release.css_styles.map(style => [style, cssText.includes(style)]));
    assert.ok(Object.values(evidence.css_styles).every(Boolean), 'Public CSS is missing required styles.');
    for (const atlas of release.atlases) {
      const bytes = await get(assetUrl(atlas.path, release.url, origin), atlas.path);
      evidence.actual_hashes.atlases[atlas.path] = sha256(bytes);
      assert.equal(evidence.actual_hashes.atlases[atlas.path], atlas.sha256.toLowerCase(), `Public atlas ${atlas.path} differs from its frozen hash.`);
    }
    try { evidence.build_version = JSON.parse((await get(new URL('/version.json', release.url), 'version')).toString('utf8')); }
    catch (error) { evidence.build_version_error = error.message; }
    return evidence;
  } catch (error) { error.evidence = evidence; throw error; }
}

export async function verifyPublication(value, { fetchImpl = fetch, budgetMs = BUDGET_MS, delayMs = DELAY_MS, now = Date.now, wait = ms => new Promise(done => setTimeout(done, ms)) } = {}) {
  const release = validateRelease(value), started = now();
  const budget = Math.max(1, Math.min(BUDGET_MS, budgetMs));
  const delay = Math.max(1, Math.min(15_000, delayMs));
  const deadline = started + budget, attempts = [];
  let evidence = {}, verified = false;
  for (let attempt = 1; attempt <= 25 && now() < deadline; attempt++) {
    try {
      evidence = await inspectPublication(release, { fetchImpl, deadline, now });
      attempts.push({ attempt, status: 'verified', checked_at: new Date(now()).toISOString() });
      verified = true; break;
    } catch (error) {
      evidence = error.evidence ?? {};
      attempts.push({ attempt, status: 'failed', checked_at: new Date(now()).toISOString(), error: error.message, evidence });
      const remaining = deadline - now();
      if (attempt === 25 || remaining <= 0) break;
      await wait(Math.min(delay, remaining));
    }
  }
  return { schema_version: 1, status: verified ? 'verified' : 'failed', verified,
    source_sha: release.source_sha, source_sha_origin: 'release_metadata', source_sha_observed_from_server: false,
    started_at: new Date(started).toISOString(), checked_at: new Date(now()).toISOString(), elapsed_ms: now() - started,
    limits: { budget_ms: budget, request_timeout_ms: REQUEST_MS, retry_delay_ms: delay },
    expected: { css: release.css, atlases: release.atlases }, ...evidence, attempts };
}

export async function main() {
  const output = process.env.DEEP_CLAIM_PUBLICATION_OUTPUT || join(tmpdir(), 'deep-claim-publication-artifacts');
  const metadataFile = resolve('docs/deep-claim-release.json');
  await mkdir(output, { recursive: true });
  let receipt;
  try { receipt = await verifyPublication(JSON.parse(await readFile(metadataFile, 'utf8'))); }
  catch (error) { receipt = { schema_version: 1, status: 'configuration_error', verified: false, checked_at: new Date().toISOString(), error: error.message, metadata_file: metadataFile }; }
  await writeFile(join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  console.log(`Publication receipt: ${join(output, 'receipt.json')}`);
  if (!receipt.verified) process.exitCode = 1;
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
