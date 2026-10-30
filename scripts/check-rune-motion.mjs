// Real Rune Delve controls with the isolated browser-local backend.
// RUNE_QA_URL=http://127.0.0.1:8094 node scripts/check-rune-motion.mjs
// Optional: RUNE_QA_OUTPUT=/tmp/rune-motion RUNE_QA_VIDEO=1 VIEWPORT=390x844
// VIEWPORT filters the screenshot matrix; the six lifecycle checks remain at 390×844.
// Frame callbacks below describe this Chromium run; they are not a device FPS guarantee.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRuneFixture } from "./rune-fixture.mjs";

const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8094";
const output = process.env.RUNE_QA_OUTPUT || await mkdtemp(join(tmpdir(), "rune-motion-"));
await mkdir(output, { recursive: true });
const viewportFilter = (process.env.VIEWPORT || "").split(",").filter(Boolean).map(value => value.replace("×", "x"));
const viewports = [[320, 568], [390, 844], [768, 1024], [844, 390], [1440, 900]]
  .filter(([width, height]) => !viewportFilter.length || viewportFilter.includes(`${width}x${height}`));
assert.ok(viewports.length, "VIEWPORT selects at least one supported size");
const browser = await chromium.launch({
  executablePath: process.env.RUNE_QA_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [], report = { viewports: [], resultTabs: [], motion: [], lifecycle: [] };
const decorative = [
  ".rd-world-scene", ".rd-world-motes", ".rd-mote", ".rd-menu-sigil",
  ".rd-relic-frame", ".rd-result-seal", ".rd-portrait-orbit",
  ".rd-boot-cinematic", ".rd-doorway-light", ".rd-path-current",
  ".rd-chain-energy", ".rd-rune-cast", ".rd-cast-fragment", "[data-rd-feedback]",
].join(",");
const transient = ".rd-rune-cast,[data-rd-feedback]";
const expeditionKey = "rd-expedition:v1:member:club";
console.log("Motion artifacts:", output);

async function setup(width = 390, height = 844, motion = "no-preference", video = false) {
  const context = await browser.newContext({
    viewport: { width, height }, hasTouch: width < 1000, reducedMotion: motion,
    ...(video ? { recordVideo: { dir: output, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await installRuneFixture(page);
  await page.addInitScript(() => {
    window.runeMotionTrace = [];
    for (const type of ["animationstart", "animationend", "animationcancel"]) {
      document.addEventListener(type, event => {
        if (!event.target.closest?.(".rd-mode")) return;
        window.runeMotionTrace.push({
          type, name: event.animationName, at: performance.now(),
          target: event.target.getAttribute("class"),
        });
        if (window.runeMotionTrace.length > 512) window.runeMotionTrace.shift();
      }, true);
    }
  });
  return { page, context };
}

async function settleUI(page) {
  await page.waitForFunction(() => window.runeQueryClient
    && window.runeQueryClient.isFetching() === 0 && window.runeQueryClient.isMutating() === 0);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function fitsWithoutScrolling(locator, label) {
  await expect.poll(() => locator.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { fits: rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }), { timeout: 1000, intervals: [20, 50, 100], message: `${label} fits without scrolling` }).toMatchObject({ fits: true });
}

async function clickControl(locator, label) {
  await fitsWithoutScrolling(locator, label);
  await locator.click();
}

async function go(page, route, scenario = "full") {
  const query = new URLSearchParams({ route, scenario, theme: "dark", completed: "149" });
  await page.goto(`${base}/scripts/fixtures/rune.html?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.runeQa));
  await settleUI(page);
  await expect(page.locator(".rd-mode main")).toBeVisible();
  await expect(page.getByText("Preparing your hero…", { exact: true })).toHaveCount(0);
  await expect.poll(() => page.locator(".rd-mode main .skeleton-shimmer").count()).toBe(0);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: "App destination reached" })).toHaveCount(0);
  const readySelector = route === "/rune-delve" ? '[data-testid="rune-home"]'
    : route.endsWith("/levels") ? ".rd-map-page"
    : route.endsWith("/shop") ? ".rd-shop-page"
    : route.includes("/results/") ? ".rd-results-page"
    : route.includes("/play/") ? "button[data-rune-cell]"
    : route.endsWith("/__qa/board") ? '[data-testid="rune-board-harness"]'
    : route.endsWith("/expedition") ? '[data-testid="expedition-start"]'
    : '[data-testid="rune-arena"]';
  await expect(page.locator(readySelector).first()).toBeVisible();
}

async function noOverflow(page, label) {
  const bounds = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight, bodyHeight: document.body.scrollHeight, x: scrollX, y: scrollY,
  }));
  assert.ok(bounds.document <= bounds.viewport + 1 && bounds.body <= bounds.viewport + 1
    && bounds.documentHeight <= bounds.viewportHeight + 1 && bounds.bodyHeight <= bounds.viewportHeight + 1
    && Math.abs(bounds.x) <= 1 && Math.abs(bounds.y) <= 1,
    `${label}: document fits without scrolling (${JSON.stringify(bounds)})`);
}

async function passiveDecoration(page, label) {
  const invalid = await page.locator(decorative).evaluateAll(nodes => nodes.flatMap(node => {
    const style = getComputedStyle(node);
    return style.pointerEvents !== "none" || !node.closest('[aria-hidden="true"]')
      ? [{ className: node.getAttribute("class"), pointerEvents: style.pointerEvents }] : [];
  }));
  assert.deepEqual(invalid, [], `${label}: decorative FX are hidden from accessibility and ignore pointers`);
}

async function tiles(page, label) {
  await expect(page.locator("button[data-rune-cell]")).toHaveCount(25);
  const sizes = await page.locator("button[data-rune-cell]").evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, fits: rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1 };
  }));
  assert.ok(sizes.every(rect => rect.width >= 43.9 && rect.height >= 43.9),
    `${label}: all 25 rune controls are at least 44px (${JSON.stringify(sizes[0])})`);
  assert.ok(sizes.every(rect => rect.fits), `${label}: all 25 rune controls fit without scrolling`);
}

async function campaignCastFits(page, label) {
  await fitsWithoutScrolling(page.getByRole("button", { name: "Cast", exact: true }), `${label}: Cast control`);
}

async function dismissIntroductions(page) {
  for (let i = 0; i < 10; i++) {
    await settleUI(page);
    const modal = page.getByRole("dialog").last();
    if (!await modal.count()) break;
    const begin = modal.getByRole("button", { name: /^(Face the Boss|Begin Level \d+|Ready to delve)/ }).last();
    const steady = modal.getByRole("button", { name: /^◇ Steady Path/ });
    const choice = await begin.count() ? begin : steady;
    if (!await choice.count()) assert.fail(`Unrecognized opening dialog: ${(await modal.innerText()).slice(0, 180)}`);
    const mounted = await modal.elementHandle();
    assert.ok(mounted, "Opening dialog is mounted");
    try {
      await clickControl(choice, "Opening confirmation");
      // A different introduction can immediately reuse the broad role locator.
      await mounted.waitForElementState("hidden");
    } finally { await mounted.dispose(); }
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("button[data-rune-cell]").first()).toBeEnabled();
}

async function dialogFocus(page) {
  const trigger = page.getByRole("button", { name: /^Ember Edge\./ });
  await fitsWithoutScrolling(trigger, "Owned relic trigger");
  await trigger.evaluate(node => node.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Ember Edge$/ });
  await expect(dialog).toBeVisible();
  // A Radix bottom sheet is visible while its entrance transform still places
  // part of it below the viewport. Measure the settled control, within 1s.
  await expect.poll(() => dialog.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return {
      fits: rect.x >= -1 && rect.y >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      animating: node.getAnimations().some(animation => animation.playState === "running"),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  }), { timeout: 1000, intervals: [20, 50, 100], message: "Settled upgrade dialog fits the viewport" })
    .toMatchObject({ fits: true, animating: false });
  const pager = dialog.locator("[data-rune-pager]");
  if (await pager.count()) {
    await clickControl(pager.getByRole("button", { name: "Next relic comparison page", exact: true }), "Upgrade comparison next page");
    await expect(pager).toHaveAttribute("data-page", "1");
    await fitsWithoutScrolling(dialog.getByRole("button", { name: /^Upgrade to R2/ }), "Upgrade action");
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i % 3 ? "Tab" : "Shift+Tab");
    assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), "Dialog traps focus");
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

async function selectPath(page) {
  await clickControl(page.getByRole("button", { name: "Tap", exact: true }), "Tap control");
  const cells = await page.locator("button[data-rune-cell]").evaluateAll(nodes => nodes.map(node => ({
    r: Number(node.dataset.r), c: Number(node.dataset.c), type: node.dataset.runeType || node.getAttribute("aria-label"),
    disabled: node.disabled,
  })));
  function search(path) {
    if (path.length === 3) return path;
    const last = path.at(-1);
    for (const next of cells) {
      if (next.disabled || next.type !== last.type || path.includes(next)) continue;
      if (Math.abs(next.r - last.r) <= 1 && Math.abs(next.c - last.c) <= 1) {
        const found = search([...path, next]);
        if (found) return found;
      }
    }
    return null;
  }
  for (const cell of cells.sort((a, b) => Number(b.type === "red") - Number(a.type === "red"))) {
    if (cell.disabled) continue;
    const path = search([cell]);
    if (!path) continue;
    for (const current of path) await clickControl(page.locator(`button[data-r="${current.r}"][data-c="${current.c}"]`), "Rune control");
    await expect(page.locator('button[data-rune-cell][aria-pressed="true"]')).toHaveCount(3);
    return;
  }
  throw new Error("No valid three-rune path");
}

async function sampleFrames(page, label, selector = ".rd-mode", duration = 360) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const before = await cdp.send("Performance.getMetrics");
  const sample = await page.evaluate(async ({ selector, duration }) => {
    const times = [], progressed = new Set(), initial = new Map(), names = new Set();
    const start = performance.now();
    await new Promise(resolve => {
      function frame(now) {
        times.push(now);
        for (const animation of document.getAnimations()) {
          const target = animation.effect?.target;
          if (!target?.closest?.(selector) || animation.playState !== "running") continue;
          names.add(animation.animationName || animation.constructor.name);
          if (initial.has(animation) && animation.currentTime > initial.get(animation)) progressed.add(animation);
          else if (!initial.has(animation)) initial.set(animation, animation.currentTime);
        }
        if (now - start < duration) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
    const gaps = times.slice(1).map((time, i) => time - times[i]).sort((a, b) => a - b);
    return {
      elapsedMs: +(performance.now() - start).toFixed(1), callbacks: times.length,
      medianGapMs: +(gaps[Math.floor(gaps.length / 2)] || 0).toFixed(2),
      p95GapMs: +(gaps[Math.floor(gaps.length * .95)] || 0).toFixed(2),
      maxGapMs: +(gaps.at(-1) || 0).toFixed(2),
      animationNames: [...names], progressedAnimations: progressed.size,
    };
  }, { selector, duration });
  const after = await cdp.send("Performance.getMetrics");
  await cdp.detach();
  const metric = (metrics, name) => metrics.metrics.find(item => item.name === name)?.value || 0;
  sample.taskDurationMs = +((metric(after, "TaskDuration") - metric(before, "TaskDuration")) * 1000).toFixed(2);
  sample.layoutCount = metric(after, "LayoutCount") - metric(before, "LayoutCount");
  assert.ok(sample.callbacks > 1, `${label}: actual requestAnimationFrame callbacks observed`);
  report.motion.push({ label, ...sample });
  return sample;
}

async function documentHidden(page, hidden) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: hidden ? "hidden" : "visible" });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, hidden);
  await expect(page.locator(".rd-shell")).toHaveAttribute("data-document-hidden", String(hidden));
  if (hidden) {
    const runningAmbient = await page.evaluate(() => document.getAnimations().filter(animation => {
      const target = animation.effect?.target;
      return target?.closest?.(".rd-mode") && animation.playState === "running"
        && animation.effect.getTiming().iterations === Infinity;
    }).length);
    assert.equal(runningAmbient, 0, "Hidden document pauses ambient animation work");
  }
}

async function boardMotion(motion) {
  const { page, context } = await setup(390, 844, motion, process.env.RUNE_QA_VIDEO === "1" && motion === "no-preference");
  const label = `board-${motion}`;
  try {
    await go(page, "/rune-delve/__qa/board");
    await expect(page.locator(".rd-boot-cinematic")).toHaveCount(0, { timeout: 1800 });
    await expect(page.locator(".rd-rune-board")).toHaveAttribute("data-motion", motion === "reduce" ? "reduced" : "full");
    await selectPath(page);
    await expect(page.locator(".rd-chain-energy")).toHaveCount(1);
    await passiveDecoration(page, label);
    await page.getByRole("button", { name: "Cast", exact: true }).evaluate(button => { button.click(); button.click(); });
    await expect(page.getByTestId("qa-chain-count")).toHaveText("1");
    await expect(page.locator('button[data-rune-cell][aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator(".rd-rune-cast")).toHaveCount(motion === "reduce" ? 0 : 1);
    if (motion !== "reduce") {
      const sample = await sampleFrames(page, label, ".rd-rune-board", 220);
      assert.ok(sample.progressedAnimations > 0, "Normal-motion cast has actual progressing animations");
      await page.screenshot({ path: join(output, `${label}-cast.png`) });
    }
    await expect(page.locator(transient)).toHaveCount(0, { timeout: 1800 });
    // Hidden tabs clear in-flight effects and restore an idle board on return.
    await selectPath(page);
    await page.getByRole("button", { name: "Cast", exact: true }).click();
    await expect(page.getByTestId("qa-chain-count")).toHaveText("2");
    await documentHidden(page, true);
    await expect(page.locator(".rd-rune-board")).toHaveAttribute("data-motion", "reduced");
    await expect(page.locator(transient)).toHaveCount(0);
    await documentHidden(page, false);
    await expect(page.locator(".rd-rune-board")).toHaveAttribute("data-motion", motion === "reduce" ? "reduced" : "full");
    await expect(page.locator(transient)).toHaveCount(0);
    await selectPath(page);
    await page.getByRole("button", { name: "Cast", exact: true }).click();
    await expect(page.getByTestId("qa-chain-count")).toHaveText("3");
    await page.getByRole("link", { name: "Sanctum", exact: true }).click();
    await expect(page.getByTestId("rune-home")).toBeVisible();
    await expect(page.locator(transient)).toHaveCount(0);
    report.lifecycle.push({ label, singleRapidCommit: true, hiddenClears: true, routeCleanup: true });
  } finally { await context.close(); }
}

async function activeGameMotion(route, motion) {
  const { page, context } = await setup(390, 844, motion);
  const arena = route.endsWith("endless"), label = `${arena ? "arena" : "expedition"}-${motion}`;
  try {
    await go(page, route);
    await expect(page.locator(".rd-boot-cinematic")).toHaveCount(0, { timeout: 1800 });
    await clickControl(arena ? page.getByRole("button", { name: "Begin arena", exact: true }) : page.getByTestId("expedition-start"), `${label}: start`);
    await tiles(page, label);
    await campaignCastFits(page, label);
    const read = () => page.evaluate(({ arena, expeditionKey }) => {
      const raw = arena
        ? Object.entries(sessionStorage).find(([key]) => key.startsWith("rd-arena-v1:"))?.[1]
        : localStorage.getItem(expeditionKey);
      return raw ? JSON.parse(raw) : null;
    }, { arena, expeditionKey });
    const before = await read();
    await selectPath(page);
    await page.getByRole("button", { name: "Cast", exact: true }).evaluate(button => { button.click(); button.click(); });
    await expect.poll(async () => {
      const run = await read();
      return arena ? run.tick : run.totalTurns;
    }).toBe((arena ? before.tick : before.totalTurns) + 1);
    const committed = await read();
    const changedResource = ["hp", "mana", "shieldTurns", "totalDamage"].some(key => committed.combat[key] !== before.combat[key]);
    if (motion !== "reduce" && changedResource)
      await expect.poll(() => page.locator("[data-rd-feedback]").count(), { timeout: 800 }).toBeGreaterThan(0);
    const feedback = await page.locator("[data-rd-feedback]").count();
    assert.ok(feedback <= 12, `${label}: combat feedback queue stays bounded`);
    if (motion === "reduce") assert.equal(feedback, 0, "Reduced motion omits combat particles");
    await passiveDecoration(page, label);
    if (feedback > 0) {
      const sample = await sampleFrames(page, `${label}-feedback`, "[data-rd-feedback]", 180);
      assert.ok(sample.progressedAnimations > 0, `${label}: committed combat feedback actually animates`);
      await page.screenshot({ path: join(output, `${label}-feedback.png`) });
    }
    await expect(page.locator(transient)).toHaveCount(0, { timeout: 1800 });
    await documentHidden(page, true);
    if (arena) await expect(page.getByText("Arena paused · your run is saved.", { exact: true })).toBeVisible();
    else await expect(page.getByRole("dialog", { name: "Expedition paused", exact: true })).toBeVisible();
    const paused = await read();
    await page.waitForTimeout(260);
    const after = await read();
    assert.equal(after.combat.hp, paused.combat.hp, `${label}: hidden pause prevents damage`);
    if (arena) assert.equal(after.elapsed, paused.elapsed, "Hidden arena spends no active-play time");
    await expect(page.locator(transient)).toHaveCount(0);
    await documentHidden(page, false);
    await clickControl(arena ? page.getByRole("button", { name: "Resume arena", exact: true }).last() : page.getByTestId("expedition-resume"), `${label}: resume`);
    await expect(page.locator("button[data-rune-cell]").first()).toBeEnabled();
    await expect(page.locator(transient)).toHaveCount(0);
    await page.screenshot({ path: join(output, `${label}-resumed.png`) });
    report.lifecycle.push({ label, singleRapidCommit: true, hiddenPause: true, resumeIdle: true, observedFeedback: feedback });
  } finally { await context.close(); }
}

async function resultsTabs(page, label) {
  await expect(page.locator(".rd-result-score")).toHaveText("1,234", { timeout: 1800 });
  for (const name of ["Stats", "Records"]) {
    const tab = page.getByRole("tab", { name, exact: true });
    await clickControl(tab, `${label}: ${name} tab`);
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await fitsWithoutScrolling(page.getByRole("tabpanel"), `${label}: ${name} panel`);
    await expect(page.locator(".rd-results-page")).not.toContainText(/\b(NaN|undefined|Infinity)\b/);
    await noOverflow(page, `${label}-${name}`);
    await page.screenshot({ path: join(output, `${label}-victory-${name.toLowerCase()}.png`) });
    report.resultTabs.push({ label, tab: name, fitsWithoutScrolling: true });
  }
  await clickControl(page.getByRole("tab", { name: "This record", exact: true }), `${label}: summary tab`);
}

try {
  for (const [width, height] of viewports) {
    for (const motion of ["no-preference", "reduce"]) {
      const { page, context } = await setup(width, height, motion);
      const label = `${width}-${height}-${motion}`;
      try {
        for (const [name, route, scenario] of [
          ["home", "/rune-delve"], ["map", "/rune-delve/levels"],
          ["shop", "/rune-delve/shop"], ["victory", "/rune-delve/results/1", "archive"],
          ["combat", "/rune-delve/play/1"],
        ]) {
          await go(page, route, scenario);
          if (name === "combat") {
            await dismissIntroductions(page);
            await tiles(page, label);
            await campaignCastFits(page, label);
          }
          await expect(page.locator(".rd-shell")).toHaveAttribute("data-rd-motion", motion === "reduce" ? "reduced" : "full");
          await noOverflow(page, `${label}-${name}`);
          await passiveDecoration(page, `${label}-${name}`);
          if (name === "shop") await dialogFocus(page);
          if (name === "victory") {
            await resultsTabs(page, label);
          }
          if (name === "home" && width === 390) {
            const sample = await sampleFrames(page, `${label}-home`);
            if (motion === "reduce") assert.equal(sample.progressedAnimations, 0, "Reduced-motion home has no progressing decorative animation");
            else assert.ok(sample.progressedAnimations > 0, "Normal-motion home has actual progressing atmospheric animation");
          }
          await expect(page.locator(".rd-boot-cinematic")).toHaveCount(0, { timeout: 1800 });
          await page.screenshot({ path: join(output, `${label}-${name}.png`) });
          const animationNames = await page.evaluate(() => [...new Set(window.runeMotionTrace.filter(event => event.type === "animationstart").map(event => event.name))]);
          report.viewports.push({
            width, height, motion, screen: name, noOverflow: true, animationNames,
            ...(name === "combat" ? { castInViewport: true } : {}),
          });
        }
        console.log("PASS viewport", label);
      } finally { await context.close(); }
    }
  }
  for (const motion of ["no-preference", "reduce"]) {
    await boardMotion(motion);
    await activeGameMotion("/rune-delve/expedition", motion);
    await activeGameMotion("/rune-delve/endless", motion);
  }
  assert.deepEqual(errors, [], "No browser runtime or console errors, including malformed SVG paths");
  console.log("PASS normal/reduced motion,", viewports.length, "viewports, real cast animation progress, focus, rapid input, cleanup and hidden/resume");
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify({ ...report, errors }, null, 2));
  await browser.close();
}
