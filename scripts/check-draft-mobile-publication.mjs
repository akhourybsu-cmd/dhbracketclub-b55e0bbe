// Read-only hosted-content proof. source_sha associates the release metadata;
// hosting does not expose a Git SHA. No credentials, sessions or writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PREFIXES = ['DraftArenaLayout', 'DraftBoard', 'DraftDetailPage'];
const BUDGET_MS = 240000, REQUEST_MS = 20000, DELAY_MS = 10000, MAX_BYTES = 8 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
const markers = value => Array.isArray(value) && value.length > 0 && value.length <= 32
  && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 256);
const message = error => String(error?.message || error).replace(/(https?:\/\/)[^\s/]*@/g, '$1[redacted]@').slice(0, 600);

export function validateRelease(value) {
  const url = new URL(value?.url);
  assert.ok(url.protocol === 'https:' && !url.username && !url.password, 'Release URL must use HTTPS without credentials.');
  assert.match(value.source_sha ?? '', /^[a-f\d]{40}$/i, 'source_sha must be the full release-metadata Git SHA.');
  assert.match(value.css?.filename ?? '', /^DraftArenaLayout-[\w-]+\.css$/, 'Expected the tested DraftArenaLayout CSS filename.');
  assert.match(value.css?.sha256 ?? '', /^[a-f\d]{64}$/i, 'Expected a CSS SHA-256 hash.');
  assert.deepEqual(Object.keys(value.bundles ?? {}).sort(), [...PREFIXES].sort(), 'Exactly the three Draft Arena bundles are required.');
  for (const name of PREFIXES) assert.ok(markers(value.bundles[name]), `${name} requires 1–32 release markers.`);
  const cssStyles = value.css_styles ?? ['#draft-arena-main', '.dl-mobile-owner'];
  assert.ok(markers(cssStyles), 'css_styles requires 1–32 release selectors.');
  return { ...value, url: url.href, css_styles: cssStyles };
}

