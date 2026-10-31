// Representative production visual layers with isolated transport. No live writes.
// node scripts/check-app-visuals.mjs [--smoke] [--routes=home,compete,chat,...]
// Owns Vite8099 unless APP_VISUAL_QA_URL selects an existing local preview.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { installHomeFixture } from "./dh-home-fixture.mjs";
import { installDropFixture } from "./drop-fixture.mjs";
import { installChatFixture } from "./chat-fixture.mjs";
import { installRuneFixture } from "./rune-fixture.mjs";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output =
  process.env.APP_VISUAL_QA_OUTPUT ||
  (await mkdtemp(join(tmpdir(), "app-visuals-")));
await mkdir(output, { recursive: true });
const base = process.env.APP_VISUAL_QA_URL || "http://127.0.0.1:8099";
const smoke = process.argv.includes("--smoke");
const selected = process.argv
  .find((arg) => arg.startsWith("--routes="))
  ?.slice(9)
  .split(",");
const report = {
  checks: [],
  screens: [],
  findings: [],
  errors: [],
  runtimeErrors: [],
  assetFailures: [],
  artifacts: output,
  scope:
    "Representative production screens and shared visual layers, using isolated data and identity. Not exhaustive verification of every admin/detail route or live data state.",
};
let server, serverLog, browser, serverExit;
let serverReady = Boolean(process.env.APP_VISUAL_QA_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function record(label, detail = {}) {
  report.checks.push({ label, ok: true, ...detail });
  console.log("PASS", label);
}
async function cleanup() {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, sleep(1500)]);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill("SIGKILL");
      await Promise.race([exited, sleep(1000)]);
    }
  }
  server?.stdout?.unpipe(serverLog);
  server?.stderr?.unpipe(serverLog);
  serverLog?.end();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void cleanup().finally(() => process.exit(130)));
