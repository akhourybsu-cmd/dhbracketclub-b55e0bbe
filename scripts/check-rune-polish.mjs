// One local command: production UI, isolated data, finite animations and no live writes.
// node scripts/check-rune-polish.mjs
// Set RUNE_QA_URL to reuse a preview, RUNE_POLISH_FULL=1 for the broad viewport sweep,
// or pass --visuals-only to rerun queue and monster checks after menu/reward checks passed.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { installRuneFixture } from "./rune-fixture.mjs";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output =
  process.env.RUNE_QA_OUTPUT || (await mkdtemp(join(tmpdir(), "rune-polish-")));
await mkdir(output, { recursive: true });
const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8096";
const visualsOnly = process.argv.includes("--visuals-only");
const report = {
  visualsOnly,
  checks: [],
  errors: [],
  runtimeErrors: [],
  artifacts: output,
  fixtures:
    "Browser-local identity, rewards and account data; production components and controls.",
};
let server, browser, page, serverExit, serverLog;
let serverReady = Boolean(process.env.RUNE_QA_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function cleanupServer() {
  if (server && server.exitCode === null && !server.killed)
    server.kill("SIGTERM");
  serverLog?.end();
}
async function stop(code) {
  await browser?.close().catch(() => {});
  cleanupServer();
  process.exit(code);
}
process.once("SIGINT", () => {
  void stop(130);
});
process.once("SIGTERM", () => {
  void stop(143);
});
console.log("Polish artifacts:", output);

async function start() {
  if (!process.env.RUNE_QA_URL) {
    serverLog = createWriteStream(join(output, "vite.log"));
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "8096",
        "--strictPort",
      ],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) serverReady = true;
    });
    server.stdout.pipe(serverLog);
    server.stderr.pipe(serverLog);
    server.on("exit", (code) => {
      serverExit = code;
    });
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverExit !== undefined)
      throw Error(`Preview exited with ${serverExit}; inspect vite.log`);
    try {
      if (serverReady && (await fetch(`${base}/scripts/fixtures/rune.html`)).ok)
        break;
    } catch {
      /* Startup is bounded. */
    }
    if (attempt === 99) throw Error("Preview did not start within 20 seconds");
    await sleep(200);
  }
  browser = await chromium.launch({
    executablePath: process.env.RUNE_QA_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
}
async function setup(width, height, motion = "no-preference") {
  const p = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    reducedMotion: motion,
  });
  p.setDefaultTimeout(12_000);
  p.on("pageerror", (error) => report.runtimeErrors.push(error.message));
  await installRuneFixture(p);
  return p;
}
async function go(p, route, extra = {}) {
  await p.goto(
    `${base}/scripts/fixtures/rune.html?${new URLSearchParams({ route, scenario: "archive", theme: "dark", ...extra })}`,
    { waitUntil: "networkidle" },
  );
  await p.waitForFunction(() => window.runeQa && window.runeQueryClient);
  await expect(p.locator(".rd-mode main")).toBeVisible();
  await settle(p);
}
async function settle(p) {
  await p.waitForFunction(
    () =>
      window.runeQueryClient?.isFetching() === 0 &&
      window.runeQueryClient?.isMutating() === 0,
  );
  await p.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await p.waitForFunction(
    () =>
      [...document.querySelectorAll(".rd-mode, .rd-dialog-theme")].every(
        (root) =>
          root
            .getAnimations({ subtree: true })
            .every(
              (a) =>
                a.playState !== "running" ||
                a.effect?.getTiming().iterations === Infinity,
            ),
      ),
    undefined,
    { timeout: 2500 },
  );
}
async function fit(p, label, selector = ".rd-mode main") {
  await settle(p);
  const issues = await p.locator(selector).evaluate((root) => {
    const errors = [],
      tolerance = 2;
    if (
      document.documentElement.scrollWidth > innerWidth + tolerance ||
      document.documentElement.scrollHeight > innerHeight + tolerance
    )
      errors.push("page scrolls beyond viewport");
    for (const node of root.querySelectorAll(
      "button,a,input,select,[role=tab]",
    )) {
      if (
        !(node instanceof HTMLElement) ||
        !node.getClientRects().length ||
        node.closest("[hidden],[aria-hidden=true]")
      )
        continue;
      const style = getComputedStyle(node),
        rect = node.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none") continue;
      const name = (
        node.getAttribute("aria-label") ||
        node.innerText ||
        node.tagName
      )
        .trim()
        .slice(0, 85);
      if (rect.width < 43.5 || rect.height < 43.5)
        errors.push(
          `${name}: target ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`,
        );
      if (
        rect.left < -tolerance ||
        rect.top < -tolerance ||
        rect.right > innerWidth + tolerance ||
        rect.bottom > innerHeight + tolerance
      )
        errors.push(`${name}: outside viewport`);
      for (
        let ancestor = node.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const s = getComputedStyle(ancestor),
          a = ancestor.getBoundingClientRect();
        if (
          /(hidden|clip|scroll|auto)/.test(s.overflowY) &&
          (rect.top < a.top - tolerance || rect.bottom > a.bottom + tolerance)
        ) {
          errors.push(`${name}: vertically clipped by ${ancestor.className}`);
          break;
        }
        if (
          /(hidden|clip|scroll|auto)/.test(s.overflowX) &&
          (rect.left < a.left - tolerance || rect.right > a.right + tolerance)
        ) {
          errors.push(`${name}: horizontally clipped by ${ancestor.className}`);
          break;
        }
      }
    }
    for (const node of [
      root,
      ...root.querySelectorAll(
        ".rd-screen,.rd-dialog-body,.rd-reward-gallery,.rd-reward-spotlight",
      ),
    ]) {
      const s = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(s.overflowY) &&
        node.scrollHeight > node.clientHeight + tolerance
      )
        errors.push(`${node.className}: internal vertical scroller`);
      if (
        /(auto|scroll)/.test(s.overflowX) &&
        node.scrollWidth > node.clientWidth + tolerance
      )
        errors.push(`${node.className}: internal horizontal scroller`);
    }
    return [...new Set(errors)];
  });
  report.checks.push({ label, ok: issues.length === 0, issues });
  if (issues.length) {
    await p.screenshot({
      path: join(output, `${label.replace(/[^\w-]+/g, "-")}-failure.png`),
    });
    assert.deepEqual(issues, [], label);
  }
}
async function shot(p, name) {
  await p.screenshot({ path: join(output, `${name}.png`) });
}
async function next(pager) {
  const before = Number(await pager.getAttribute("data-page"));
  await pager.getByRole("button", { name: /^Next / }).click();
  await expect(pager).toHaveAttribute("data-page", String(before + 1));
}
async function revealCard(p, target) {
  if (await target.isVisible()) return;
  const pager = p.getByRole("navigation", {
    name: "Relics pages",
    exact: true,
  });
  while (await pager.getByRole("button", { name: /^Previous / }).isEnabled())
    await pager.getByRole("button", { name: /^Previous / }).click();
  const count = Number(await pager.getAttribute("data-page-count"));
  for (let i = 0; i < count; i++) {
    if (await target.isVisible()) return;
    if (i + 1 < count) await next(pager);
  }
  throw Error("Requested relic cannot be reached through pages");
}
async function centeredReward(p, title, label) {
  const dialog = p.getByRole("dialog", { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await fit(p, `${label}-reward`, ".rd-reward-dialog");
  const rect = await dialog.boundingBox(),
    viewport = p.viewportSize();
  assert.ok(
    Math.abs(rect.x + rect.width / 2 - viewport.width / 2) <= 3,
    "Reward is horizontally centered",
  );
  assert.ok(
    Math.abs(rect.y + rect.height / 2 - viewport.height / 2) <= 4,
    "Reward is vertically centered",
  );
  await expect(dialog.getByRole("button", { name: /^Continue/ })).toBeFocused();
  await shot(p, `${label}-reward`);
  return dialog;
}
async function acquisitionChecks(p, label) {
  await go(p, "/rune-delve/shop");
  // A concrete unowned tier-one item, reached by visible pagination.
  const chosen = p.getByRole("button", { name: /^Keysight\./ });
  await revealCard(p, chosen);
  const prior = await p.evaluate(
    () => window.runeQa.tables.rune_delve_wallet[0].shards,
  );
  await chosen.click();
  let dialog = await centeredReward(p, "A new power is yours", label);
  await expect(dialog).toContainText("Keysight");
  const earned = await p.evaluate(() => ({
    wallet: window.runeQa.tables.rune_delve_wallet[0].shards,
    owned: window.runeQa.tables.rune_delve_relic_unlocks.filter(
      (r) => r.relic_id === "keysight",
    ),
  }));
  assert.equal(earned.owned.length, 1);
  assert.ok(earned.wallet < prior);
  await dialog.getByRole("button", { name: /^Continue/ }).click();
  await expect(dialog).toBeHidden();
  await chosen.click();
  const upgrade = p
    .getByRole("dialog")
    .filter({ has: p.getByRole("button", { name: /^Upgrade to R2/ }) });
  await expect(upgrade).toBeVisible();
  await fit(p, `${label}-upgrade`, ".rd-paged-dialog");
  await upgrade.getByRole("button", { name: /^Upgrade to R2/ }).click();
  dialog = await centeredReward(p, "Forged stronger", `${label}-rank`);
  await expect(dialog).toContainText("R2");
  assert.equal(
    await p.evaluate(
      () =>
        window.runeQa.tables.rune_delve_relic_unlocks.find(
          (r) => r.relic_id === "keysight",
        ).rank,
    ),
    2,
  );
  await dialog.getByRole("button", { name: /^Continue/ }).click();
  await expect(dialog).toBeHidden();

  await go(p, "/rune-delve/quests");
  const before = await p.evaluate(
    () => window.runeQa.tables.rune_delve_wallet[0].shards,
  );
  await p.getByRole("button", { name: /^Claim \+/ }).click();
  dialog = await centeredReward(p, "Quest complete", `${label}-quest`);
  const pager = dialog.getByRole("navigation", {
    name: "Acquired rewards pages",
    exact: true,
  });
  const count = Number(await pager.getAttribute("data-page-count"));
  assert.ok(
    Number.isInteger(count) && count >= 2 && count <= 8,
    "Finite quest currency/progression reward pages",
  );
  const confirmed = await p.evaluate(async () => {
    const { MASTERY_TIERS } =
      await import("/src/lib/runedelve/classMastery.ts");
    const track = window.runeQa.tables.rune_delve_class_progress.find(
      (row) => row.user_id === "member" && row.class === "warrior",
    );
    return {
      level: track.level,
      title: track.cosmetic_title,
      slots: window.runeQa.tables.rune_delve_wallet[0].slots_unlocked,
      masteries: MASTERY_TIERS.warrior
        .filter((m) => m.unlockLevel <= track.level)
        .map((m) => m.name),
    };
  });
  const seen = [];
  for (let index = 0; index < count; index++) {
    const spotlight = dialog.locator(".rd-reward-spotlight");
    const kind = await spotlight.getAttribute("data-kind"),
      heading = spotlight.getByRole("heading", { level: 3 });
    assert.ok(
      ["shards", "xp", "level", "title", "mastery", "slot"].includes(kind),
      `Supported confirmed quest reward kind: ${kind}`,
    );
    if (kind === "shards") await expect(heading).toHaveText("+25 Rune Shards");
    if (kind === "xp") await expect(heading).toHaveText("+20 Class XP");
    if (kind === "level")
      await expect(heading).toHaveText(`Level ${confirmed.level}`);
    if (kind === "title") await expect(heading).toHaveText(confirmed.title);
    if (kind === "mastery")
      assert.ok(
        confirmed.masteries.includes(await heading.innerText()),
        "Revealed mastery is actually earned",
      );
    if (kind === "slot")
      assert.equal(confirmed.slots, 3, "Revealed slot is actually unlocked");
    seen.push(kind);
    await fit(p, `${label}-quest-page${index + 1}`, ".rd-reward-dialog");
    if (kind === "shards" || kind === "xp")
      await shot(p, `${label}-quest-${kind}`);
    if (index + 1 < count) await next(pager);
  }
  assert.equal(
    seen.filter((kind) => kind === "shards").length,
    1,
    "Exactly one shard award page",
  );
  assert.equal(
    seen.filter((kind) => kind === "xp").length,
    1,
    "Exactly one XP award page",
  );
  await dialog.getByRole("button", { name: /^Continue/ }).click();
  await expect(dialog).toBeHidden();
  assert.equal(
    await p.evaluate(() => window.runeQa.tables.rune_delve_wallet[0].shards),
    before + 25,
  );
  await expect(
    p.getByText("Reward claimed · Resets next period", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await p.evaluate(
      () =>
        window.runeQa.rpcs.filter((r) => r.name === "rune_delve_claim_quest")
          .length,
    ),
    1,
  );
  report.checks.push({ label: `${label}-confirmed-acquisitions`, ok: true });
}
async function queueCheck(p) {
  await go(p, "/rune-delve");
  await p.evaluate(async () => {
    const ReactModule = await import("/node_modules/.vite/deps/react.js"),
      DOM = await import("/node_modules/.vite/deps/react-dom_client.js");
    const React = ReactModule.default ?? ReactModule;
    const createRoot = DOM.createRoot ?? DOM.default?.createRoot;
    if (
      typeof createRoot !== "function" ||
      typeof React.createElement !== "function"
    )
      throw new Error(
        "The optimized React/ReactDOM browser exports are unavailable",
      );
    const { RuneRewardProvider } =
      await import("/src/components/runedelve/RuneRewardReveal.tsx");
    const { useRuneRewardReveal } =
      await import("/src/hooks/useRuneRewardReveal.ts");
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;z-index:70;top:64px;left:16px;min-height:44px";
    document.querySelector(".rd-mode").append(host);
    function Trigger() {
      const { reveal } = useRuneRewardReveal();
      return React.createElement(
        "button",
        {
          onClick: () => {
            const a = {
              id: "polish-queue-a",
              title: "First queued reward",
              items: [
                { kind: "shards", label: "Rune Shards", amount: 5 },
                { kind: "xp", label: "Class XP", amount: 3 },
              ],
            };
            reveal(a);
            reveal(a);
            reveal({
              id: "polish-queue-b",
              title: "Second queued reward",
              items: [{ kind: "title", label: "QA title" }],
            });
          },
        },
        "Queue fixture rewards",
      );
    }
    const root = createRoot(host);
    root.render(
      React.createElement(
        RuneRewardProvider,
        null,
        React.createElement(Trigger),
      ),
    );
    window.__runePolishCleanup = () => {
      root.unmount();
      host.remove();
    };
  });
  await p
    .getByRole("button", { name: "Queue fixture rewards", exact: true })
    .click();
  let dialog = await centeredReward(p, "First queued reward", "queued");
  await expect(dialog).toContainText("1 more reward");
  await next(
    dialog.getByRole("navigation", {
      name: "Acquired rewards pages",
      exact: true,
    }),
  );
  await expect(dialog).toContainText("Class XP");
  await dialog.getByRole("button", { name: /^Continue/ }).click();
  dialog = p.getByRole("dialog", { name: "Second queued reward", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^Continue/ }).click();
  await expect(dialog).toBeHidden();
  await p
    .getByRole("button", { name: "Queue fixture rewards", exact: true })
    .click();
  await expect(p.locator(".rd-reward-dialog")).toHaveCount(0);
  await p.evaluate(() => window.__runePolishCleanup());
  report.checks.push({
    label: "queue-deduplicates-and-acknowledges",
    ok: true,
  });
}
async function monsterCheck(p) {
  await go(p, "/rune-delve/bestiary");
  await p.getByRole("button", { name: "Cave Bat", exact: true }).click();
  const detail = p.getByRole("dialog").last();
  await expect(detail).toBeVisible();
  await expect(
    detail.locator('[data-monster-portrait="cave_bat"]'),
  ).toBeVisible();
  await fit(p, "bestiary-inspection", ".rd-codex-detail");
  await p.keyboard.press("Escape");
  await go(p, "/rune-delve/play/1");
  for (let i = 0; i < 12; i++) {
    const dialog = p.getByRole("dialog").last();
    if (!(await dialog.isVisible())) break;
    const button = dialog
      .getByRole("button", {
        name: /^(Ready to delve|Begin Level \d+|Face the Boss|◇ Steady Path|Choose Standard Path)/,
      })
      .first();
    if (!(await button.isVisible())) break;
    await button.click();
  }
  const portrait = p.locator(".rd-enemy-portrait").first();
  const id = await portrait
    .locator("[data-monster-portrait]")
    .getAttribute("data-monster-portrait");
  assert.notEqual(id, "unknown");
  await portrait.click();
  const inspection = p.getByRole("dialog").last();
  await expect(
    inspection.locator(`[role=img][data-monster-portrait="${id}"]`),
  ).toBeVisible();
  for (const [width, height] of [
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    await p.setViewportSize({ width, height });
    await settle(p);
    await fit(p, `battle-inspection-${width}x${height}`, ".rd-paged-dialog");
    const art = await inspection
      .locator(".rd-dialog-inspection-art")
      .boundingBox();
    const stats = await inspection.locator(".rd-dialog-stats").boundingBox();
    const pager = await inspection
      .getByRole("navigation", { name: "Enemy inspection pages", exact: true })
      .boundingBox();
    assert.ok(
      art && stats && pager,
      "Inspection art, stats and controls are rendered",
    );
    assert.ok(
      art.y + art.height <= stats.y + 1,
      "Monster artwork leaves space for readable stats",
    );
    assert.ok(
      stats.y + stats.height <= pager.y + 1,
      "Monster stats never overlap page controls",
    );
    await shot(p, `battle-inspection-${width}x${height}`);
  }
  await inspection
    .getByRole("button", { name: "Back to battle", exact: true })
    .click();
  await go(p, "/rune-delve");
  await p.setViewportSize({ width: 1280, height: 1120 });
  const portraits = await p.evaluate(async () => {
    const ReactModule = await import("/node_modules/.vite/deps/react.js"),
      DOM = await import("/node_modules/.vite/deps/react-dom_client.js");
    const React = ReactModule.default ?? ReactModule;
    const createRoot = DOM.createRoot ?? DOM.default?.createRoot;
    if (
      typeof createRoot !== "function" ||
      typeof React.createElement !== "function"
    )
      throw new Error(
        "The optimized React/ReactDOM browser exports are unavailable",
      );
    const { RuneEnemyArt } =
      await import("/src/components/runedelve/RuneArtwork.tsx");
    const { MONSTER_PORTRAITS } =
      await import("/src/lib/runedelve/monsterPortraits.ts");
    const atlases = [...new Set(MONSTER_PORTRAITS.map((p) => p.atlas))];
    const sizes = await Promise.all(
      atlases.map(async (path) => {
        const image = new Image();
        image.src = path;
        await image.decode();
        return { path, width: image.naturalWidth, height: image.naturalHeight };
      }),
    );
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:#081217;padding:16px;color:#f3e7c6;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;box-sizing:border-box";
    document.body.append(host);
    const root = createRoot(host);
    root.render(
      React.createElement(
        React.Fragment,
        null,
        ...MONSTER_PORTRAITS.map((p) =>
          React.createElement(
            "figure",
            {
              key: p.id,
              style: {
                margin: 0,
                display: "grid",
                gridTemplateRows: "1fr 28px",
                minHeight: 0,
              },
            },
            React.createElement(
              "div",
              {
                style: {
                  minHeight: 0,
                  aspectRatio: "1",
                  justifySelf: "center",
                  width: 112,
                },
              },
              React.createElement(RuneEnemyArt, {
                archetypeId: p.id,
                name: p.name,
              }),
            ),
            React.createElement(
              "figcaption",
              {
                style: {
                  font: "11px sans-serif",
                  textAlign: "center",
                  lineHeight: "13px",
                },
              },
              p.name,
            ),
          ),
        ),
      ),
    );
    window.__runePolishCleanup = () => {
      root.unmount();
      host.remove();
    };
    return {
      sizes,
      count: MONSTER_PORTRAITS.length,
      cells: new Set(MONSTER_PORTRAITS.map((p) => `${p.atlas}:${p.cell}`)).size,
    };
  });
  assert.equal(portraits.count, 64);
  assert.equal(portraits.cells, 64);
  assert.equal(portraits.sizes.length, 4);
  for (const image of portraits.sizes) {
    assert.ok(image.width >= 1024);
    assert.equal(image.width, image.height);
  }
  await p.waitForFunction(
    () =>
      document.querySelectorAll("figure [data-monster-portrait]").length === 64,
  );
  await shot(p, "monster-gallery-64");
  await p.evaluate(() => window.__runePolishCleanup());
  report.checks.push({
    label: "all64-monster-cells-load-and-inspect",
    ok: true,
    ...portraits,
  });
}
async function broadViewport() {
  if (process.env.RUNE_POLISH_FULL !== "1") return;
  const child = spawn(process.execPath, ["scripts/check-rune-viewport.mjs"], {
    cwd,
    env: {
      ...process.env,
      RUNE_QA_URL: base,
      VIEWPORT: "320x568,390x844,844x390",
      RUNE_QA_OUTPUT: join(output, "viewport"),
    },
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  assert.equal(code, 0, "Broad viewport sweep passes");
}
try {
  await start();
  const routes = [
    "",
    "/hero",
    "/armory",
    "/shop",
    "/levels",
    "/quests",
    "/bestiary",
    "/leaderboard",
    "/history",
    "/daily",
    "/expedition",
  ];
  for (const [width, height] of visualsOnly
    ? []
    : [
        [320, 568],
        [390, 844],
        [844, 390],
      ]) {
    const label = `${width}x${height}`;
    page = await setup(width, height);
    for (const route of routes) {
      await go(page, `/rune-delve${route}`);
      await fit(page, `${label}-${route || "sanctum"}`);
    }
    await go(page, "/rune-delve/hero");
    const tabs = page.getByRole("tablist", { name: "Hero view", exact: true });
    await tabs.getByRole("tab", { name: "Profile", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      tabs.getByRole("tab", { name: "Build", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await fit(page, `${label}-build`);
    await shot(page, `${label}-build`);
    await page.keyboard.press("End");
    await expect(
      tabs.getByRole("tab", { name: "Legacy", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await fit(page, `${label}-legacy`);
    await go(page, "/rune-delve/shop");
    const pager = page.getByRole("navigation", {
      name: "Relics pages",
      exact: true,
    });
    await next(pager);
    const motion = await page
      .locator(".rd-motion-collection > *")
      .first()
      .evaluate((e) => ({
        name: getComputedStyle(e).animationName,
        duration: getComputedStyle(e).animationDuration,
      }));
    assert.ok(motion.name.includes("rd-card-deal"));
    await expect(pager.locator(".rd-pager-progress > i")).toHaveCount(1);
    await fit(page, `${label}-forge-page2`);
    await acquisitionChecks(page, label);
    await page.close();
    page = null;
    console.log("PASS menus and confirmed rewards", label);
  }
  page = await setup(390, 844, "reduce");
  if (!visualsOnly) {
    await go(page, "/rune-delve/shop");
    const reduced = await page
      .locator(".rd-motion-collection > *")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName);
    assert.equal(reduced, "none", "Reduced motion removes menu deal animation");
    await acquisitionChecks(page, "reduced-motion");
  }
  await queueCheck(page);
  await monsterCheck(page);
  await page.close();
  page = null;
  await broadViewport();
  assert.deepEqual(
    report.runtimeErrors,
    [],
    "No uncaught production UI errors",
  );
  report.ok = true;
  console.log("PASS Rune Delve polish", report.checks.length, "checks");
} catch (error) {
  report.ok = false;
  report.errors.push(error.stack || String(error));
  if (page)
    await page
      .screenshot({ path: join(output, "failure.png") })
      .catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  cleanupServer();
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("Report:", join(output, "report.json"));
}
