// Repository-owned visual assets and entry-point references. No network calls.
// node scripts/audit-visual-assets.mjs --write  regenerates the checked-in report
// node scripts/audit-visual-assets.mjs --check  verifies report and hard failures
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = resolve(root, "docs/VISUAL_ASSETS.json");
const slash = (value) => value.split(sep).join("/");
const local = (value) => slash(relative(root, value));
const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".json",
  ".html",
  ".webmanifest",
]);
const visualExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".ico",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".mp4",
  ".webm",
  ".mp3",
  ".ogg",
]);
const ownedHosts = new Set(["dryhorse.app", "www.dryhorse.app"]);
const knownPublicEntrypoints = {
  "public/robots.txt": "Crawler entry point; it does not need an app import.",
  "public/placeholder.svg":
    "Retained public compatibility fallback. No current source reference; database/user-authored references are outside this static inventory.",
};
const retiredAssets = [
  {
    path: "src/assets/dh-logo-full.png",
    reason:
      "Unreferenced blue DH BRACKET CLUB identity replaced by the current green DH mark.",
  },
];
const files = new Map();
const references = [];
const remoteVisualSources = [];
const findings = [];

async function walk(directory) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          if (
            ["test", "__tests__", "node_modules", "dist", ".git"].includes(
              entry.name,
            )
          )
            return [];
          return walk(path);
        }
        return entry.isFile() && !/\.(?:test|spec)\.[^.]+$/.test(entry.name)
          ? [path]
          : [];
      }),
  );
  return paths.flat();
}

