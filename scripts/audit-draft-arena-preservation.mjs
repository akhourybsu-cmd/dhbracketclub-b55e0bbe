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
const projectorPath = 'src/pages/DraftKioskPage.tsx';
const initialsModule = '@/lib/draft/presentation';

function isInitialsImport(node) {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== initialsModule) return false;
  const clause = node.importClause;
  const bindings = clause?.namedBindings;
  if (!clause || clause.isTypeOnly || clause.name || !bindings || !ts.isNamedImports(bindings) || bindings.elements.length !== 1 || node.attributes) return false;
  const imported = bindings.elements[0];
  return !imported.isTypeOnly && !imported.propertyName && imported.name.text === 'draftInitials';
}

/** Only the top-level avatar formatter may delegate to the shared formatter. */
function isInitialsDelegation(node) {
  if (!node?.body || node.body.statements.length !== 1) return false;
  const statement = node.body.statements[0];
  if (!ts.isReturnStatement(statement) || !statement.expression || !ts.isCallExpression(statement.expression)) return false;
  const call = statement.expression;
  return ts.isIdentifier(call.expression) && call.expression.text === 'draftInitials'
    && !call.questionDotToken && !call.typeArguments?.length && call.arguments.length === 1
    && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === 'name';
}

function normalizedProjector(file) {
  const transformed = ts.transform(file, [(context) => (root) => {
    function visit(node) {
      if (isInitialsImport(node)) return undefined;
      if (node.parent === file && ts.isFunctionDeclaration(node) && node.name?.text === 'initials') {
        return ts.factory.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name,
          node.typeParameters, node.parameters, node.type, ts.factory.createBlock([], true));
      }
      return ts.visitEachChild(node, visit, context);
    }
    return ts.visitNode(root, visit);
  }]);
  const normalized = printer.printFile(transformed.transformed[0]);
  transformed.dispose();
  return normalized;
}

function permitsProjectorInitialsPresentation(original, current) {
  const before = ts.createSourceFile(projectorPath, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const after = ts.createSourceFile(projectorPath, current, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (before.parseDiagnostics.length || after.parseDiagnostics.length) return false;
  const beforeHelpers = before.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'initials');
  const afterHelpers = after.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'initials');
  const afterImports = after.statements.filter(isInitialsImport);
  if (beforeHelpers.length !== 1 || afterHelpers.length !== 1 || afterImports.length !== 1 || !isInitialsDelegation(afterHelpers[0])) return false;
  // Replacing only the formatter's body and its single exact named import must
  // leave the entire remaining projector AST identical, including its JSX.
  return normalizedProjector(before) === normalizedProjector(after);
}

const presentationExceptions = [];
const files = protectedFiles.map(path => {
  const original = readBase(path);
  const current = readFileSync(`${cwd}/${path}`, 'utf8');
  const byteUnchanged = hash(original) === hash(current);
  const permittedInitialsChange = !byteUnchanged && path === projectorPath && permitsProjectorInitialsPresentation(original, current);
  if (permittedInitialsChange) presentationExceptions.push({
    name: 'projectorInitialsFormatting',
    path,
    helper: 'initials',
    delegation: 'return draftInitials(name);',
    namedImport: `draftInitials from ${initialsModule}`,
    remainingProjectorAstUnchanged: true,
  });
  return { path, byteUnchanged, protectedCoreUnchanged: byteUnchanged || permittedInitialsChange };
});
console.log(JSON.stringify({ base, checkedDeclarations: report.length, declarationsMissingInBase: report.filter(r => !r.foundInBase), changedDeclarations: report.filter(r => !r.unchanged), protectedFiles: files, presentationExceptions }, null, 2));

if (report.some(item => !item.foundInBase || !item.unchanged) || files.some(item => !item.protectedCoreUnchanged)) process.exitCode = 1;
