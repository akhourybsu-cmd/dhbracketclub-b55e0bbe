// Read-only extension of the Arena release proof. Never sends credentials,
// creates a game, invokes AI, or treats metadata as a host-reported Git SHA.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inspectPublication, validateRelease } from './check-draft-mobile-publication.mjs';

export const LINEUP_FUNCTION_BASE = 'https://wnurxuvwljjbwmtoeqnm.supabase.co/functions/v1';
const FUNCTIONS = ['rate-draft', 'resolve-pick-dispute', 'check-draft-pick', 'draft-missed-picks'];
const ASSETS = ['LineupDraftsPage.js', 'CreateLineupDraftPage.js', 'LineupDraftDetailPage.js', 'lineup.css', 'LineupDraftDetailPage.css', 'MakePickSheet.js'];
const BUDGET_MS = 240000, MAX_BYTES = 8 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const errorMessage = error => String(error?.message || error).replace(/(https?:\/\/)[^\s/]*@/g, '$1[redacted]@').slice(0, 600);

export function validateLineupRelease(input) {
  const release = validateRelease(input);
  assert.equal(input.function_base ?? LINEUP_FUNCTION_BASE, LINEUP_FUNCTION_BASE, 'Backend proof must use this project’s fixed function origin.');
  assert.ok(Array.isArray(input.additional_assets), 'Lineup release assets are required.');
  assert.deepEqual(input.additional_assets.map(asset => `${asset.prefix}.${asset.extension}`).sort(), [...ASSETS].sort(), 'Exactly the six Lineup release assets are required.');
  for (const asset of input.additional_assets) {
    assert.ok(Array.isArray(asset.markers) && asset.markers.length > 0 && asset.markers.length <= 32
      && asset.markers.every(marker => typeof marker === 'string' && marker.length > 0 && marker.length <= 256), 'Each Lineup asset needs bounded release markers.');
    if (asset.filename !== undefined) assert.match(asset.filename, new RegExp(`^${asset.prefix}-[\\w-]+\\.${asset.extension}$`), 'Invalid expected Lineup asset filename.');
    if (asset.sha256 !== undefined) assert.match(asset.sha256, /^[a-f\d]{64}$/i, 'Invalid Lineup asset SHA-256.');
    if (asset.extension === 'css') assert.ok(asset.filename && asset.sha256, 'Lineup stylesheets require their tested filename and exact hash.');
  }
  return { ...release, function_base: LINEUP_FUNCTION_BASE };
}

