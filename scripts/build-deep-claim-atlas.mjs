#!/usr/bin/env node
/** Reproduce the published v1 image from its exact, versioned authoring inputs. */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiler = resolve(root, 'art/deep-claim/v1-source/scripts/build-deep-claim-atlas.mjs');
// Preserve original compiler bytes and relative input names in the provenance
// hash. Only runtime import roots and the two output destinations are redirected.
let source = readFileSync(compiler, 'utf8');
source = source.replaceAll('fileURLToPath(import.meta.url)', JSON.stringify(compiler));
source = source.replaceAll('createRequire(import.meta.url)', `createRequire(${JSON.stringify(pathToFileURL(compiler).href)})`);
source = source.replace("resolve(root, 'public/deep-claim/atlas-v1.png')", JSON.stringify(resolve(root, 'public/deep-claim/atlas-v1.png')));
source = source.replace("resolve(root, 'src/components/deepClaim/renderer/generated/atlas-v1.json')", JSON.stringify(resolve(root, 'src/components/deepClaim/renderer/generated/atlas-v1.json')));
const temporary = mkdtempSync(resolve(tmpdir(), 'deep-claim-v1-'));
try {
  const runner = resolve(temporary, 'compiler.mjs'); writeFileSync(runner, source);
  await import(pathToFileURL(runner).href);
} finally { rmSync(temporary, { recursive: true, force: true }); }
