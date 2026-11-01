import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { APP_NAV_SECTIONS, getRouteTitle, isGameShellRoute, navPathForRoute } from '@/lib/appNavigation';
import { getShowdownGame } from '@/lib/showdown/registry';

const root = resolve(__dirname, '../..');
function modulePath(from: string, specifier: string) {
  const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2))
    : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  return [base, ...['.ts', '.tsx', '.js', '.jsx', '.json'].map(suffix => base + suffix), resolve(base, 'index.ts'), resolve(base, 'index.tsx')]
    .find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}
function reachableProductionModules() {
  const visited = new Set<string>(), pending = [resolve(root, 'src/App.tsx')];
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    if (!/\.[jt]sx?$/.test(path)) continue;
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const append = (value: string) => { const next = modulePath(path, value); if (next) pending.push(next); };
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) append(node.moduleSpecifier.text);
      if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) append(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) append(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return visited;
}

describe('Showdown production boundaries', () => {
  it('reaches the real Showdown screens without shipping its private content, offline solver or browser transport', () => {
    const graph = reachableProductionModules();
    expect(graph.has(resolve(root, 'src/pages/ShowdownPage.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/pages/ShowdownMatchPage.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/components/showdown/PrismBreakGame.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/components/showdown/afterimage/AfterimageGame.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/components/showdown/cipher/CipherGame.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/pages/CipherCreatePage.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/components/showdown/afterimage/AfterimageGame.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'src/components/showdown/afterimage/AfterimageScene.tsx'))).toBe(true);
    expect(graph.has(resolve(root, 'supabase/seed/prism-break-library.json'))).toBe(false);
    expect(graph.has(resolve(root, 'src/lib/showdown/prism/solver.ts'))).toBe(false);
    expect(graph.has(resolve(root, 'scripts/fixtures/showdown-backend.ts'))).toBe(false);
    expect(graph.has(resolve(root, 'supabase/seed/afterimage-library.json'))).toBe(false);
    expect(graph.has(resolve(root, 'scripts/fixtures/afterimage.tsx'))).toBe(false);
    expect(graph.has(resolve(root, 'scripts/fixtures/cipher.tsx'))).toBe(false);
    expect(graph.has(resolve(root, 'supabase/seed/afterimage-library.json'))).toBe(false);
    expect(graph.has(resolve(root, 'scripts/author-afterimage.mjs'))).toBe(false);
    expect(graph.has(resolve(root, 'scripts/fixtures/afterimage.tsx'))).toBe(false);
  });

  it('uses existing shared navigation and a full game shell for both lobby and matches', () => {
    const destinations = APP_NAV_SECTIONS.flatMap(section => section.items).filter(item => item.path === '/showdown');
    expect(destinations).toHaveLength(1);
    expect(getRouteTitle('/showdown')).toBe('DH Showdown');
    expect(getRouteTitle('/showdown/match-1')).toBe('DH Showdown');
    expect(navPathForRoute('/showdown/match-1')).toBe('/showdown');
    expect(isGameShellRoute('/showdown')).toBe(true);
    expect(isGameShellRoute('/showdown/match-1')).toBe(true);
  });

  it('keeps frozen registered rules explicit and rejects unsupported versions', () => {
    expect(getShowdownGame('prism_break', 1)?.key).toBe('prism_break');
    expect(getShowdownGame('prism_break', 999)).toBeUndefined();
    expect(getShowdownGame('afterimage', 1)?.key).toBe('afterimage');
    expect(getShowdownGame('afterimage', 999)).toBeUndefined();
    expect(getShowdownGame('cipher_duel', 1)?.key).toBe('cipher_duel');
    expect(getShowdownGame('cipher_duel', 999)).toBeUndefined();
    expect(getShowdownGame('afterimage', 1)?.key).toBe('afterimage');
    expect(getShowdownGame('afterimage', 999)).toBeUndefined();
    expect(getShowdownGame('unknown_game')).toBeUndefined();
  });

  it('checks the same local font stack as the production entry point', () => {
    const fonts = (file: string) => [...readFileSync(resolve(root, file), 'utf8').matchAll(/import\s+['"](@fontsource\/[^'"]+)['"]/g)].map(match => match[1]).sort();
    expect(fonts('scripts/fixtures/showdown.tsx')).toEqual(fonts('src/main.tsx'));
    expect(fonts('scripts/fixtures/afterimage.tsx')).toEqual(fonts('src/main.tsx'));
    expect(fonts('scripts/fixtures/cipher.tsx')).toEqual(fonts('src/main.tsx'));
    expect(fonts('scripts/fixtures/afterimage.tsx')).toEqual(fonts('src/main.tsx'));
  });
});
