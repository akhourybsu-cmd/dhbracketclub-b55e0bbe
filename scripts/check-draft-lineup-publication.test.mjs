import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectLineupPublication, validateLineupRelease, verifyLineupPublication, LINEUP_FUNCTION_BASE } from './check-draft-lineup-publication.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const css = '#draft-arena-main{overflow-y:auto}.dl-mobile-owner{display:flex}';
const assets = [
  { prefix: 'LineupDraftsPage', extension: 'js', markers: ['Every pick'] },
  { prefix: 'CreateLineupDraftPage', extension: 'js', markers: ['Create lineup'] },
  { prefix: 'LineupDraftDetailPage', extension: 'js', markers: ['My lineup'] },
  { prefix: 'lineup', extension: 'css', filename: 'lineup-tested.css', sha256: hash('.da-lineup{display:block}'), markers: ['.da-lineup'] },
  { prefix: 'LineupDraftDetailPage', extension: 'css', filename: 'LineupDraftDetailPage-tested.css', sha256: hash('.da-lineup-room{display:grid}'), markers: ['.da-lineup-room'] },
  { prefix: 'MakePickSheet', extension: 'js', markers: ['da-pick-dialog-content', 'Your draft pick', 'Submit pick', 'preventScroll'] },
];
const release = { url: 'https://example.test/', source_sha: 'a'.repeat(40), function_base: LINEUP_FUNCTION_BASE,
  css: { filename: 'DraftArenaLayout-tested.css', sha256: hash(css) },
  bundles: { DraftArenaLayout: ['draft-arena-main'], DraftBoard: ['dl-mobile-owner-name'], DraftDetailPage: ['da-pick-history-list'] }, additional_assets: assets };
const bodies = {
  '/': '<script type="module" src="/assets/index-current.js"></script>',
  '/assets/index-current.js': 'const deps=["assets/DraftArenaLayout-good.js","assets/DraftArenaLayout-tested.css","assets/DraftBoard-good.js","assets/DraftDetailPage-good.js",'
    + assets.map(asset => `"assets/${asset.filename ?? `${asset.prefix}-good.${asset.extension}`}"`).join(',') + '];',
  '/assets/DraftArenaLayout-good.js': 'draft-arena-main', '/assets/DraftArenaLayout-tested.css': css,
  '/assets/DraftBoard-good.js': 'dl-mobile-owner-name', '/assets/DraftDetailPage-good.js': 'da-pick-history-list',
  '/assets/LineupDraftsPage-good.js': 'Every pick', '/assets/CreateLineupDraftPage-good.js': 'Create lineup',
  '/assets/LineupDraftDetailPage-good.js': 'My lineup', '/assets/lineup-tested.css': '.da-lineup{display:block}',
  '/assets/LineupDraftDetailPage-tested.css': '.da-lineup-room{display:grid}',
  '/assets/MakePickSheet-good.js': 'da-pick-dialog-content Your draft pick Submit pick preventScroll',
};
function transport({ changed = {}, backendHeader = 'lineup_v1', backendStatus = 200, redirect = false, calls = [] } = {}) {
  return async (url, options) => {
    assert.equal(url.protocol, 'https:'); assert.ok(url.searchParams.has('__da_publication'));
    assert.equal(options.redirect, 'manual'); assert.ok(options.signal);
    assert.ok(!Object.keys(options.headers).some(key => /authorization|cookie/i.test(key)));
    calls.push({ url: url.href, method: options.method ?? 'GET' });
    if (url.origin === new URL(LINEUP_FUNCTION_BASE).origin) {
      assert.equal(options.method, 'OPTIONS'); assert.equal(options.credentials, 'omit'); assert.equal(options.body, undefined);
      assert.equal(options.headers.Origin, 'https://example.test');
      return new Response(null, { status: backendStatus, headers: backendHeader ? { 'X-DH-Lineup-Rules': backendHeader } : {} });
    }
    assert.equal(url.origin, 'https://example.test'); assert.equal(options.method ?? 'GET', 'GET');
    if (redirect && url.pathname.includes('LineupDraftsPage-')) return new Response(null, { status: 302, headers: { location: 'https://foreign.test/bundle.js' } });
    const body = Object.hasOwn(changed, url.pathname) ? changed[url.pathname] : bodies[url.pathname];
    return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
  };
}

