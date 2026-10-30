// QA only: real pages/controls, browser-local data, no scrolling to make a test pass.
// RUNE_QA_URL=http://127.0.0.1:8094 node scripts/check-rune-viewport.mjs
// VIEWPORT=320x568,844x390 RUNE_QA_ROUTES=home,shop,campaign
// RUNE_QA_SCREENSHOTS=all captures every inspected page; default captures base states and failures.
import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRuneFixture } from "./rune-fixture.mjs";

const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8094";
const output =
  process.env.RUNE_QA_OUTPUT ||
  (await mkdtemp(join(tmpdir(), "rune-viewport-")));
await mkdir(output, { recursive: true });
const filter = (process.env.VIEWPORT || "")
  .split(",")
  .filter(Boolean)
  .map((value) => value.replace("×", "x"));
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1440, 900],
].filter(([w, h]) => !filter.length || filter.includes(`${w}x${h}`));
if (!viewports.length)
  throw new Error(
    `VIEWPORT matches none of the five supported sizes: ${filter}`,
  );
const routesFilter = (process.env.RUNE_QA_ROUTES || "")
  .split(",")
  .filter(Boolean);
const report = {
  checks: [],
  errors: [],
  runtimeErrors: [],
  fixtureStates: [],
  fixtures:
    "Browser-local archive records expanded for pagination; seeded postcombat checkpoints test layout only.",
};
const browser = await chromium.launch({
  executablePath: process.env.RUNE_QA_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
let sequence = 0,
  currentViewport = "";
console.log("Viewport artifacts:", output);

async function settle(page) {
  await page.waitForFunction(
    () => window.runeQa && window.runeQueryClient,
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () =>
      window.runeQueryClient.isFetching() === 0 &&
      window.runeQueryClient.isMutating() === 0,
    undefined,
    { timeout: 10_000 },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  // Visibility precedes the end of Radix's entrance/exit transform. Measure the
  // settled portal itself; arena timer children must not delay every sample.
  await page.waitForFunction(
    () =>
      [
        ...document.querySelectorAll('[role="dialog"],[role="alertdialog"]'),
      ].every((node) =>
        node
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== "running" ||
              animation.effect?.getTiming().iterations === Infinity,
          ),
      ),
    undefined,
    { timeout: 1200 },
  );
}

async function richData(page, scenario) {
  if (scenario === "new") return;
  await page.evaluate(async (scenario) => {
    if (window.__runeViewportRich) return;
    window.__runeViewportRich = true;
    const t = window.runeQa.tables,
      classes = ["warrior", "mage", "rogue", "cleric"];
    const [{ RELIC_CATALOG }, { BESTIARY_ROSTER }] = await Promise.all([
      import("/src/lib/runedelve/relics.ts"),
      import("/src/lib/runedelve/enemyRoster.ts"),
    ]);
    const date = new Date().toISOString(),
      today = date.slice(0, 10);
    const profiles = [],
      heroes = [],
      progresses = [];
    for (let i = 0; i < 13; i++) {
      const uid = `viewport-member-${i}`;
      profiles.push({
        id: uid,
        display_name: `Adventurer ${i + 1}`,
        avatar_url: null,
      });
      t.club_members.push({ user_id: uid, club_id: "club", role: "member" });
      heroes.push({
        ...t.rune_delve_heroes[0],
        id: `viewport-hero-${i}`,
        user_id: uid,
        class: classes[i % 4],
        hero_name: `Mira Dawnkeeper ${i + 1}`,
        cosmetic_title: "Keeper of the Hollow",
        level: 8 + i,
      });
      progresses.push({
        ...t.rune_delve_progress[0],
        id: `viewport-progress-${i}`,
        user_id: uid,
        highest_completed_level: 140 - i,
        highest_unlocked_level: 141 - i,
        total_levels_cleared: 140 - i,
      });
    }
    t.profiles.push(...profiles);
    t.rune_delve_heroes.push(...heroes);
    t.rune_delve_progress.push(...progresses);
    const originalRuns = t.rune_delve_runs.slice();
    if (originalRuns.length) {
      t.rune_delve_runs = Array.from({ length: 18 }, (_, i) => ({
        ...originalRuns[i % originalRuns.length],
        id: `viewport-run-${i}`,
        level_number: i + 1,
        level_id: `11000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        hero_class: i < 2 ? originalRuns[i].hero_class : classes[i % 4],
        completed_at: date,
      }));
      // The current chamber's Records tab must also exercise multiple pages.
      t.rune_delve_runs.push(
        ...profiles
          .slice(0, 9)
          .map((profile, i) => ({
            ...originalRuns[0],
            id: `viewport-club-run-${i}`,
            user_id: profile.id,
            score: 2200 - i * 50,
          })),
      );
    }
    const dailyTemplate = t.rune_delve_daily_runs[0] || {
      daily_date: today,
      score: 3456,
      stars: 2,
      dungeon_cleared: false,
      kills_count: 17,
      modifiers: [],
      hero_class: "warrior",
      completed_at: date,
    };
    t.rune_delve_daily_runs = Array.from({ length: 13 }, (_, i) => ({
      ...dailyTemplate,
      id: `viewport-daily-${i}`,
      user_id: "member",
      daily_date: new Date(Date.now() - (i + 1) * 86400000)
        .toISOString()
        .slice(0, 10),
      hero_class: classes[i % 4],
    }));
    t.rune_delve_daily_runs.push(
      ...profiles
        .slice(0, 10)
        .map((profile, i) => ({
          ...dailyTemplate,
          id: `viewport-today-${i}`,
          user_id: profile.id,
          daily_date: today,
          kills_count: 30 - i,
          score: 5000 - i * 100,
        })),
    );
    if (scenario === "archive")
      t.rune_delve_daily_runs.push({
        ...dailyTemplate,
        id: "viewport-my-today",
        user_id: "member",
        daily_date: today,
      });
    t.rune_delve_relic_unlocks = RELIC_CATALOG.slice(0, 10).map((relic, i) => ({
      id: `viewport-relic-${i}`,
      user_id: "member",
      relic_id: relic.id,
      rank: i === 9 ? 5 : 1,
      acquired_at: date,
      acquired_at_level: i + 1,
    }));
    t.rune_delve_bestiary = BESTIARY_ROSTER.map((enemy, i) => ({
      id: `viewport-bestiary-${i}`,
      user_id: "member",
      archetype_id: enemy.id,
      defeat_count: i + 1,
      first_defeated_at: date,
      last_defeated_at: date,
      highest_level_defeated: 150,
      created_at: date,
    }));
    await window.runeQueryClient.invalidateQueries();
  }, scenario);
}

async function go(page, route, scenario = "archive") {
  const query = new URLSearchParams({
    route,
    scenario,
    theme: "dark",
    completed: "149",
  });
  await page.goto(`${base}/scripts/fixtures/rune.html?${query}`, {
    waitUntil: "domcontentloaded",
  });
  await settle(page);
  await richData(page, scenario);
  await settle(page);
}

// Returns raw evidence, including geometry hidden by overflow:clip/hidden.
async function audit(page, gameplay = false) {
  return page.evaluate((gameplay) => {
    const tolerance = 1.1,
      violations = [],
      scrollAreas = [],
      truncations = [];
    const interactive =
      'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"],[role="switch"],[role="slider"]';
    const describe = (node) =>
      `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${typeof node.className === "string" ? "." + node.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}${node.getAttribute("aria-label") ? `[${node.getAttribute("aria-label")}]` : ""}`;
    const box = (r) => ({
      x: +r.x.toFixed(2),
      y: +r.y.toFixed(2),
      width: +r.width.toFixed(2),
      height: +r.height.toFixed(2),
    });
    function visible(node) {
      if (
        !(node instanceof HTMLElement) ||
        node.closest('[hidden],[aria-hidden="true"],.sr-only,[inert]')
      )
        return false;
      for (let parent = node; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        if (
          css.display === "none" ||
          css.visibility === "hidden" ||
          css.visibility === "collapse" ||
          Number(css.opacity) === 0
        )
          return false;
        if (
          (css.clip !== "auto" && css.clip !== "") ||
          css.clipPath === "inset(50%)"
        )
          return false;
      }
      const rect = node.getBoundingClientRect();
      return rect.width > 0.1 && rect.height > 0.1;
    }
    // Radix exempts live regions from hideOthers. The battle command's aria-live
    // subtree can remain accessible behind a modal; it is not an active surface.
    const modals = [
      ...document.querySelectorAll('[role="dialog"],[role="alertdialog"]'),
    ].filter(visible);
    const roots = modals.length
      ? [modals.at(-1)]
      : [...document.querySelectorAll(".rd-shell")].filter(visible);
    const all = [
      ...new Set(
        roots.flatMap((root) => [root, ...root.querySelectorAll("*")]),
      ),
    ].filter(visible);
    const meaningful = all.filter(
      (node) =>
        node.matches(
          interactive +
            ',h1,h2,h3,h4,h5,h6,p,label,article,summary,output,[role="tabpanel"],[role="listitem"]',
        ) ||
        [...node.childNodes].some(
          (child) =>
            child.nodeType === Node.TEXT_NODE && child.textContent.trim(),
        ),
    );
    const meaningfulSet = new Set(meaningful),
      isTruncated = (node) => {
        const css = getComputedStyle(node);
        return (
          css.textOverflow === "ellipsis" || Number(css.webkitLineClamp) > 0
        );
      };
    if (meaningful.length < 3)
      violations.push({
        type: "empty-screen",
        meaningfulNodes: meaningful.length,
      });
    if (
      document.querySelector(".rd-main h1")?.textContent ===
      "App destination reached"
    )
      violations.push({ type: "unsupported-route" });
    const add = (type, node, detail) =>
      violations.push({
        type,
        node: describe(node),
        text: (node.innerText || node.getAttribute("aria-label") || "")
          .trim()
          .slice(0, 110),
        ...detail,
      });
    const doc = {
      width: innerWidth,
      height: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      bodyWidth: document.body.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      scrollX,
      scrollY,
    };
    if (
      doc.documentWidth > innerWidth + tolerance ||
      doc.bodyWidth > innerWidth + tolerance ||
      doc.documentHeight > innerHeight + tolerance ||
      doc.bodyHeight > innerHeight + tolerance
    )
      violations.push({ type: "document-scroll-size", ...doc });
    if (Math.abs(scrollX) > tolerance || Math.abs(scrollY) > tolerance)
      violations.push({ type: "document-scrolled", ...doc });
    for (const node of meaningful) {
      const rect = node.getBoundingClientRect();
      if (
        rect.left < -tolerance ||
        rect.top < -tolerance ||
        rect.right > innerWidth + tolerance ||
        rect.bottom > innerHeight + tolerance
      )
        add("outside-viewport", node, { bounds: box(rect) });
      for (
        let parent = node.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const css = getComputedStyle(parent),
          clipX = /hidden|clip|auto|scroll/.test(css.overflowX),
          clipY = /hidden|clip|auto|scroll/.test(css.overflowY);
        if (!clipX && !clipY) continue;
        // Intentional one-line names may truncate; controls themselves may not.
        if (!node.matches(interactive) && isTruncated(node)) {
          truncations.push(describe(node));
          continue;
        }
        const outer = parent.getBoundingClientRect(),
          left = outer.left + parent.clientLeft,
          top = outer.top + parent.clientTop;
        if (
          (clipX &&
            (rect.left < left - tolerance ||
              rect.right > left + parent.clientWidth + tolerance)) ||
          (clipY &&
            (rect.top < top - tolerance ||
              rect.bottom > top + parent.clientHeight + tolerance))
        ) {
          add("clipped-by-ancestor", node, {
            bounds: box(rect),
            ancestor: describe(parent),
            ancestorBounds: {
              x: left,
              y: top,
              width: parent.clientWidth,
              height: parent.clientHeight,
            },
          });
          break;
        }
      }
      if (
        node.matches(interactive) &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= innerWidth &&
        rect.bottom <= innerHeight
      ) {
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        if (hit && hit !== node && !node.contains(hit) && !hit.contains(node))
          add("control-covered", node, {
            coveredBy: describe(hit),
            bounds: box(rect),
          });
      }
    }
    for (const node of all) {
      if (
        node.clientWidth <= 0 ||
        node.clientHeight <= 0 ||
        getComputedStyle(node).display === "inline" ||
        isTruncated(node)
      )
        continue;
      const dy = node.scrollHeight - node.clientHeight,
        dx = node.scrollWidth - node.clientWidth;
      if (dy <= tolerance && dx <= tolerance) continue;
      if (
        !meaningfulSet.has(node) &&
        ![
          ...node.querySelectorAll(interactive + ",h1,h2,h3,p,article,output"),
        ].some((child) => meaningfulSet.has(child))
      )
        continue;
      const css = getComputedStyle(node);
      const area = {
        node: describe(node),
        clientWidth: node.clientWidth,
        clientHeight: node.clientHeight,
        scrollWidth: node.scrollWidth,
        scrollHeight: node.scrollHeight,
        overflowX: css.overflowX,
        overflowY: css.overflowY,
      };
      scrollAreas.push(area);
      // Visible overflow still fails through child bounds; clipped/scrolling content is never hidden by a CSS lock.
      if (
        (dy > tolerance && /auto|scroll|hidden|clip/.test(css.overflowY)) ||
        (dx > tolerance && /auto|scroll|hidden|clip/.test(css.overflowX))
      )
        violations.push({ type: "internal-scroll-size", ...area });
    }
    let board;
    if (gameplay) {
      const cells = [
        ...document.querySelectorAll(".rd-rune-board button[data-r][data-c]"),
      ].filter(visible);
      const sizes = cells.map((node) => box(node.getBoundingClientRect()));
      const cast = [...document.querySelectorAll("button")].find(
        (node) => visible(node) && node.textContent.trim() === "Cast",
      );
      board = {
        cells: cells.length,
        minWidth: Math.min(...sizes.map((r) => r.width)),
        minHeight: Math.min(...sizes.map((r) => r.height)),
        cast: cast ? box(cast.getBoundingClientRect()) : null,
      };
      if (cells.length !== 25)
        violations.push({
          type: "board-cell-count",
          actual: cells.length,
          expected: 25,
        });
      if (sizes.some((r) => r.width < 43.9 || r.height < 43.9))
        violations.push({ type: "board-target-below-44", ...board });
      if (!cast) violations.push({ type: "missing-cast-control" });
    }
    const unique = [
      ...new Map(violations.map((v) => [JSON.stringify(v), v])).values(),
    ];
    return {
      document: doc,
      meaningfulNodes: meaningful.length,
      controls: meaningful.filter((node) => node.matches(interactive)).length,
      board,
      scrollAreas,
      truncations: [...new Set(truncations)],
      violationCount: unique.length,
      violations: unique.slice(0, 50),
    };
  }, gameplay);
}

async function inspect(
  page,
  label,
  { gameplay = false, capture = false } = {},
) {
  await settle(page);
  const result = await audit(page, gameplay),
    id = ++sequence;
  const entry = { id, viewport: currentViewport, label, ...result };
  if (
    result.violationCount ||
    capture ||
    process.env.RUNE_QA_SCREENSHOTS === "all"
  ) {
    entry.screenshot = `${String(id).padStart(4, "0")}-${currentViewport}-${label.replace(/[^a-z0-9]+/gi, "-").slice(0, 125)}.png`;
    await page.screenshot({ path: join(output, entry.screenshot) });
  }
  report.checks.push(entry);
  if (result.violationCount)
    console.log(
      "FAIL bounds",
      currentViewport,
      label,
      result.violationCount,
      JSON.stringify(result.violations.slice(0, 2)),
    );
}

async function attempt(page, label, work) {
  try {
    await work();
    return true;
  } catch (error) {
    const entry = { viewport: currentViewport, label, error: error.message };
    report.errors.push(entry);
    console.log(
      "FAIL step",
      currentViewport,
      label,
      error.message.split("\n")[0],
    );
    try {
      await inspect(page, `${label}-error`, { capture: true });
    } catch {
      /* Preserve the original error and continue the matrix. */
    }
    return false;
  }
}

async function activate(locator) {
  if (!(await locator.count()))
    throw new Error(`Required control is missing: ${locator.toString()}`);
  await locator.first().evaluate((node) => {
    if (node.disabled)
      throw new Error(
        `Required control is disabled: ${node.getAttribute("aria-label") || node.textContent}`,
      );
    // Radix Tabs commit on primary mousedown; custom game tabs commit on click.
    // Both events remain on the audited control and never invoke auto-scrolling.
    if (node.getAttribute("role") === "tab")
      node.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    node.click();
  });
}

async function choose(select, value) {
  await select.evaluate((node, value) => {
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}

async function pages(
  page,
  label,
  scope = page.locator(".rd-main"),
  seen = new Set(),
) {
  await settle(page);
  const ids = await scope.locator("[data-rune-pager]").evaluateAll((nodes) =>
    nodes
      .filter(
        (node) =>
          node.getBoundingClientRect().height &&
          !node.closest('[hidden],[aria-hidden="true"]'),
      )
      .map((node) => {
        node.dataset.qaViewportPager ||= String(
          (window.__runeViewportPager = (window.__runeViewportPager || 0) + 1),
        );
        return node.dataset.qaViewportPager;
      }),
  );
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const pager = page.locator(`[data-qa-viewport-pager="${id}"]`);
    const count = Number(await pager.getAttribute("data-page-count"));
    if (!(count > 1 && count <= 200))
      throw new Error(`Unexpected pager count ${count}`);
    while (Number(await pager.getAttribute("data-page")) > 0) {
      await activate(pager.locator("button").first());
      await settle(page);
    }
    for (let index = 0; index < count; index++) {
      await inspect(
        page,
        `${label}-${await pager.getAttribute("aria-label")}-${index + 1}`,
      );
      await pages(page, label, scope, seen); // Newly visible nested pagers (e.g. battle log).
      if (index < count - 1) {
        await activate(pager.locator("button").last());
        await settle(page);
        const actual = Number(await pager.getAttribute("data-page"));
        if (actual !== index + 1)
          throw new Error(
            `Pager failed to advance: expected ${index + 1}, got ${actual}`,
          );
      }
    }
    while (Number(await pager.getAttribute("data-page")) > 0) {
      await activate(pager.locator("button").first());
      await settle(page);
    }
  }
}

async function tabs(page, label, scope = page.locator(".rd-main")) {
  const names = await scope.getByRole("tab").allTextContents();
  if (!names.length) {
    await pages(page, label, scope);
    return;
  }
  for (const name of names)
    await attempt(page, `${label}-${name.trim()}`, async () => {
      const tab = scope.getByRole("tab", { name: name.trim(), exact: true });
      await activate(tab);
      await settle(page);
      if ((await tab.getAttribute("aria-selected")) !== "true")
        throw new Error(`Tab did not activate: ${name.trim()}`);
      await inspect(page, `${label}-${name.trim()}`);
      await pages(page, `${label}-${name.trim()}`, scope);
    });
}

async function closeDialog(page) {
  const dialog = page.getByRole("dialog").last();
  const close = dialog
    .getByRole("button", {
      name: /^(Close|Close build|Back to battle|Ready to delve)$/,
    })
    .first();
  if (await close.count()) await activate(close);
  else await page.keyboard.press("Escape");
  await settle(page);
  if (await page.getByRole("dialog").count())
    throw new Error("Dialog did not close");
}

async function dialog(page, label, trigger) {
  await activate(trigger);
  await settle(page);
  const modal = page.getByRole("dialog").last();
  if (!(await modal.count())) throw new Error(`Dialog missing after ${label}`);
  await inspect(page, label, { capture: true });
  await tabs(page, label, modal);
  await closeDialog(page);
}

async function dismissIntroductions(page) {
  for (let i = 0; i < 8; i++) {
    const modal = page.getByRole("dialog").last();
    const begin = modal.getByRole("button", {
      name: /^(Face the Boss|Begin Level \d+|Ready to delve)/,
    });
    if (await begin.count()) {
      await inspect(page, "campaign-introduction", { capture: true });
      await pages(page, "campaign-introduction", modal);
      await activate(begin);
      await settle(page);
      continue;
    }
    const steady = modal.getByRole("button", { name: /^◇ Steady Path/ });
    if (await steady.count()) {
      await inspect(page, "campaign-bargains", { capture: true });
      await pages(page, "campaign-bargains", modal);
      await activate(steady);
      await settle(page);
      continue;
    }
    const path = modal.getByRole("button", { name: /^Choose Standard Path/ });
    if (await path.count()) {
      await pages(page, "campaign-path", modal);
      await activate(path);
      await settle(page);
      continue;
    }
    break;
  }
  if (await page.getByRole("dialog").count())
    throw new Error(
      `Campaign still has an opening dialog: ${(await page.getByRole("dialog").last().innerText()).slice(0, 180)}`,
    );
}

async function enemyPages(page, label) {
  const next = page.getByRole("button", { name: /^Next enemies\./ });
  for (
    let pageIndex = 1;
    (await next.count()) && !(await next.isDisabled());
    pageIndex++
  ) {
    if (pageIndex > 12)
      throw new Error("Enemy carousel exceeded its bounded page budget");
    await activate(next);
    await inspect(page, `${label}-enemy-page-${pageIndex + 1}`, {
      gameplay: true,
    });
  }
  const previous = page.getByRole("button", {
    name: "Previous enemies",
    exact: true,
  });
  while ((await previous.count()) && !(await previous.isDisabled())) {
    await activate(previous);
    await settle(page);
  }
}

async function campaign(page) {
  await go(page, "/rune-delve/play/1", "full");
  await dismissIntroductions(page);
  await inspect(page, "campaign-active", { gameplay: true, capture: true });
  await enemyPages(page, "campaign");
  await dialog(
    page,
    "campaign-enemy",
    page.getByRole("button", { name: /^Inspect / }).first(),
  );
  await activate(
    page.getByRole("button", {
      name: "Encounter details and battle log",
      exact: true,
    }),
  );
  const details = page.getByRole("dialog").last();
  await inspect(page, "campaign-encounter", { capture: true });
  await pages(page, "campaign-encounter", details);
  await activate(
    details.getByRole("button", { name: "How to play", exact: true }),
  );
  await inspect(page, "campaign-help", { capture: true });
  await pages(page, "campaign-help", page.getByRole("dialog").last());
  await closeDialog(page);
  // A boss route also covers longer rules, introductions and sealed tile geometry.
  await go(page, "/rune-delve/play/150", "full");
  await dismissIntroductions(page);
  await inspect(page, "campaign-boss-active", {
    gameplay: true,
    capture: true,
  });
  await enemyPages(page, "campaign-boss");
  await dialog(
    page,
    "campaign-boss-enemy",
    page.getByRole("button", { name: /^Inspect / }).first(),
  );
  await dialog(
    page,
    "campaign-boss-encounter",
    page.getByRole("button", {
      name: "Encounter details and battle log",
      exact: true,
    }),
  );
}

async function arena(page) {
  await go(page, "/rune-delve/endless", "full");
  await inspect(page, "arena-entry", { capture: true });
  await activate(
    page.getByRole("button", { name: "Begin arena", exact: true }),
  );
  await inspect(page, "arena-active", { gameplay: true, capture: true });
  await enemyPages(page, "arena");
  await dialog(
    page,
    "arena-enemy",
    page.getByRole("button", { name: /^Inspect / }).first(),
  );
  await activate(
    page.getByRole("button", { name: "Pause arena", exact: true }),
  );
  await inspect(page, "arena-paused", { capture: true });
  // Presentation-only terminal checkpoint, without waiting two real minutes.
  await page.evaluate(async () => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("rd-arena-v1:"),
    );
    const run = JSON.parse(sessionStorage.getItem(key));
    const { endlessScore } = await import("/src/lib/runedelve/endlessMode.ts");
    run.combat.enemiesDefeated = 12;
    run.combat.totalDamage = 800;
    run.elapsed = 120;
    run.attackAt = 122;
    run.result = { reason: "timeout", kills: 12, score: endlessScore(12, 800) };
    run.paused = true;
    run.savedAt = Date.now();
    sessionStorage.setItem(key, JSON.stringify(run));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page
    .getByText("Arena complete", { exact: true })
    .waitFor({ state: "visible" });
  await inspect(page, "arena-summary", { capture: true });
}

const expeditionKey = "rd-expedition:v1:member:club";
async function expedition(page) {
  await go(page, "/rune-delve/expedition", "full");
  await inspect(page, "expedition-entry", { capture: true });
  for (const name of ["Warrior", "Mage", "Rogue", "Cleric"]) {
    await activate(
      page
        .locator(".rd-exp-class-grid")
        .getByRole("button", { name, exact: true }),
    );
    await inspect(page, `expedition-entry-${name}`);
  }
  await activate(
    page
      .locator(".rd-exp-class-grid")
      .getByRole("button", { name: "Warrior", exact: true }),
  );
  await activate(page.getByTestId("expedition-start"));
  await inspect(page, "expedition-active", { gameplay: true, capture: true });
  await enemyPages(page, "expedition");
  await dialog(
    page,
    "expedition-enemy",
    page.getByRole("button", { name: /^Inspect / }).first(),
  );
  await activate(
    page.getByRole("button", { name: "Pause expedition", exact: true }),
  );
  await inspect(page, "expedition-paused", { capture: true });
  await activate(page.getByTestId("expedition-resume"));
  const baseline = await page.evaluate(
    (key) => localStorage.getItem(key),
    expeditionKey,
  );
  const seedMarker = "__rune-viewport-expedition-seed";
  // The departing page flushes its React checkpoint on pagehide. Apply the QA
  // checkpoint in the new document, after that flush and before hydration.
  await page.addInitScript(
    ({ key, marker }) => {
      const raw = sessionStorage.getItem(marker);
      if (!raw) return;
      sessionStorage.removeItem(marker);
      localStorage.setItem(key, raw);
    },
    { key: expeditionKey, marker: seedMarker },
  );
  const load = async (phase, build = false) => {
    const expectedBoons = await page.evaluate(
      async ({ marker, baseline, phase, build }) => {
        const run = JSON.parse(baseline);
        const [
          { EXPEDITION_BOONS, expeditionEnemies, loadExpedition },
          { initialCombat },
        ] = await Promise.all([
          import("/src/lib/runedelve/expedition.ts"),
          import("/src/lib/runedelve/combatEngine.ts"),
        ]);
        run.phase = phase;
        if (build) {
          // Five cleared rooms can award five blessings before the final fight.
          run.room = 6;
          run.roomsCleared = 5;
          run.route = "crypt";
          run.boons = Object.fromEntries(
            EXPEDITION_BOONS.slice(0, 5).map((boon) => [boon.id, 1]),
          );
          run.totalTurns = 50;
          run.totalKills = 10;
          run.score = 2400;
          run.combat = initialCombat(
            expeditionEnemies(run.seed, 6, run.ascension, "crypt"),
            22,
            { bonusMaxHp: 15 },
          );
          run.combat.hp = 100;
        }
        if (phase === "boon") {
          run.roomsCleared = 1;
          run.combat.enemies = run.combat.enemies.map((enemy) => ({
            ...enemy,
            hp: 0,
          }));
        }
        if (phase === "won") {
          run.room = 6;
          run.roomsCleared = 6;
          run.combat.enemies = run.combat.enemies.map((enemy) => ({
            ...enemy,
            hp: 0,
          }));
        }
        run.savedAt = Date.now();
        const raw = JSON.stringify(run),
          validationKey = `${marker}:validation`;
        localStorage.setItem(validationKey, raw);
        const valid = loadExpedition(validationKey);
        localStorage.removeItem(validationKey);
        if (!valid)
          throw new Error(
            `Invalid Expedition QA checkpoint: ${phase}, build=${build}`,
          );
        sessionStorage.setItem(marker, raw);
        return Object.keys(run.boons).sort();
      },
      { marker: seedMarker, baseline, phase, build },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    if (await page.getByTestId("expedition-resume").count())
      await activate(page.getByTestId("expedition-resume"));
    await settle(page);
    await page
      .locator(`[data-testid="expedition-page"][data-phase="${phase}"]`)
      .waitFor({ state: "visible" });
    const restored = await page.evaluate((key) => {
      const run = JSON.parse(localStorage.getItem(key));
      return {
        room: run?.room,
        roomsCleared: run?.roomsCleared,
        boons: Object.keys(run?.boons || {}).sort(),
      };
    }, expeditionKey);
    if (JSON.stringify(restored.boons) !== JSON.stringify(expectedBoons))
      throw new Error(
        `Expedition checkpoint lost blessings: expected ${expectedBoons}, got ${restored.boons}`,
      );
    if (
      build &&
      (restored.room !== 6 ||
        restored.roomsCleared !== (phase === "won" ? 6 : 5) ||
        restored.boons.length !== 5)
    )
      throw new Error(
        `Advanced Expedition checkpoint did not survive hydration: ${JSON.stringify(restored)}`,
      );
    report.fixtureStates.push({
      viewport: currentViewport,
      phase,
      build,
      ...restored,
    });
  };
  await load("combat", true);
  await inspect(page, "expedition-build-active", { gameplay: true });
  await dialog(
    page,
    "expedition-build",
    page.getByRole("button", { name: "Your expedition build", exact: true }),
  );
  await load("boon");
  await inspect(page, "expedition-blessings", { capture: true });
  await pages(page, "expedition-blessings");
  await activate(page.locator('[data-testid^="expedition-boon-"]').first());
  await inspect(page, "expedition-routes", { capture: true });
  await activate(page.locator('[data-testid^="expedition-route-"]').first());
  await inspect(page, "expedition-next-room", { gameplay: true });
  await load("won", true);
  await inspect(page, "expedition-summary", { capture: true });
}

async function menus(page, name, route) {
  await go(page, route, name === "forge" ? "new" : "archive");
  if (name.startsWith("results-"))
    await page
      .locator(`.rd-results-page[data-cleared="${name === "results-victory"}"]`)
      .waitFor({ state: "visible" });
  await inspect(page, name, { capture: true });
  if (name === "home") {
    await dialog(
      page,
      "codex",
      page.getByRole("button", { name: "Open Codex", exact: true }),
    );
    await dialog(
      page,
      "sound",
      page.getByRole("button", { name: "Sound settings", exact: true }),
    );
  } else if (name === "forge") {
    for (const cls of ["Warrior", "Mage", "Rogue", "Cleric"]) {
      await activate(
        page.getByRole("button", { name: `Choose ${cls}`, exact: true }),
      );
      await inspect(page, `forge-${cls}`);
    }
    await dialog(
      page,
      "forge-help",
      page.getByRole("button", { name: "Learn the runes", exact: true }),
    );
  } else if (name === "map") {
    for (const chapter of [1, 2, 3]) {
      await choose(page.locator("#rd-map-chapter"), chapter);
      await settle(page);
      for (let stage = 0; stage < 5; stage++) {
        await activate(
          page
            .getByRole("navigation", {
              name: "Dungeon route stages",
              exact: true,
            })
            .locator("button")
            .nth(stage),
        );
        await inspect(page, `map-chapter-${chapter}-stage-${stage + 1}`);
        await pages(page, `map-chapter-${chapter}-stage-${stage + 1}`);
      }
    }
    await choose(page.locator("#rd-map-chapter"), 2);
    await settle(page);
    await activate(
      page
        .getByRole("navigation", { name: "Dungeon route stages", exact: true })
        .locator("button")
        .first(),
    );
    await dialog(
      page,
      "map-milestone-paths",
      page.getByRole("button", { name: /^Level 51\b/ }),
    );
  } else if (name === "shop") {
    const categories = await page
      .locator("#rd-relic-category option")
      .evaluateAll((nodes) => nodes.map((node) => node.value));
    for (const tier of [1, 2, 3])
      for (const category of categories) {
        await choose(page.locator("#rd-relic-tier"), tier);
        await choose(page.locator("#rd-relic-category"), category);
        await inspect(page, `shop-tier-${tier}-${category}`);
        await pages(page, `shop-tier-${tier}-${category}`);
      }
    await choose(page.locator("#rd-relic-tier"), 1);
    await choose(page.locator("#rd-relic-category"), "all");
    await settle(page);
    await dialog(
      page,
      "relic-upgrade",
      page.getByRole("button", { name: /^Ember Edge\./ }),
    );
  } else if (name === "armory") {
    for (const cls of ["warrior", "mage", "rogue", "cleric"]) {
      await choose(page.locator("#rd-armory-class"), cls);
      await tabs(page, `armory-${cls}`);
    }
  } else {
    await tabs(page, name);
    if (name === "hero") {
      await activate(page.getByRole("tab", { name: "Profile", exact: true }));
      await activate(
        page.getByRole("button", { name: "Rename hero", exact: true }),
      );
      await inspect(page, "hero-rename", { capture: true });
      await activate(page.getByRole("button", { name: "Cancel", exact: true }));
    }
    if (name === "bestiary") {
      // The first page includes discovered melee/caster entries; exercise their detail tabs.
      const count = Math.min(
        4,
        await page.locator(".rd-bestiary-tile").count(),
      );
      for (let i = 0; i < count; i++)
        await dialog(
          page,
          `bestiary-detail-${i + 1}`,
          page.locator(".rd-bestiary-tile").nth(i),
        );
      for (const chapter of [1, 2, 3]) {
        await activate(
          page
            .locator(".rd-bestiary-chapters")
            .getByRole("button", { name: `Chapter ${chapter}`, exact: true }),
        );
        await inspect(page, `bestiary-chapter-${chapter}`);
        await pages(page, `bestiary-chapter-${chapter}`);
      }
    }
  }
}

const routes = [
  ["home", "/rune-delve"],
  ["forge", "/rune-delve"],
  ["map", "/rune-delve/levels"],
  ["hero", "/rune-delve/hero"],
  ["armory", "/rune-delve/armory"],
  ["shop", "/rune-delve/shop"],
  ["daily", "/rune-delve/daily"],
  ["quests", "/rune-delve/quests"],
  ["bestiary", "/rune-delve/bestiary"],
  ["history", "/rune-delve/history"],
  ["leaderboard", "/rune-delve/leaderboard"],
  ["results-victory", "/rune-delve/results/1"],
  ["results-defeat", "/rune-delve/results/2"],
  ["campaign"],
  ["arena"],
  ["expedition"],
].filter(([name]) => !routesFilter.length || routesFilter.includes(name));
try {
  for (const [width, height] of viewports) {
    currentViewport = `${width}x${height}`;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on("pageerror", (error) =>
      report.runtimeErrors.push({
        viewport: currentViewport,
        error: error.message,
      }),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        report.runtimeErrors.push({
          viewport: currentViewport,
          error: message.text(),
        });
    });
    await installRuneFixture(page);
    await page.addInitScript(() => {
      sessionStorage.setItem("rd_boot_played_v1", "1");
    });
    for (const [name, route] of routes) {
      await attempt(page, name, async () => {
        if (name === "campaign") await campaign(page);
        else if (name === "arena") await arena(page);
        else if (name === "expedition") await expedition(page);
        else await menus(page, name, route);
      });
      console.log("CHECKED", currentViewport, name);
      // Flush after every route so an interrupted run still has useful evidence.
      await writeFile(
        join(output, "report.json"),
        JSON.stringify(report, null, 2),
      );
    }
    await context.close();
  }
} finally {
  report.summary = {
    checks: report.checks.length,
    failedChecks: report.checks.filter((check) => check.violationCount).length,
    stepErrors: report.errors.length,
    runtimeErrors: report.runtimeErrors.length,
  };
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log("Viewport summary:", JSON.stringify(report.summary));
if (
  report.summary.failedChecks ||
  report.summary.stepErrors ||
  report.summary.runtimeErrors
)
  process.exitCode = 1;