function servedAsset(entry, entryUrl, asset, origin) {
  const pattern = new RegExp('["\'`]((?:[^"\'`\\s]*/)?' + asset.prefix + '-[\\w-]+\\.' + asset.extension + '(?:\\?[^"\'`\\s]*)?)["\'`]', 'g');
  const urls = [...entry.matchAll(pattern)].map(match => {
    const path = match[1], url = new URL(/^(?:\.\/)?assets\//.test(path) ? `/${path.replace(/^\.\//, '')}` : path, entryUrl);
    assert.ok(url.protocol === 'https:' && url.origin === origin && !url.username && !url.password, 'Lineup assets must remain on the release HTTPS origin.');
    assert.match(url.pathname.split('/').at(-1), new RegExp(`^${asset.prefix}-[\\w-]+\\.${asset.extension}$`));
    return url.href;
  });
  const unique = [...new Set(urls)];
  assert.equal(unique.length, 1, `Expected exactly one served ${asset.prefix} ${asset.extension} asset.`);
  return new URL(unique[0]);
}

export async function inspectLineupPublication(input, { fetchImpl = fetch, now = Date.now, deadline = now() + BUDGET_MS } = {}) {
  const release = validateLineupRelease(input), origin = new URL(release.url).origin;
  let evidence = { lineup_assets: {}, backend_functions: {} };
  async function request(url, name, method = 'GET') {
    const remaining = deadline - now();
    assert.ok(remaining > 0, 'Lineup public-content proof exhausted its time budget.');
    const target = new URL(url);
    target.searchParams.set('__da_publication', `${release.source_sha}-${now()}`);
    evidence.urls[name] = target.href;
    const response = await fetchImpl(target, { method, redirect: 'manual', credentials: 'omit',
      signal: AbortSignal.timeout(Math.max(1, Math.min(20000, remaining))),
      headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache', 'Accept-Encoding': 'identity',
        ...(method === 'OPTIONS' ? { Origin: origin, 'Access-Control-Request-Method': 'POST' } : {}) } });
    evidence.http[name] = response.status;
    if (method === 'OPTIONS' || response.status !== 200) await response.body?.cancel();
    assert.equal(response.status, 200, `Public ${name} returned HTTP ${response.status}.`);
    return response;
  }
  async function get(url, name) {
    const response = await request(url, name), reader = response.body?.getReader(), chunks = [];
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
    evidence = { ...await inspectPublication(release, { fetchImpl, now, deadline }), ...evidence };
    // The already verified entry URL is content-addressed by the deployed build.
    const entry = (await get(evidence.urls.entry, 'lineup_entry')).toString('utf8');
    for (const asset of release.additional_assets) {
      const key = `${asset.prefix}.${asset.extension}`, url = servedAsset(entry, evidence.urls.entry, asset, origin);
      const filename = url.pathname.split('/').at(-1);
      const result = evidence.lineup_assets[key] = { filename, url: url.href, markers: {} };
      if (asset.filename) assert.equal(filename, asset.filename, `Served ${key} filename differs from the tested release.`);
      const bytes = await get(url, `lineup:${key}`);
      result.sha256 = hash(bytes);
      if (asset.sha256) assert.equal(result.sha256, asset.sha256, `Served ${key} bytes differ from the tested release.`);
      result.markers = Object.fromEntries(asset.markers.map(marker => [marker, bytes.toString('utf8').includes(marker)]));
      assert.ok(Object.values(result.markers).every(Boolean), `Served ${key} is missing Lineup release markers.`);
    }
    for (const name of FUNCTIONS) {
      const url = `${release.function_base}/${name}`, response = await request(url, `function:${name}`, 'OPTIONS');
      const result = evidence.backend_functions[name] = { url, http: response.status, lineup_rules: response.headers.get('X-DH-Lineup-Rules') };
      assert.equal(result.lineup_rules, 'lineup_v1', `Deployed ${name} does not expose Lineup rules version 1.`);
    }
    return evidence;
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    failure.evidence = { ...evidence, ...failure.evidence };
    throw failure;
  }
}

export async function verifyLineupPublication(input, { fetchImpl = fetch, now = Date.now,
  wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms)), budgetMs = BUDGET_MS } = {}) {
  const release = validateLineupRelease(input), started = now(), budget = Math.max(1, Math.min(BUDGET_MS, Number(budgetMs) || BUDGET_MS));
  const receipt = { schema_version: 1, source_sha: release.source_sha, source_sha_origin: 'release_metadata', source_sha_observed_from_server: false,
    verified: false, started_at: new Date(started).toISOString(), attempts: [] };
  for (let attempt = 1; attempt <= 25 && now() < started + budget; attempt++) {
    try {
      Object.assign(receipt, await inspectLineupPublication(release, { fetchImpl, now, deadline: started + budget }));
      receipt.verified = true; receipt.attempts.push({ attempt, status: 'verified' }); break;
    } catch (error) {
      Object.assign(receipt, error.evidence ?? {});
      receipt.attempts.push({ attempt, status: 'failed', error: errorMessage(error) });
      const remaining = started + budget - now();
      if (remaining <= 0 || attempt === 25) break;
      await wait(Math.min(10000, remaining));
    }
  }
  receipt.status = receipt.verified ? 'verified' : 'failed'; receipt.checked_at = new Date(now()).toISOString(); receipt.elapsed_ms = now() - started;
  return receipt;
}

export async function main() {
  const output = process.env.DRAFT_LINEUP_PUBLICATION_OUTPUT || join(tmpdir(), 'draft-lineup-publication');
  await mkdir(output, { recursive: true });
  let receipt;
  try { receipt = await verifyLineupPublication(JSON.parse(await readFile('docs/draft-lineup-release.json', 'utf8'))); }
  catch (error) { receipt = { schema_version: 1, status: 'configuration_error', verified: false, error: errorMessage(error) }; }
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt, null, 2)); console.log('Publication receipt:', join(output, 'receipt.json'));
  if (!receipt.verified) process.exitCode = 1;
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