test('extends the actual Arena entry proof with six Lineup assets and four credential-free OPTIONS checks', async () => {
  const calls = [], result = await inspectLineupPublication(release, { fetchImpl: transport({ calls }) });
  assert.equal(result.actual_hashes.css, release.css.sha256);
  assert.equal(Object.keys(result.lineup_assets).length, 6); assert.equal(Object.keys(result.backend_functions).length, 4);
  assert.equal(result.lineup_assets['MakePickSheet.js'].markers.preventScroll, true);
  assert.ok(Object.values(result.lineup_assets).every(asset => Object.values(asset.markers).every(Boolean)));
  assert.ok(Object.values(result.backend_functions).every(value => value.http === 200 && value.lineup_rules === 'lineup_v1'));
  assert.equal(Object.keys(result.http).length, 17); assert.ok(Object.values(result.http).every(status => status === 200));
  assert.equal(calls.filter(call => call.method === 'OPTIONS').length, 4);
  const receipt = await verifyLineupPublication(release, { fetchImpl: transport() });
  assert.equal(receipt.verified, true); assert.equal(receipt.source_sha_origin, 'release_metadata'); assert.equal(receipt.source_sha_observed_from_server, false);
});

test('rejects stale Lineup JavaScript and changed stylesheet filenames or bytes', async () => {
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ changed: { '/assets/LineupDraftsPage-good.js': 'Old lobby' } }) }), /missing Lineup release markers/);
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ changed: { '/assets/MakePickSheet-good.js': 'da-pick-dialog-content Your draft pick Submit pick' } }) }), /MakePickSheet\.js is missing Lineup release markers/);
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ changed: { '/assets/lineup-tested.css': 'Old styles' } }) }), /bytes differ/);
  const wrongName = structuredClone(release); wrongName.additional_assets[3].filename = 'lineup-old.css';
  await assert.rejects(inspectLineupPublication(wrongName, { fetchImpl: transport() }), /filename differs/);
});

test('rejects foreign assets, redirects and ambiguous Lineup references without following them', async () => {
  const entry = bodies['/assets/index-current.js'];
  for (const target of ['https://foreign.test/LineupDraftsPage-good.js', 'http://example.test/LineupDraftsPage-good.js', 'https://u:p@example.test/LineupDraftsPage-good.js']) {
    await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ changed: { '/assets/index-current.js': entry.replace('assets/LineupDraftsPage-good.js', target) } }) }), /HTTPS origin/);
  }
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ redirect: true }) }), /HTTP 302/);
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ changed: { '/assets/index-current.js': entry + '"assets/LineupDraftsPage-older.js"' } }) }), /exactly one served/);
});

test('requires all backend markers and the fixed project function origin', async () => {
  for (const header of [null, 'lineup_v0']) await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ backendHeader: header }) }), /Deployed rate-draft/);
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ backendStatus: 401 }) }), /HTTP 401/);
  assert.throws(() => validateLineupRelease({ ...release, function_base: 'https://foreign.test/functions/v1' }), /fixed function origin/);
});

test('validates the exact asset set and requires tested CSS hashes', () => {
  for (const additional_assets of [assets.slice(0, -1), [...assets, assets[0]], assets.map(asset => ({ ...asset, markers: [] }))])
    assert.throws(() => validateLineupRelease({ ...release, additional_assets }));
  const missing = structuredClone(release); delete missing.additional_assets[3].sha256;
  assert.throws(() => validateLineupRelease(missing), /tested filename and exact hash/);
});

test('retries partial deployment inside one budget and never claims stale backend rules are live', async () => {
  let clock = 1000, visits = 0;
  const result = await verifyLineupPublication(release, { now: () => clock, budgetMs: 20000, wait: async ms => { clock += ms; },
    fetchImpl: async (url, options) => { if (url.pathname === '/') visits++; return transport({ backendHeader: visits === 1 ? null : 'lineup_v1' })(url, options); } });
  assert.equal(result.verified, true); assert.equal(result.attempts.length, 2);
  const failed = await verifyLineupPublication(release, { now: () => clock, budgetMs: 1, wait: async ms => { clock += ms; }, fetchImpl: transport({ backendHeader: null }) });
  assert.equal(failed.verified, false); assert.equal(failed.elapsed_ms, 1); assert.match(failed.attempts[0].error, /rate-draft/);
  assert.equal(failed.backend_functions['rate-draft'].lineup_rules, null);
});

test('bounds every additional asset body instead of buffering an oversized response', async () => {
  await assert.rejects(inspectLineupPublication(release, { fetchImpl: transport({ changed: { '/assets/LineupDraftsPage-good.js': 'x'.repeat(8 * 1024 * 1024 + 1) } }) }), /8 MiB proof limit/);
});