async function start() {
  console.log("App visual artifacts:", output);
  if (!process.env.APP_VISUAL_QA_URL) {
    serverLog = createWriteStream(join(output, "vite.log"));
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "8099",
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
  for (let attempt = 0; attempt < 120; attempt++) {
    if (serverExit !== undefined)
      throw Error("Owned Vite exited " + serverExit);
    try {
      if (
        serverReady &&
        (await fetch(base + "/scripts/fixtures/app-visuals.html")).ok
      )
        break;
    } catch {
      /* bounded startup */
    }
    if (attempt === 119)
      throw Error("Owned Vite did not start; inspect vite.log");
    await sleep(200);
  }
  browser = await chromium.launch({
    executablePath: process.env.APP_VISUAL_QA_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
}

const appSource = await readFile(join(cwd, "src/App.tsx"), "utf8");
const routePatterns = [
  ...new Set(
    [...appSource.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)].map(
      (match) => match[1],
    ),
  ),
];
const routeRegexes = routePatterns
  .filter((path) => path !== "*")
  .map(
    (path) =>
      new RegExp(
        "^" +
          path
            .split("/")
            .map((piece) =>
              piece.startsWith(":")
                ? "[^/]+"
                : piece === "*"
                  ? ".*"
                  : piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            )
            .join("/") +
          "/?$",
      ),
  );
const knownRoute = (path) => routeRegexes.some((pattern) => pattern.test(path));
report.productionRoutePatterns = routePatterns;

async function installCombined(page) {
  await installDropFixture(page);
  const stub = (path, body) =>
    page.route("**/" + path + "*", (route) =>
      route.fulfill({ contentType: "text/javascript", body }),
    );
  await stub(
    "src/contexts/AuthContext.tsx",
    `const anonymous=new URLSearchParams(location.search).get('anonymous')==='1';export const useAuth=()=>({user:anonymous?null:{id:'member',user_metadata:{display_name:'Alex'}},signOut:async()=>{}});`,
  );
  await stub(
    "src/hooks/useClubAssets.ts",
    `import {NAV_ASSET_SLUGS} from '/src/types/assets.ts';const slugs=[...new Set(Object.values(NAV_ASSET_SLUGS))];const assets=slugs.map((slug,i)=>({id:slug,sort_order:i,enabled:true,visible_to_members:true,asset:{id:slug,slug,name:slug}}));export const useClubAssets=()=>({installedAssets:assets,allAssets:assets,loading:false,isInstalled:s=>slugs.includes(s),isVisible:s=>slugs.includes(s),filterNavPaths:p=>p});`,
  );
  await stub(
    "src/hooks/useWorkoutLog.ts",
    `export const useWorkoutLog=()=>({clubWeekPoints:0,activeSession:null});`,
  );
  await stub(
    "src/hooks/useLockbox.ts",
    `export const useCurrentDay=()=>({data:null});export const useMyLock=()=>({data:null});export const useDayLocks=()=>({data:[]});`,
  );
  await stub(
    "src/integrations/supabase/client.ts",
    `import {supabase as base} from '/scripts/fixtures/drop-backend.ts';export const supabase={...base,auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};`,
  );
}

const cases = [
  { id: "home", route: "/dashboard", fixture: "home", matrix: true },
  {
    id: "compete",
    route: "/compete",
    fixture: "combined",
    matrix: true,
    ready: ".page-header-title",
  },
  {
    id: "club",
    route: "/club",
    fixture: "combined",
    matrix: true,
    ready: 'a[href="/feats"]',
  },
  {
    id: "drop",
    route: "/finds",
    fixture: "drop",
    matrix: true,
    ready: "[data-drop-id]",
  },
  { id: "chat", route: "/chat", fixture: "chat", matrix: true },
  { id: "score", route: "/feats", fixture: "home", matrix: true },
  {
    id: "rune",
    route: "/rune-delve",
    fixture: "rune",
    matrix: true,
    ready: '[data-testid="puzzle-home"]',
  },
  {
    id: "nexus",
    route: "/nexus",
    fixture: "nexus",
    matrix: true,
    ready: ".nc-title-screen",
  },
  {
    id: "journey",
    route: "/rune-delve/journey",
    fixture: "rune",
    ready: '[data-testid="puzzle-journey"]',
  },
  {
    id: "rune-guide",
    route: "/rune-delve/guide",
    fixture: "rune",
    ready: ".rd-puzzle-guide",
  },
  {
    id: "rune-archive",
    route: "/rune-delve/legacy",
    fixture: "rune",
    ready: '[data-testid="rune-home"], [data-testid="rune-forge"]',
  },
  {
    id: "rune-chamber",
    route: "/rune-delve/chamber/ember-01",
    fixture: "rune",
    ready: '[data-testid="puzzle-play"]',
  },
  {
    id: "rune-bestiary",
    route: "/rune-delve/bestiary",
    fixture: "rune",
    ready: '[data-testid="rune-bestiary"]',
  },
  {
    id: "rune-error",
    route: "/rune-delve/chamber/unavailable-room",
    fixture: "rune",
    ready: ".rp-data",
  },
  {
    id: "rune-archive-error",
    route: "/rune-delve/legacy",
    fixture: "rune",
    ready: ".rd-load-error",
    failHero: true,
  },
  {
    id: "shared-dialog",
    route: "/club",
    fixture: "combined",
    ready: "[data-qa-shared-layers]",
    layers: true,
    matrix: true,
  },
  {
    id: "nexus-loadout",
    route: "/nexus/loadout/endless",
    fixture: "nexus",
    ready: ".nc-deployment-screen",
  },
  {
    id: "nexus-lab",
    route: "/nexus/research",
    fixture: "nexus",
    ready: ".nc-lab-screen",
  },
  {
    id: "events",
    route: "/events",
    fixture: "combined",
    ready: ".page-header-title",
  },
  {
    id: "posts",
    route: "/posts",
    fixture: "combined",
    ready: ".page-header-title",
  },
  {
    id: "polls",
    route: "/polls",
    fixture: "combined",
    ready: ".page-header-title",
  },
  {
    id: "rankings",
    route: "/rankings",
    fixture: "combined",
    ready: ".page-header-title",
  },
  {
    id: "lore",
    route: "/lore",
    fixture: "combined",
    ready: ".page-header-title, h1",
  },
  {
    id: "notifications",
    route: "/notifications",
    fixture: "combined",
    ready: "h1",
  },
  {
    id: "landing",
    route: "/",
    fixture: "combined",
    anonymous: true,
    ready: 'a[href="/auth"]',
  },
  {
    id: "auth",
    route: "/auth",
    fixture: "combined",
    anonymous: true,
    ready: "form",
  },
  {
    id: "reset",
    route: "/reset-password",
    fixture: "combined",
    anonymous: true,
    ready: "button",
  },
];

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
async function open(page, item, theme) {
  const install = {
    home: installHomeFixture,
    drop: installDropFixture,
    chat: installChatFixture,
    rune: installRuneFixture,
    nexus: installNexusFixture,
    combined: installCombined,
  }[item.fixture];
  await install(page);
  if (item.failHero)
    await page.route("**/src/integrations/supabase/client.ts*", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `import {supabase as base} from '/scripts/fixtures/rune-backend.ts';export const supabase={...base,from(table){if(table!=='rune_delve_heroes')return base.from(table);const q={select:()=>q,eq:()=>q,maybeSingle:()=>q,then:(resolve,reject)=>Promise.resolve({data:null,error:{message:'Isolated archived hero read failed'}}).then(resolve,reject)};return q;}};`,
      }),
    );
  const fixture = {
    home: "dh-home",
    combined: "app-visuals",
    drop: "drop",
    chat: "chat",
    rune: "rune",
    nexus: "nexus-core",
  }[item.fixture];
  const query = new URLSearchParams({ theme, route: item.route });
  if (item.anonymous) query.set("anonymous", "1");
  if (item.layers) query.set("layers", "1");
  if (item.id === "journey") query.set("puzzleCompleted", "18");
  await page.goto(`${base}/scripts/fixtures/${fixture}.html?${query}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (item.fixture === "home") {
    await expect(
      page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
    ).toBeVisible();
    if (item.route === "/feats") {
      await page.locator('a[href="/feats"]').first().click();
      await expect(
        page.getByRole("heading", { name: "DH SCORE", exact: true }),
      ).toBeVisible();
    }
  } else if (item.fixture === "chat") {
    await expect(
      page.getByRole("heading", { name: "Chat", exact: true }),
    ).toBeVisible();
    if (page.viewportSize().width < 1024)
      await page.getByRole("button", { name: /^general/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
  } else await expect(page.locator(item.ready).first()).toBeVisible();
  if (item.fixture === "nexus")
    await page.evaluate((theme) => {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
    }, theme);
  await page.waitForFunction(
    () =>
      !document.querySelector('[aria-busy="true"]') &&
      (!window.appVisualQueryClient ||
        !window.appVisualQueryClient.isFetching()) &&
      (!window.runeQueryClient || !window.runeQueryClient.isFetching()),
    null,
    { timeout: 20_000 },
  );
  await settle(page);
}

async function inspect(page, label) {
  const result = await page.evaluate(() => {
    const visible = (node) => {
      const style = getComputedStyle(node),
        rect = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        !node.closest('[aria-hidden="true"]')
      );
    };
    const brokenImages = [...document.images]
      .filter(
        (image) => visible(image) && image.complete && !image.naturalWidth,
      )
      .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt }));
    const clipped = [],
      smallTargets = [];
    for (const node of document.querySelectorAll(
      'button,a,input,textarea,select,[role="tab"]',
    )) {
      if (!visible(node)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight) continue;
      const name =
        node.getAttribute("aria-label") ||
        node.textContent.trim().slice(0, 70) ||
        node.tagName;
      if (rect.x < -1 || rect.right > innerWidth + 1)
        clipped.push({ name, x: rect.x, right: rect.right });
      if (rect.width < 43.5 || rect.height < 43.5)
        smallTargets.push({ name, width: rect.width, height: rect.height });
    }
    return {
      horizontalOverflow:
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) >
        innerWidth + 1,
      brokenImages,
      clipped,
      smallTargets,
      links: [...document.querySelectorAll("a[href]")]
        .filter(visible)
        .map((node) => ({
          href: node.getAttribute("href"),
          label:
            node.getAttribute("aria-label") ||
            node.textContent.trim().slice(0, 70),
        })),
      staleBranding:
        /(?:@Lovable|Edit with Lovable|Your App Name|Vite \+ React|test\s+admin)/i.test(
          document.body.innerText,
        ),
    };
  });
  const disconnected = result.links.filter(
    ({ href }) =>
      href?.startsWith("/") &&
      !href.startsWith("//") &&
      !knownRoute(href.split(/[?#]/)[0]),
  );
  if (result.smallTargets.length)
    report.findings.push({
      label,
      kind: "small-visible-targets",
      items: result.smallTargets,
    });
  assert.equal(
    result.horizontalOverflow,
    false,
    label + ": no horizontal overflow",
  );
  assert.deepEqual(
    result.brokenImages,
    [],
    label + ": current visible images decode",
  );
  assert.deepEqual(
    result.clipped,
    [],
    label + ": visible actions stay within viewport",
  );
  assert.deepEqual(
    disconnected,
    [],
    label + ": links resolve to production routes",
  );
  assert.equal(
    result.staleBranding,
    false,
    label + ": no template/test branding",
  );
  record(label + "-visual-and-link-audit", {
    links: result.links.length,
    smallTargets: result.smallTargets.length,
  });
}

async function fits(page, locator, label) {
  await expect(locator).toBeVisible();
  // Measure resting geometry after the actual opening animation and floating
  // position have settled. A zoomed-in frame temporarily shrinks touch targets.
  await locator.evaluate(async (node) => {
    const animations = new Set();
    for (let element = node; element; element = element.parentElement) {
      for (const animation of element.getAnimations()) {
        if (Number.isFinite(animation.effect?.getComputedTiming().endTime))
          animations.add(animation);
      }
    }
    await Promise.all([...animations].map((animation) => animation.finished.catch(() => {})));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(async () => {
    const rect = await locator.boundingBox(), viewport = page.viewportSize();
    return !!rect && rect.x >= -1 && rect.y >= -1 &&
      rect.x + rect.width <= viewport.width + 1 &&
      rect.y + rect.height <= viewport.height + 1;
  }, { message: label + " bounds" }).toBe(true);
}
async function layerChecks(page, width, label) {
  if (width < 1024) {
    const primary = page.locator("[data-mobile-bottom-nav]");
    await fits(page, primary, "Shared mobile destinations");
    await expect(
      primary.getByRole("button", { name: "Chat", exact: true }),
    ).toBeVisible();
    for (const button of await primary.getByRole("button").all()) {
      const rect = await button.boundingBox();
      assert.ok(
        rect.width >= 43.5 && rect.height >= 43.5,
        "Shared destination target",
      );
    }
    const more = primary.getByRole("button", {
      name: "More apps",
      exact: true,
    });
    await more.click();
    const drawer = page.getByRole("dialog", {
      name: "Navigation Menu",
      exact: true,
    });
    await fits(page, drawer, "Navigation drawer");
    await page.screenshot({ path: join(output, label + "-drawer.png") });
    const club = drawer.getByRole("link", { name: "Club", exact: true });
    await club.scrollIntoViewIfNeeded();
    const hit = await club.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return node.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    });
    assert.equal(hit, true, "Drawer link is above underlying layers");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(more).toBeFocused();
    record(label + "-drawer-stacking-and-focus");
  }
  const notifications = page
    .getByRole("button", { name: /^Notifications(?: \(|$)/ })
    .first();
  await notifications.click();
  const popup = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await fits(page, popup, "Notification popover");
  await page.screenshot({ path: join(output, label + "-notifications.png") });
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(notifications).toBeFocused();
  record(label + "-notification-layer-and-focus");
  if (width < 1024) {
    await page.evaluate(() =>
      document.body.scrollTo({ top: 500, behavior: "auto" }),
    );
    await expect(page.locator("header[data-scrolled]")).toHaveAttribute(
      "data-scrolled",
      "true",
    );
    await page.evaluate(() => {
      window.__appVisualScrollCalls = [];
      const original = document.body.scrollTo.bind(document.body);
      document.body.scrollTo = (...args) => {
        window.__appVisualScrollCalls.push(
          typeof args[0] === "object" ? args[0].behavior : null,
        );
        return original(...args);
      };
    });
    await page
      .locator('[data-mobile-bottom-nav] button[aria-current="page"]')
      .click();
    await expect
      .poll(() => page.evaluate(() => document.body.scrollTop))
      .toBe(0);
    await expect(page.locator("header[data-scrolled]")).toHaveAttribute(
      "data-scrolled",
      "false",
    );
    assert.ok(
      await page.evaluate(() => window.__appVisualScrollCalls.includes("auto")),
      "Active tab respects reduced motion and scrolls actual body",
    );
    record(label + "-body-scroll-header-and-active-tab");
  }
}

async function closeTarget(page, dialog, label) {
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await fits(page, close, label + " close");
  const rect = await close.boundingBox();
  assert.ok(rect.width >= 43.5 && rect.height >= 43.5, label + " 44px close");
}
async function longDialog(page, label) {
  const trigger = page.getByRole("button", {
    name: "Open long dialog",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "A longer shared dialog",
    exact: true,
  });
  await fits(page, dialog, "Default long dialog");
  await closeTarget(page, dialog, "Default long dialog");
  const heading = dialog.getByRole("heading", {
    name: "A longer shared dialog",
    exact: true,
  });
  await fits(page, heading, "Long dialog heading remains initially visible");
  await page.screenshot({ path: join(output, label + "-open.png") });
  const complete = dialog.getByRole("button", {
    name: "Complete visual check",
    exact: true,
  });
  await complete.scrollIntoViewIfNeeded();
  await fits(page, complete, "Long dialog final action");
  await complete.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  record(label + "-default-dialog-bounds-scroll-close-and-focus");
}
async function runeLayers(page, item, label) {
  if (item.id === "journey") {
    const chapters = page.getByRole("navigation", {
      name: "Puzzle chapters",
      exact: true,
    });
    const tabs = await chapters.getByRole("button").all();
    assert.equal(tabs.length, 3);
    for (let index = 0; index < tabs.length; index++) {
      await tabs[index].click();
      await expect(page.locator(".rp-room-grid a")).toHaveCount(6);
      await page.screenshot({
        path: join(output, `${label}-chapter-${index + 1}.png`),
      });
      await inspect(page, `${label}-chapter-${index + 1}`);
    }
    record(label + "-all-three-current-puzzle-chapters");
  }
  if (["rune", "rune-chamber"].includes(item.id)) {
    const trigger = page.getByRole("button", {
      name: "Open puzzle guide",
      exact: true,
    });
    await trigger.click();
    const guide = page.getByRole("dialog", {
      name: "The chamber guide",
      exact: true,
    });
    await fits(page, guide, "Puzzle guide");
    await closeTarget(page, guide, "Puzzle guide");
    const player = page.locator('[data-puzzle-player="true"]');
    const before = (await player.count())
      ? await player.getAttribute("data-puzzle-cell")
      : null;
    await page.keyboard.press("ArrowRight");
    if (before !== null)
      assert.equal(
        await page
          .locator('[data-puzzle-player="true"]')
          .getAttribute("data-puzzle-cell"),
        before,
        "Guide intercepts game keyboard input",
      );
    await page.screenshot({ path: join(output, label + "-guide.png") });
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
    await expect(trigger).toBeFocused();
    record(label + "-guide-close-and-focus");
  }
  if (item.id === "rune-chamber") {
    await expect(page.locator("[data-puzzle-cell]")).toHaveCount(36);
    await page
      .getByRole("button", { name: "Puzzle rules", exact: true })
      .click();
    const rules = page.getByRole("dialog", {
      name: "Read the room",
      exact: true,
    });
    await fits(page, rules, "Chamber rules");
    await closeTarget(page, rules, "Chamber rules");
    await page.keyboard.press("Escape");
    await expect(rules).toHaveCount(0);
    record(label + "-current-puzzle-board-and-rules");
  }
  if (item.id === "rune-bestiary") {
    await page
      .locator('[aria-label="Bestiary entries"] button')
      .first()
      .click();
    const detail = page.getByRole("dialog");
    await fits(page, detail, "Archived bestiary detail");
    await closeTarget(page, detail, "Archived bestiary detail");
    await page.screenshot({ path: join(output, label + "-detail.png") });
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    record(label + "-archive-monster-detail-close");
  }
}

async function runCase(item, width, height, theme) {
  const label = `${item.id}-${width}x${height}-${theme}`;
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: width < 1024,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [],
    assets = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().startsWith(base) &&
      response.status() >= 400 &&
      /\.(?:png|webp|svg|jpe?g|woff2?|ico)(?:\?|$)/i.test(response.url())
    )
      assets.push({ url: response.url(), status: response.status() });
  });
  try {
    await open(page, item, theme);
    await page.screenshot({ path: join(output, label + ".png") });
    await inspect(page, label);
    if (item.id === "compete") {
      await expect(
        page
          .locator('.app-main-content a[href="/rune-delve"]')
          .filter({ hasText: "Rune Delve" })
          .first(),
      ).toBeVisible();
      await expect(
        page
          .locator('.app-main-content a[href="/nexus"]')
          .filter({ hasText: "Nexus Defense" })
          .first(),
      ).toBeVisible();
      await layerChecks(page, width, label);
    }
    if (item.id === "shared-dialog") await longDialog(page, label);
    if (item.fixture === "rune") await runeLayers(page, item, label);
    if (
      ["rune", "journey", "nexus", "nexus-loadout", "nexus-lab"].includes(
        item.id,
      )
    )
      await expect(page.locator("[data-mobile-bottom-nav]")).toHaveCount(0);
    assert.deepEqual(errors, [], label + ": no browser exceptions");
    assert.deepEqual(assets, [], label + ": no broken local assets");
    report.screens.push({
      id: item.id,
      route: item.route,
      fixture: item.fixture,
      width,
      height,
      theme,
      ok: true,
    });
  } catch (error) {
    await page
      .screenshot({ path: join(output, label + "-failure.png") })
      .catch(() => {});
    const detail = {
      label,
      route: item.route,
      error: error.stack || String(error),
    };
    report.errors.push(detail);
    console.error("FAIL", label, error.message);
    report.screens.push({
      id: item.id,
      route: item.route,
      fixture: item.fixture,
      width,
      height,
      theme,
      ok: false,
    });
  } finally {
    report.runtimeErrors.push(...errors.map((error) => ({ label, error })));
    report.assetFailures.push(...assets.map((error) => ({ label, ...error })));
    await context.close();
  }
}

try {
  await start();
  const viewports = smoke
    ? [[390, 844]]
    : [
        [320, 568],
        [390, 844],
        [1440, 900],
      ];
  for (const item of cases.filter(
    (item) => !selected || selected.includes(item.id),
  )) {
    const matrix = smoke
      ? [[390, 844, "dark"]]
      : item.matrix
        ? viewports.flatMap(([width, height]) => [
            [width, height, "light"],
            [width, height, "dark"],
          ])
        : [
            [390, 844, "dark"],
            [1440, 900, "light"],
          ];
    for (const [width, height, theme] of matrix)
      await runCase(item, width, height, theme);
  }
  report.summary = {
    routePatternsInventoried: routePatterns.length,
    productionScreenRoutesVisited: new Set(
      report.screens.map((screen) => screen.route),
    ).size,
    screenThemeViewportVisits: report.screens.length,
    passedVisits: report.screens.filter((screen) => screen.ok).length,
    checks: report.checks.length,
    findings: report.findings.length,
    errors: report.errors.length,
  };
  if (
    report.errors.length ||
    report.runtimeErrors.length ||
    report.assetFailures.length
  )
    process.exitCode = 1;
  console.log(JSON.stringify(report.summary));
} catch (error) {
  report.errors.push({ error: error.stack || String(error) });
  process.exitCode = 1;
  console.error(error);
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("Report:", join(output, "report.json"));
  await cleanup();
}
