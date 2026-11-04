import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectPublication, validateRelease, verifyPublication } from './check-draft-mobile-publication.mjs';

const css = '#draft-arena-main{overflow-y:auto}.dl-mobile-owner{display:flex}';
const release = { url: 'https://example.test/', source_sha: 'a'.repeat(40),
  css: { filename: 'DraftArenaLayout-tested.css', sha256: createHash('sha256').update(css).digest('hex') },
  bundles: { DraftArenaLayout: ['draft-arena-main'], DraftBoard: ['dl-mobile-owner-name'], DraftDetailPage: ['da-pick-history-list'] } };
const bodies = { '/': '<script src="/assets/index-current.js" type="module"></script>',
  '/assets/index-current.js': 'const deps=["assets/DraftArenaLayout-good.js","assets/DraftArenaLayout-tested.css","assets/DraftBoard-good.js","assets/DraftDetailPage-good.js"];',
  '/assets/DraftArenaLayout-good.js': 'draft-arena-main', '/assets/DraftArenaLayout-tested.css': css,
  '/assets/DraftBoard-good.js': 'dl-mobile-owner-name', '/assets/DraftDetailPage-good.js': 'da-pick-history-list' };
const transport = (changes = {}) => async (url, options) => {
  assert.equal(url.protocol, 'https:'); assert.equal(url.origin, 'https://example.test');
  assert.ok(url.searchParams.has('__da_publication')); assert.equal(options.redirect, 'manual');
  assert.equal(options.headers['Accept-Encoding'], 'identity'); assert.ok(options.signal);
  const body = Object.hasOwn(changes, url.pathname) ? changes[url.pathname] : bodies[url.pathname];
  return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
};

test('verifies the actually served entry, stylesheet and all three release chunks', async () => {
  const result = await inspectPublication(release, { fetchImpl: transport() });
  assert.equal(result.actual_hashes.css, release.css.sha256);
  assert.equal(result.css_filename, release.css.filename);
  assert.deepEqual(Object.values(result.http), [200, 200, 200, 200, 200, 200]);
  assert.ok(result.js_markers.DraftBoard['dl-mobile-owner-name']);
});

test('rejects changed CSS bytes and an old CSS filename', async () => {
  await assert.rejects(inspectPublication(release, { fetchImpl: transport({ '/assets/DraftArenaLayout-tested.css': 'old' }) }), /CSS bytes differ/);
  await assert.rejects(inspectPublication(release, { fetchImpl: transport({ '/assets/index-current.js': bodies['/assets/index-current.js'].replace('tested.css', 'old.css') }) }), /CSS filename differs/);
});

test('rejects missing new Board markers rather than accepting a mixed or stale release', async () => {
  await assert.rejects(inspectPublication(release, { fetchImpl: transport({ '/assets/DraftBoard-good.js': 'old board' }) }), /DraftBoard is missing release markers/);
});

test('rejects missing selectors and ambiguous served bundle references', async () => {
  const without = { ...release, css_styles: ['.missing-selector'] };
  await assert.rejects(inspectPublication(without, { fetchImpl: transport() }), /missing mobile release selectors/);
  await assert.rejects(inspectPublication(release, { fetchImpl: transport({ '/assets/index-current.js': bodies['/assets/index-current.js'] + '"assets/DraftBoard-older.js"' }) }), /exactly one DraftBoard/);
});

test('never follows a foreign, HTTP, credentialed or redirected asset', async () => {
  for (const src of ['https://foreign.test/index.js', 'http://example.test/index.js', 'https://user:password@example.test/index.js']) {
    await assert.rejects(inspectPublication(release, { fetchImpl: transport({ '/': `<script type="module" src="${src}"></script>` }) }), /HTTPS origin/);
  }
  await assert.rejects(inspectPublication(release, { fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://foreign.test/' } }) }), /HTTP 302/);
});

test('validates metadata and does not treat its Git SHA as observed host identity', async () => {
  for (const change of [{ source_sha: 'short' }, { url: 'http://example.test/' }, { url: 'https://user:password@example.test/' }, { bundles: {} }]) {
    assert.throws(() => validateRelease({ ...release, ...change }));
  }
  const result = await verifyPublication(release, { fetchImpl: transport() });
  assert.equal(result.verified, true); assert.equal(result.source_sha_origin, 'release_metadata');
  assert.equal(result.source_sha_observed_from_server, false);
});

test('retries stale assets within the shared budget and preserves the receipt', async () => {
  let clock = 1000, visits = 0;
  const result = await verifyPublication(release, { budgetMs: 20000, now: () => clock,
    wait: async ms => { clock += ms; }, fetchImpl: async (url, opts) => {
      if (url.pathname === '/') visits++;
      return transport(visits === 1 ? { '/assets/DraftArenaLayout-tested.css': 'old' } : {})(url, opts);
    } });
  assert.equal(result.verified, true); assert.equal(result.attempts.length, 2);
  const failed = await verifyPublication(release, { budgetMs: 1, now: () => clock,
    wait: async ms => { clock += ms; }, fetchImpl: transport({ '/assets/DraftBoard-good.js': 'old' }) });
  assert.equal(failed.verified, false); assert.equal(failed.elapsed_ms, 1);
  assert.match(failed.attempts[0].error, /DraftBoard/);
});

test('rejects oversized public payloads with bounded streaming', async () => {
  await assert.rejects(inspectPublication(release, { fetchImpl: transport({ '/assets/DraftBoard-good.js': 'x'.repeat(8 * 1024 * 1024 + 1) }) }), /8 MiB proof limit/);
});