function stripSuffix(value) {
  return value.split(/[?#]/, 1)[0];
}
function resolveReference(from, value) {
  let path = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!ownedHosts.has(url.hostname)) return null;
      path = url.pathname;
    } catch {
      return null;
    }
  }
  path = stripSuffix(path);
  let base;
  if (path.startsWith("@/")) base = resolve(root, "src", path.slice(2));
  else if (path.startsWith("/src/")) base = resolve(root, path.slice(1));
  else if (path.startsWith("/")) {
    const publicPath = resolve(root, "public", path.slice(1));
    const rootPath = resolve(root, path.slice(1));
    base = existsSync(publicPath)
      ? publicPath
      : existsSync(rootPath)
        ? rootPath
        : publicPath;
  } else if (path.startsWith(".")) base = resolve(dirname(from), path);
  else return null;
  const candidates = extname(base)
    ? [base]
    : [
        base,
        ...[".ts", ".tsx", ".js", ".jsx", ".css", ".json"].map(
          (extension) => base + extension,
        ),
        ...["index.ts", "index.tsx", "index.js"].map((name) =>
          resolve(base, name),
        ),
      ];
  return candidates.find((candidate) => existsSync(candidate)) ?? base;
}
function lineAt(text, position) {
  return text.slice(0, position).split("\n").length;
}
function addReference(from, value, kind, position = 0) {
  if (!value || /^(?:data|blob|mailto|tel|#):/i.test(value)) return;
  const text = files.get(from)?.text ?? "";
  const isVisual = visualExtensions.has(
    extname(stripSuffix(value)).toLowerCase(),
  );
  if (/^https?:\/\//i.test(value) && (isVisual || kind === "social-image")) {
    remoteVisualSources.push({
      source: local(from),
      line: lineAt(text, position),
      value,
      kind,
    });
  }
  const target = resolveReference(from, value);
  if (!target) return;
  const targetPath = local(target);
  if (
    !targetPath.startsWith("public/") &&
    !targetPath.startsWith("src/") &&
    targetPath !== "index.html"
  )
    return;
  references.push({
    source: local(from),
    line: lineAt(text, position),
    target: targetPath,
    kind,
  });
  if (files.has(from)) files.get(from).dependencies.add(target);
  if (
    !existsSync(target) &&
    (isVisual ||
      ["import", "worker", "entry-script", "manifest", "icon"].includes(kind))
  ) {
    findings.push({
      severity: "error",
      code: "missing-local-reference",
      source: local(from),
      line: lineAt(text, position),
      target: targetPath,
    });
  }
}

function inspectScript(path, text) {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : path.endsWith(".json")
        ? ts.ScriptKind.JSON
        : ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        path,
        node.moduleSpecifier.text,
        "import",
        node.moduleSpecifier.getStart(source),
      );
    } else if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    ) {
      addReference(
        path,
        node.arguments[0].text,
        "import",
        node.arguments[0].getStart(source),
      );
    } else if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "URL" &&
      node.arguments?.[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[1]?.getText(source) === "import.meta.url"
    ) {
      addReference(
        path,
        node.arguments[0].text,
        "worker",
        node.arguments[0].getStart(source),
      );
    } else if (ts.isStringLiteralLike(node)) {
      const value = node.text;
      if (
        /^(?:@\/|\.?\.?\/|https?:\/\/)/.test(value) &&
        sourceExtensions.has(extname(stripSuffix(value)))
      ) {
        addReference(path, value, "resource", node.getStart(source));
      } else if (
        /^(?:@\/|\.?\.?\/|https?:\/\/)/.test(value) &&
        visualExtensions.has(extname(stripSuffix(value)).toLowerCase())
      ) {
        addReference(path, value, "visual", node.getStart(source));
      }
    } else if (ts.isTemplateExpression(node)) {
      const value = node.getText(source).slice(1, -1);
      if (
        /^https?:\/\//i.test(value) &&
        visualExtensions.has(extname(stripSuffix(value)).toLowerCase())
      ) {
        remoteVisualSources.push({
          source: local(path),
          line: lineAt(text, node.getStart(source)),
          value,
          kind: "dynamic-provider-image",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
function inspectCss(path, text) {
  for (const match of text.matchAll(
    /(?:url\(\s*["']?([^\s"')]+)["']?\s*\)|@import\s+["']([^"']+)["'])/g,
  )) {
    addReference(path, match[1] || match[2], "css", match.index);
  }
}
function attrs(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [
      match[1].toLowerCase(),
      match[2],
    ]),
  );
}
function inspectHtml(path, text) {
  for (const match of text.matchAll(
    /<(?:link|script|meta|img|source)\b[^>]*>/gi,
  )) {
    const attributes = attrs(match[0]);
    if (attributes.src)
      addReference(
        path,
        attributes.src,
        match[0].startsWith("<script") ? "entry-script" : "visual",
        match.index,
      );
    if (attributes.href)
      addReference(
        path,
        attributes.href,
        attributes.rel === "manifest"
          ? "manifest"
          : /icon/.test(attributes.rel || "")
            ? "icon"
            : "resource",
        match.index,
      );
    if (
      ["og:image", "twitter:image"].includes(
        attributes.property || attributes.name,
      )
    ) {
      addReference(path, attributes.content, "social-image", match.index);
      if (
        /id-preview-.*lovable\.app|\.r2\.dev\/.*lovable\.app/i.test(
          attributes.content ?? "",
        )
      )
        findings.push({
          severity: "error",
          code: "stale-generated-sharing-image",
          source: local(path),
          line: lineAt(text, match.index),
        });
    }
    if (
      (attributes.name || attributes.property) === "twitter:site" &&
      /^@lovable$/i.test(attributes.content ?? "")
    )
      findings.push({
        severity: "error",
        code: "unrelated-template-social-handle",
        source: local(path),
        line: lineAt(text, match.index),
      });
  }
  // Bootstrap URLs such as version.json and the push service worker also need
  // their public resources, but comments and arbitrary route strings do not.
  for (const match of text.matchAll(
    /["'](\/(?:version\.json|sw-push\.js)(?:\?[^"']*)?)["']/g,
  ))
    addReference(path, match[1], "resource", match.index);
}

function dimensions(buffer, path) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const codec = buffer.toString("ascii", 12, 16);
    if (codec === "VP8X")
      return {
        width: buffer.readUIntLE(24, 3) + 1,
        height: buffer.readUIntLE(27, 3) + 1,
      };
    if (codec === "VP8 ")
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    if (codec === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }
  if (path.endsWith(".svg")) {
    const attributes = attrs(
      buffer.toString().match(/<svg\b[^>]*>/)?.[0] || "",
    );
    const width = Number(attributes.width),
      height = Number(attributes.height);
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

const inventoryPaths = [
  ...(await walk(resolve(root, "public"))),
  ...(await walk(resolve(root, "src/assets"))),
].sort();
const sourcePaths = [
  ...new Set([
    ...(await walk(resolve(root, "src"))),
    ...inventoryPaths,
    resolve(root, "index.html"),
  ]),
].filter((path) => sourceExtensions.has(extname(path)));
for (const path of sourcePaths)
  files.set(path, {
    text: await readFile(path, "utf8"),
    dependencies: new Set(),
  });
for (const [path, { text }] of files) {
  if (path.endsWith(".css")) inspectCss(path, text);
  else if (path.endsWith(".html")) inspectHtml(path, text);
  else if (!path.endsWith(".webmanifest")) inspectScript(path, text);
}
const manifestPath = resolve(root, "public/manifest.webmanifest");
const manifest = JSON.parse(files.get(manifestPath).text);
for (const icon of [
  ...(manifest.icons ?? []),
  ...(manifest.shortcuts?.flatMap((shortcut) => shortcut.icons ?? []) ?? []),
]) {
  addReference(manifestPath, icon.src, "icon");
  const path = resolveReference(manifestPath, icon.src);
  if (path && existsSync(path)) {
    const actual = dimensions(await readFile(path), path);
    if (
      actual &&
      !icon.sizes?.split(/\s+/).includes(`${actual.width}x${actual.height}`) &&
      icon.sizes !== "any"
    )
      findings.push({
        severity: "error",
        code: "manifest-icon-size-mismatch",
        source: local(manifestPath),
        target: local(path),
        declared: icon.sizes,
        actual: `${actual.width}x${actual.height}`,
      });
  }
}
const reachable = new Set();
const queue = [resolve(root, "src/main.tsx"), resolve(root, "index.html")];
while (queue.length) {
  const path = queue.pop();
  if (reachable.has(path)) continue;
  reachable.add(path);
  for (const target of files.get(path)?.dependencies ?? []) queue.push(target);
}
const unique = (rows) => [
  ...new Map(rows.map((row) => [JSON.stringify(row), row])).values(),
];
const refs = unique(references).sort(
  (a, b) =>
    a.target.localeCompare(b.target) ||
    a.source.localeCompare(b.source) ||
    a.line - b.line ||
    a.kind.localeCompare(b.kind),
);
const assets = [];
for (const path of inventoryPaths) {
  const value = await readFile(path);
  const name = local(path);
  const usages = refs.filter((ref) => ref.target === name);
  const activeUsages = usages.filter((ref) =>
    reachable.has(resolve(root, ref.source)),
  );
  const imageDimensions = dimensions(value, path);
  const archiveArt = name.startsWith("public/images/rune-delve/");
  assets.push({
    path: name,
    bytes: value.length,
    sha256: createHash("sha256").update(value).digest("hex"),
    ...(imageDimensions ?? {}),
    status: activeUsages.length
      ? archiveArt
        ? "current-and-retained-game-art"
        : "current"
      : usages.length
        ? "referenced-outside-main-entry"
        : knownPublicEntrypoints[name]
          ? "public-compatibility-entry"
          : "unreferenced-review-candidate",
    ...(archiveArt
      ? {
          note: "Rune Delve reuses current artwork and retains its Combat Archive. Age alone is not grounds for removing these assets.",
        }
      : knownPublicEntrypoints[name]
        ? { note: knownPublicEntrypoints[name] }
        : {}),
    references: usages,
  });
}
for (const retired of retiredAssets)
  if (existsSync(resolve(root, retired.path)))
    findings.push({
      severity: "error",
      code: "retired-brand-asset-present",
      target: retired.path,
      reason: retired.reason,
    });
const byHash = new Map();
for (const asset of assets) {
  const group = byHash.get(asset.sha256) ?? [];
  group.push(asset.path);
  byHash.set(asset.sha256, group);
}
const duplicateContent = [...byHash]
  .filter(([, paths]) => paths.length > 1)
  .map(([sha256, paths]) => ({
    sha256,
    paths,
    note: paths.every((path) =>
      /(?:dh-monogram|favicon|pwa-icon-(?:192|512))\.png$/.test(path),
    )
      ? "Intentional current-brand delivery aliases for bundled UI, browser favicon and installed app icon; do not remove an externally consumed URL just to deduplicate bytes."
      : "Review consumers before removing duplicate content.",
  }));
const result = {
  schemaVersion: 1,
  scope:
    "Repository-owned public and bundled assets, production source imports/literal URLs/CSS, index metadata and PWA declarations. No network calls or player data reads.",
  limitations: [
    "Uploaded avatars, club logos, photos, chat attachments and database-authored URLs are runtime content and are not proven present or current by this report.",
    "Dynamic provider images and embeds remain provider-controlled; their source templates are recorded without requesting external services.",
    "Reachability is a conservative module graph including type imports and CSS fallback declarations. A reference is evidence to review, not proof that every CSS declaration paints on screen.",
  ],
  entryPoints: ["src/main.tsx", "index.html"],
  summary: {
    assets: assets.length,
    assetBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
    imageAssets: assets.filter((asset) => "width" in asset).length,
    sourceFilesInspected: files.size,
    reachableFiles: reachable.size,
    localReferences: refs.length,
    missingReferences: unique(findings).filter(
      (finding) => finding.code === "missing-local-reference",
    ).length,
    unreferencedReviewCandidates: assets
      .filter((asset) => asset.status === "unreferenced-review-candidate")
      .map((asset) => asset.path),
    duplicateGroups: duplicateContent.length,
    errors: unique(findings).filter((finding) => finding.severity === "error")
      .length,
  },
  retiredBrandAssets: retiredAssets.map((asset) => ({
    ...asset,
    present: existsSync(resolve(root, asset.path)),
  })),
  findings: unique(findings).sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  ),
  duplicateContent,
  remoteVisualSources: unique(remoteVisualSources).sort(
    (a, b) => a.source.localeCompare(b.source) || a.line - b.line,
  ),
  assets,
};
const serialized = JSON.stringify(result, null, 2) + "\n";
if (process.argv.includes("--write")) await writeFile(reportPath, serialized);
if (process.argv.includes("--check")) {
  const existing = await readFile(reportPath, "utf8").catch(() => "");
  if (existing !== serialized) {
    console.error(
      "Visual asset report is stale. Run node scripts/audit-visual-assets.mjs --write after source changes are frozen.",
    );
    process.exitCode = 1;
  }
}
console.log(JSON.stringify(result.summary));
for (const finding of result.findings) console.log(JSON.stringify(finding));
if (result.summary.errors) process.exitCode = 1;