function assetUrl(path, base, origin) {
  const url = new URL(/^(?:\.\/)?assets\//.test(path) ? `/${path.replace(/^\.\//, '')}` : path, base);
  assert.ok(url.protocol === 'https:' && url.origin === origin && !url.username && !url.password,
    'Served assets must remain on the release HTTPS origin.');
  return url;
}

function findAsset(entry, entryUrl, prefix, extension, origin) {
  const pattern = new RegExp('["\'`]([^"\'`\\s]*' + prefix + '-[\\w-]+\\.' + extension + '(?:\\?[^"\'`\\s]*)?)["\'`]', 'g');
  const found = new Set([...entry.matchAll(pattern)].map(match => assetUrl(match[1], entryUrl, origin).href));
  assert.equal(found.size, 1, `Expected exactly one ${prefix} ${extension} asset in the served entry.`);
  return new URL([...found][0]);
}

export async function inspectPublication(input, { fetchImpl = fetch, now = Date.now, deadline = now() + BUDGET_MS } = {}) {
  const release = validateRelease(input), origin = new URL(release.url).origin;
  const evidence = { urls: { public: release.url }, http: {}, actual_hashes: {}, js_markers: {}, css_styles: {} };
  async function get(url, name) {
    const request = new URL(url), remaining = deadline - now();
    assert.ok(remaining > 0, 'Public-content verification exhausted its time budget.');
    request.searchParams.set('__da_publication', `${release.source_sha}-${now()}`);
    evidence.urls[name] = request.href;
    const response = await fetchImpl(request, { redirect: 'manual',
      signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_MS, remaining))),
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'Accept-Encoding': 'identity' } });
    evidence.http[name] = response.status;
    if (response.status !== 200) await response.body?.cancel();
    assert.equal(response.status, 200, `Public ${name} returned HTTP ${response.status}; use the canonical HTTPS host.`);
    const chunks = [], reader = response.body?.getReader();
    assert.ok(reader, `Public ${name} returned no body.`);
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        assert.ok(size <= MAX_BYTES, `Public ${name} exceeds the 8 MiB proof limit.`);
        chunks.push(Buffer.from(value));
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    return Buffer.concat(chunks);
  }
  try {
    const html = (await get(release.url, 'html')).toString('utf8');
    const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map(match => match[0]);
    const tag = tags.find(item => /\btype\s*=\s*["']module["']/i.test(item) && /\bsrc\s*=/i.test(item));
    const path = tag?.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&');
    assert.ok(path, 'Public HTML has no module entry script.');
    const entryUrl = assetUrl(path, evidence.urls.html, origin);
    const entry = (await get(entryUrl, 'entry')).toString('utf8');
    const cssUrl = findAsset(entry, evidence.urls.entry, 'DraftArenaLayout', 'css', origin);
    evidence.css_filename = cssUrl.pathname.split('/').at(-1);
    assert.equal(evidence.css_filename, release.css.filename, 'Served Arena CSS filename differs from the tested release.');
    const css = await get(cssUrl, 'css');
    evidence.actual_hashes.css = hash(css);
    assert.equal(evidence.actual_hashes.css, release.css.sha256, 'Served Arena CSS bytes differ from the tested release.');
    evidence.css_styles = Object.fromEntries(release.css_styles.map(selector => [selector, css.toString('utf8').includes(selector)]));
    assert.ok(Object.values(evidence.css_styles).every(Boolean), 'The served stylesheet is missing mobile release selectors.');
    for (const name of PREFIXES) {
      const bytes = await get(findAsset(entry, evidence.urls.entry, name, 'js', origin), name);
      evidence.actual_hashes[name] = hash(bytes);
      evidence.js_markers[name] = Object.fromEntries(release.bundles[name].map(marker => [marker, bytes.toString('utf8').includes(marker)]));
      assert.ok(Object.values(evidence.js_markers[name]).every(Boolean), `The served ${name} is missing release markers.`);
    }
    return evidence;
  } catch (error) { error.evidence = evidence; throw error; }
}

export async function verifyPublication(input, { fetchImpl = fetch, now = Date.now,
  wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms)), budgetMs = BUDGET_MS } = {}) {
  const release = validateRelease(input), started = now();
  const budget = Math.max(1, Math.min(BUDGET_MS, Number(budgetMs) || BUDGET_MS));
  const receipt = { schema_version: 1, source_sha: release.source_sha, source_sha_origin: 'release_metadata',
    source_sha_observed_from_server: false, verified: false, started_at: new Date(started).toISOString(), attempts: [] };
  for (let attempt = 1; attempt <= 25; attempt++) {
    try {
      Object.assign(receipt, await inspectPublication(release, { fetchImpl, now, deadline: started + budget }));
      receipt.verified = true;
      receipt.attempts.push({ attempt, status: 'verified' });
      break;
    } catch (error) {
      Object.assign(receipt, error.evidence ?? {});
      receipt.attempts.push({ attempt, status: 'failed', error: message(error) });
      const remaining = started + budget - now();
      if (remaining <= 0 || attempt === 25) break;
      await wait(Math.min(DELAY_MS, remaining));
    }
  }
  receipt.status = receipt.verified ? 'verified' : 'failed';
  receipt.checked_at = new Date(now()).toISOString();
  receipt.elapsed_ms = now() - started;
  return receipt;
}

export async function main() {
  const output = process.env.DRAFT_PUBLICATION_OUTPUT || join(tmpdir(), 'draft-mobile-publication');
  await mkdir(output, { recursive: true });
  let receipt;
  try { receipt = await verifyPublication(JSON.parse(await readFile('docs/draft-arena-release.json', 'utf8'))); }
  catch (error) { receipt = { schema_version: 1, status: 'configuration_error', verified: false, error: message(error) }; }
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2));
  console.log('Publication receipt:', join(output, 'receipt.json'));
  if (!receipt.verified) process.exitCode = 1;
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
