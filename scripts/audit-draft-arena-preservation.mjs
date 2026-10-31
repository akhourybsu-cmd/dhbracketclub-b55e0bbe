// Compare this visual pass with its gameplay baseline. No database access.
// Usage: node scripts/audit-draft-arena-preservation.mjs [baseline-commit]
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const cwd = process.cwd();
const base = process.argv[2]?.startsWith('--') ? '48b28035795ca3dcf0deac30c13c18c788b515bc' : process.argv[2] ?? '48b28035795ca3dcf0deac30c13c18c788b515bc';
// A read-only execution environment can supply an export of the same git
// objects when spawning Git from Node is unavailable.
const baselineIndex = process.argv.indexOf('--baseline-file');
const baselineFiles = baselineIndex < 0 ? null : JSON.parse(readFileSync(process.argv[baselineIndex + 1], 'utf8'));
const readBase = (path) => baselineFiles ? baselineFiles[path] : execFileSync('git', ['show', `${base}:${path}`], { cwd, encoding: 'utf8' });
const printer = ts.createPrinter({ removeComments: true });
const hash = (s) => createHash('sha256').update(s).digest('hex');
const targets = {
  'src/pages/DraftDetailPage.tsx': [
    'fetchData', 'isCreator', 'isParticipant', 'canManage', 'isLiveDraft',
    'consumedSlots', 'skippedSlots', 'handleSubmitDispute', 'handleResolveDispute',
    'handleDismissDispute', 'handleConfirmReject', 'derivedTurn', 'currentPicker',
    'isMyTurn', 'currentRound', 'currentPickNumber', 'isDraftComplete', 'isInProgress',
    'isSetup', 'picksUntilYou', 'handleStartDraft', 'handleCeremonyReveal',
    'handleCeremonyBegin', 'handleMakePick', 'handleReEnrich', 'handleDelete',
    'handleSaveEdit', 'handleStartEditPick', 'handleCancelEditPick',
    'handleSavePickEdit', 'handleRemovePick',
  ],
  'src/pages/DraftsListPage.tsx': [
    'fetchAllDraftListRows', 'fetchTopics', 'handlePick', 'handleAdvance',
    'handleAdd', 'handleRemove', 'handleSeasonUpdate', 'canSeeCommissioner',
    'filterCounts',
  ],
};
function declarations(source, path, names) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const results = new Map();
  function visit(node) {
    const declaration = ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node);
    if (declaration && node.name && ts.isIdentifier(node.name) && names.includes(node.name.text)) {
      const body = ts.isVariableDeclaration(node) ? node.initializer : node;
      const text = printer.printNode(ts.EmitHint.Unspecified, body, file);
      results.set(node.name.text, [...(results.get(node.name.text) ?? []), hash(text)]);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return results;
}
const report = [];
for (const [path, names] of Object.entries(targets)) {
  const original = declarations(readBase(path), path, names);
  const current = declarations(readFileSync(`${cwd}/${path}`, 'utf8'), path, names);
  for (const name of names) {
    const before = original.get(name);
    const after = current.get(name);
    report.push({ path, name, foundInBase: Boolean(before), unchanged: JSON.stringify(before) === JSON.stringify(after) });
  }
}
const protectedFiles = [
  'src/hooks/useDraftResults.ts', 'src/hooks/useLiveDraft.ts',
  'src/hooks/useDraftSeasons.ts', 'src/lib/draftTurn.ts',
  'src/lib/draft/liveDraft.ts', 'src/lib/draft/judgingRules.ts',
  'src/lib/draft/resultIntegrity.ts', 'src/lib/draft/seasonEligibility.ts',
  'supabase/functions/rate-draft/index.ts', 'supabase/functions/check-draft-pick/index.ts',
  'supabase/functions/resolve-pick-dispute/index.ts',
  'src/pages/DraftKioskPage.tsx', 'src/components/draft/live/KioskDraftReport.tsx',
];
const files = protectedFiles.map(path => {
  const original = readBase(path);
  return { path, unchanged: hash(original) === hash(readFileSync(`${cwd}/${path}`, 'utf8')) };
});
console.log(JSON.stringify({ base, checkedDeclarations: report.length, declarationsMissingInBase: report.filter(r => !r.foundInBase), changedDeclarations: report.filter(r => !r.unchanged), protectedFiles: files }, null, 2));

if (report.some(item => !item.foundInBase || !item.unchanged) || files.some(item => !item.unchanged)) process.exitCode = 1;
