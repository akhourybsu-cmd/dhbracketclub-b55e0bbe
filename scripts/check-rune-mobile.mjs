// Actual Rune Delve screens and controls. Data/awards are isolated in rune-backend.ts.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRuneFixture } from "./rune-fixture.mjs";

const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8087";
const output = await mkdtemp(join(tmpdir(), "rune-delve-"));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
console.log("Screenshots:", output);
const routes = [
  ["home", "/rune-delve"],
  ["map", "/rune-delve/levels"],
  ["armory", "/rune-delve/armory"],
  ["shop", "/rune-delve/shop"],
  ["hero", "/rune-delve/hero"],
  ["daily", "/rune-delve/daily"],
  ["quests", "/rune-delve/quests", "archive"],
  ["bestiary", "/rune-delve/bestiary", "archive"],
  ["history", "/rune-delve/history", "archive"],
  ["leaderboard", "/rune-delve/leaderboard", "archive"],
  ["result-victory", "/rune-delve/results/1", "archive"],
  ["result-defeat", "/rune-delve/results/2", "archive"],
  ["combat", "/rune-delve/play/1"],
  ["expedition", "/rune-delve/expedition"],
  ["arena", "/rune-delve/endless"],
];
async function go(
  page,
  route = "/rune-delve",
  theme = "dark",
  scenario = "full",
) {
  await page.goto(
    `${base}/scripts/fixtures/rune.html?theme=${theme}&scenario=${scenario}&route=${encodeURIComponent(route)}`,
    { waitUntil: "networkidle" },
  );
  await expect(page.locator(".rd-mode main")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.runeQa));
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() => page.locator(".rd-mode main").innerText())
    .not.toBe("");
  await expect(
    page.getByText("Preparing your hero…", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() => page.locator(".rd-mode main .skeleton-shimmer").count())
    .toBe(0);
}
async function setup(width = 390, height = 844) {
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await installRuneFixture(page);
  return page;
}
async function noOverflow(page, label) {
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.body.scrollWidth <= innerWidth + 1,
    ),
    `${label} has no horizontal page overflow`,
  );
}
async function fits(page, locator, label, min = 0) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert.ok(
    rect &&
      rect.x >= -1 &&
      rect.x + rect.width <= viewport.width + 1 &&
      rect.y >= -1 &&
      rect.y + rect.height <= viewport.height + 1,
    label + " fits the viewport",
  );
  if (min)
    assert.ok(
      rect.width >= min - 1 && rect.height >= min - 1,
      label + ` is at least ${min}px`,
    );
}
async function movePager(pager, direction, label) {
  const before = Number(await pager.getAttribute("data-page"));
  const button = pager.getByRole("button", {
    name: `${direction === 1 ? "Next" : "Previous"} ${label.toLowerCase()} page`,
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(pager).toHaveAttribute("data-page", String(before + direction));
}
async function revealPagedItem(page, item, label) {
  if (await item.isVisible()) return item;
  const pager = page.getByRole("navigation", {
    name: `${label} pages`,
    exact: true,
  });
  await expect(pager).toBeVisible();
  const count = Number(await pager.getAttribute("data-page-count"));
  assert.ok(count > 1 && count <= 100, `${label}: finite page count`);
  while (Number(await pager.getAttribute("data-page")) > 0)
    await movePager(pager, -1, label);
  for (let index = 0; index < count; index++) {
    if (await item.isVisible()) return item;
    if (index + 1 < count) await movePager(pager, 1, label);
  }
  assert.fail(`${label}: requested item is reachable through its pages`);
}
async function draftIds(page, kind, label) {
  const pager = page.getByRole("navigation", {
    name: `${label} pages`,
    exact: true,
  });
  const paged = await pager.count();
  if (paged)
    while (Number(await pager.getAttribute("data-page")) > 0)
      await movePager(pager, -1, label);
  const count = paged ? Number(await pager.getAttribute("data-page-count")) : 1;
  const ids = [];
  for (let index = 0; index < count; index++) {
    const choices = page.locator(`[data-testid^="expedition-${kind}-"]`);
    await expect(choices.first()).toBeVisible();
    ids.push(
      ...(await choices.evaluateAll((nodes) =>
        nodes.map((node) =>
          node.dataset.testid.replace(/^expedition-(boon|route)-/, ""),
        ),
      )),
    );
    if (index + 1 < count) await movePager(pager, 1, label);
  }
  assert.equal(
    new Set(ids).size,
    ids.length,
    `${kind}: every offered choice appears exactly once across pages`,
  );
  return ids;
}
async function readPreviewPages(dialog, label) {
  const pager = dialog.getByRole("navigation", {
    name: `${label} pages`,
    exact: true,
  });
  if (!(await pager.count())) return;
  while (Number(await pager.getAttribute("data-page")) > 0)
    await movePager(pager, -1, label);
  const count = Number(await pager.getAttribute("data-page-count"));
  for (let index = 0; index < count; index++) {
    await expect(dialog.locator(".rd-dialog-body")).not.toHaveText("");
    if (index + 1 < count) await movePager(pager, 1, label);
  }
}
async function dismissIntroductions(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const introduction = page
      .getByRole("dialog")
      .filter({
        has: page.getByRole("button", {
          name: /^(Face the Boss|Begin Level \d+|Ready to delve)/,
        }),
      })
      .last();
    if (await introduction.isVisible()) {
      const help = introduction.getByRole("button", {
        name: "Ready to delve",
        exact: true,
      });
      await readPreviewPages(
        introduction,
        (await help.count()) ? "How to play" : "Encounter introduction",
      );
      // Bind this mounted dialog: a second introduction may open immediately
      // and the broad role locator would otherwise resolve to that new dialog.
      const confirmedIntroduction = await introduction.elementHandle();
      assert.ok(confirmedIntroduction, "The confirmed introduction is mounted");
      try {
        await introduction
          .getByRole("button", {
            name: /^(Face the Boss|Begin Level \d+|Ready to delve)/,
          })
          .click();
        await confirmedIntroduction.waitForElementState("hidden");
      } finally {
        await confirmedIntroduction.dispose();
      }
      continue;
    }
    const bargain = page.getByRole("dialog", {
      name: "Pick your edge.",
      exact: true,
    });
    if (await bargain.isVisible()) {
      await readPreviewPages(bargain, "Chamber bargains");
      await bargain.getByRole("button", { name: /^◇ Steady Path/ }).click();
      await expect(bargain).toBeHidden();
      continue;
    }
    const path = page.getByRole("dialog", {
      name: "Choose your path.",
      exact: true,
    });
    if (await path.isVisible()) {
      await readPreviewPages(path, "Milestone paths");
      const pager = path.getByRole("navigation", {
        name: "Milestone paths pages",
        exact: true,
      });
      while (Number(await pager.getAttribute("data-page")) > 0)
        await movePager(pager, -1, "Milestone paths");
      await path
        .getByRole("button", { name: "Choose Standard Path", exact: true })
        .click();
      await expect(path).toBeHidden();
      continue;
    }
    return;
  }
  assert.fail(
    "Introductions close through explicit UI choices within a bounded number of dialogs",
  );
}
async function chooseTapPath(page) {
  await dismissIntroductions(page);
  await page.getByRole("button", { name: "Tap", exact: true }).click();
  const cells = await page
    .locator("button[data-rune-cell]")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        r: Number(node.dataset.r),
        c: Number(node.dataset.c),
        type: node.getAttribute("aria-label"),
        sealed: node.disabled,
      })),
    );
  const search = (path) => {
    if (path.length >= 3) return path;
    const last = path[path.length - 1];
    for (const next of cells) {
      if (next.sealed || next.type !== last.type || path.includes(next))
        continue;
      if (Math.abs(next.r - last.r) <= 1 && Math.abs(next.c - last.c) <= 1) {
        const result = search([...path, next]);
        if (result) return result;
      }
    }
    return null;
  };
  for (const cell of cells) {
    const path = search([cell]);
    if (path) {
      for (const current of path)
        await page
          .locator(`button[data-r="${current.r}"][data-c="${current.c}"]`)
          .click();
      return path;
    }
  }
  throw new Error("No valid three-rune path in QA board");
}
async function checkDailyArena() {
  const page = await setup();
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await go(page, "/rune-delve/endless");
  await expect(
    page.getByRole("button", { name: "Begin arena", exact: true }),
  ).toBeVisible();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  await page.getByRole("button", { name: "Begin arena", exact: true }).click();
  await expect(page.locator("button[data-rune-cell]")).toHaveCount(25);
  const initialArenaKey = await page.evaluate(() =>
    Object.keys(sessionStorage).find((key) => key.startsWith("rd-arena-v1:")),
  );
  await page
    .getByRole("button", { name: /^Inspect / })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const beforeInspect = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    initialArenaKey,
  );
  await page.clock.runFor(5000);
  const afterInspect = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    initialArenaKey,
  );
  assert.equal(
    afterInspect.elapsed,
    beforeInspect.elapsed,
    "Enemy inspection freezes active-play time",
  );
  assert.equal(
    afterInspect.combat.hp,
    beforeInspect.combat.hp,
    "Enemy inspection prevents timer damage",
  );
  await expect(page.locator("button[data-rune-cell]").first()).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("button[data-rune-cell]").first()).toBeEnabled();
  await chooseTapPath(page);
  await page
    .getByRole("button", { name: "Cast", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  const arenaKey = await page.evaluate(() =>
    Object.keys(sessionStorage).find((key) => key.startsWith("rd-arena-v1:")),
  );
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(sessionStorage.getItem(key)).tick,
        arenaKey,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
  const paused = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    arenaKey,
  );
  await page.clock.runFor(5000);
  const afterPause = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    arenaKey,
  );
  assert.equal(
    afterPause.elapsed,
    paused.elapsed,
    "Paused arena does not spend active-play time",
  );
  assert.equal(
    afterPause.combat.hp,
    paused.combat.hp,
    "Paused arena does not take timer damage",
  );
  await page
    .getByRole("button", { name: "Resume arena", exact: true })
    .last()
    .click();
  await page.clock.runFor(200);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByText("Arena paused · your run is saved.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    }),
  );
  // A controlled full-mana checkpoint tests the synchronous action lock;
  // encounter balance remains covered by engine simulations.
  await page.addInitScript((key) => {
    if (sessionStorage.getItem("__rune-qa-next-arena") !== "mana") return;
    sessionStorage.removeItem("__rune-qa-next-arena");
    const run = JSON.parse(sessionStorage.getItem(key));
    run.savedAt = Date.now();
    run.combat.mana = 3;
    run.combat.enemies = run.combat.enemies.map((enemy, index) =>
      index === 0 ? { ...enemy, hp: 200, maxHp: 200 } : enemy,
    );
    sessionStorage.setItem(key, JSON.stringify(run));
  }, arenaKey);
  await page.evaluate(() =>
    sessionStorage.setItem("__rune-qa-next-arena", "mana"),
  );
  await page.clock.resume();
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByText("Arena paused · your run is saved.", { exact: true }),
  ).toBeVisible();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  await page
    .getByRole("button", { name: "Resume arena", exact: true })
    .last()
    .click();
  const beforeAbility = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)).combat.totalDamage,
    arenaKey,
  );
  await page
    .getByRole("button", { name: /^Cleave\. Ready to cast/ })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  const afterAbility = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    arenaKey,
  );
  assert.equal(afterAbility.combat.mana, 0, "Ability spends mana once");
  assert.equal(
    afterAbility.combat.totalDamage - beforeAbility,
    40,
    "Rapid repeated ability click resolves one class attack",
  );
  // Complete a seeded timer boundary without waiting two wall-clock minutes.
  await page.addInitScript((key) => {
    const marker = sessionStorage.getItem("__rune-qa-next-arena");
    if (!marker?.startsWith("timeout:")) return;
    const kills = Number(marker.split(":")[1]);
    sessionStorage.removeItem("__rune-qa-next-arena");
    const run = JSON.parse(sessionStorage.getItem(key));
    run.savedAt = Date.now();
    run.elapsed = 119.9;
    run.attackAt = 122;
    run.paused = true;
    run.combat.enemiesDefeated = kills;
    run.combat.totalDamage = 800;
    sessionStorage.setItem(key, JSON.stringify(run));
  }, arenaKey);
  await page.evaluate(() =>
    sessionStorage.setItem("__rune-qa-next-arena", "timeout:12"),
  );
  await page.clock.resume();
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByText("Arena paused · your run is saved.", { exact: true }),
  ).toBeVisible();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  await page.evaluate(() =>
    window.runeQa.failRpc.push("rune_delve_save_daily"),
  );
  await page
    .getByRole("button", { name: "Resume arena", exact: true })
    .last()
    .click();
  await page.clock.runFor(500);
  await page.clock.resume();
  await expect(page.getByRole("button", { name: "Retry save", exact: true }))
    .toBeVisible()
    .catch(async (error) => {
      console.log(
        "ARENA DEBUG",
        await page.locator("body").innerText(),
        await page.evaluate(
          (key) => ({
            run: sessionStorage.getItem(key),
            rpcs: window.runeQa.rpcs,
          }),
          arenaKey,
        ),
      );
      throw error;
    });
  assert.ok(
    await page.evaluate((key) => sessionStorage.getItem(key), arenaKey),
    "Failed arena save retains finished checkpoint",
  );
  await page.evaluate(() => {
    window.runeQa.failRpc = [];
  });
  await page
    .getByRole("button", { name: "Retry save", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(page.getByText(/\+\d+ shards · \+\d+ XP/)).toBeVisible();
  await expect(
    page.getByText("+250 shards · +120 XP", { exact: true }),
  ).toBeVisible();
  const requests = await page.evaluate(() =>
    window.runeQa.rpcs.filter((call) => call.name === "rune_delve_save_daily"),
  );
  assert.equal(
    requests.length,
    2,
    "One failed request plus one retry despite rapid repeat click",
  );
  assert.equal(
    requests[0].args.p_request_id,
    requests[1].args.p_request_id,
    "Arena retry reuses idempotency key",
  );
  assert.equal(
    await page.evaluate(
      () =>
        window.runeQa.writes.filter((write) => write.table === "atomic-daily")
          .length,
    ),
    1,
    "Daily award has one successful transaction",
  );
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), arenaKey),
    null,
    "Confirmed arena result releases checkpoint",
  );
  await page
    .getByRole("link", { name: "Return to daily arena", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Improve today's best", exact: true }),
  ).toBeVisible();
  let priorRequestId = requests[0].args.p_request_id;
  for (const [kills, reward] of [
    [15, "+150 shards · +30 XP"],
    [4, "Best retained · reach a higher tier for more rewards"],
  ]) {
    await page
      .getByRole("link", { name: "Improve today's best", exact: true })
      .click();
    const begin = page.getByRole("button", {
      name: "Improve today's best",
      exact: true,
    });
    await expect(begin).toBeEnabled();
    await page.clock.pauseAt(
      new Date((await page.evaluate(() => Date.now())) + 1000),
    );
    await begin.click();
    const nextRequestId = await page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key)).requestId,
      arenaKey,
    );
    assert.notEqual(
      nextRequestId,
      priorRequestId,
      "A new Arena attempt has a fresh receipt key",
    );
    await page.evaluate(
      (kills) =>
        sessionStorage.setItem("__rune-qa-next-arena", `timeout:${kills}`),
      kills,
    );
    await page.clock.resume();
    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByText("Arena paused · your run is saved.", { exact: true }),
    ).toBeVisible();
    await page.clock.pauseAt(
      new Date((await page.evaluate(() => Date.now())) + 1000),
    );
    await page
      .getByRole("button", { name: "Resume arena", exact: true })
      .last()
      .click();
    await page.clock.runFor(500);
    await page.clock.resume();
    await expect(page.getByText(reward, { exact: true })).toBeVisible();
    const improvement = await page.evaluate(() => ({
      requests: window.runeQa.rpcs.filter(
        (call) => call.name === "rune_delve_save_daily",
      ),
      daily: window.runeQa.tables.rune_delve_daily_runs.find(
        (row) => row.user_id === "member",
      ),
    }));
    assert.equal(improvement.requests.length, 1, "Each replay settles once");
    assert.equal(
      improvement.requests[0].args.p_request_id,
      nextRequestId,
      "Saved replay uses its own receipt key",
    );
    assert.equal(
      improvement.daily.kills_count,
      15,
      "A lower replay cannot replace the daily best",
    );
    assert.equal(
      improvement.daily.reward_shards_awarded,
      400,
      "The daily total pays the best tier once",
    );
    assert.equal(
      improvement.daily.reward_xp_awarded,
      150,
      "XP pays only the daily best improvement",
    );
    priorRequestId = nextRequestId;
    await page
      .getByRole("link", { name: "Return to daily arena", exact: true })
      .click();
  }
  await page.close();
}
try {
  if (!process.env.RUNE_QA_INTERACTIONS_ONLY) {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [844, 390],
      [1440, 900],
    ]) {
      for (const theme of ["light", "dark"]) {
        const page = await setup(width, height);
        for (const [name, route, scenario = "full"] of routes) {
          console.log("Checking", width + "×" + height, theme, name);
          await go(page, route, theme, scenario);
          await noOverflow(page, name);
          await expect(
            page.getByRole("heading", { name: "App destination reached" }),
          ).toHaveCount(0);
          if (name === "home") {
            assert.ok(
              await page
                .locator(".rd-sanctum img")
                .evaluate((image) => image.complete && image.naturalWidth > 0),
              "Sanctum artwork decodes",
            );
            assert.notEqual(
              await page
                .locator(".rd-hero-art")
                .first()
                .evaluate((el) => getComputedStyle(el).backgroundImage),
              "none",
              "Hero portrait atlas is applied",
            );
          }
          if (!["combat", "expedition", "arena"].includes(name)) {
            await fits(
              page,
              page.getByRole("button", { name: "Sound settings", exact: true }),
              "Header sound control",
              44,
            );
            await fits(
              page,
              page.getByRole("button", { name: "Open Codex", exact: true }),
              "Header Codex control",
              44,
            );
            await fits(
              page,
              page.getByRole("navigation", {
                name: "Rune Delve navigation",
                exact: true,
              }),
              "Game navigation",
            );
          }
          if (name === "combat") {
            await expect(page.locator("button[data-rune-cell]")).toHaveCount(
              25,
            );
            const cell = page.locator("button[data-rune-cell]").first();
            await fits(page, cell, "Rune tile", 44);
          }
          await page.evaluate(() => document.body.scrollTo(0, 0));
          await page.screenshot({
            path: join(output, `${width}-${height}-${theme}-${name}.png`),
          });
          if (name === "shop") {
            await page.getByRole("button", { name: /^Ember Edge\./ }).click();
            const dialog = page.getByRole("dialog", {
              name: "Ember Edge",
              exact: true,
            });
            await expect(dialog).toBeVisible();
            await fits(page, dialog, "Relic upgrade sheet");
            await fits(
              page,
              dialog.getByRole("button", { name: /^Upgrade to R2/ }),
              "Upgrade action",
              44,
            );
            await page.screenshot({
              path: join(output, `${width}-${height}-${theme}-upgrade.png`),
            });
            await page.keyboard.press("Escape");
          }
          if (name === "home") {
            await go(page, "/rune-delve", theme, "new");
            await expect(page.getByTestId("rune-forge")).toBeVisible();
            await noOverflow(page, "Hero creation");
            for (const cls of ["Warrior", "Mage", "Rogue", "Cleric"])
              await fits(
                page,
                page.getByRole("button", {
                  name: `Choose ${cls}`,
                  exact: true,
                }),
                cls + " portrait choice",
                44,
              );
            await page.evaluate(() => document.body.scrollTo(0, 0));
            await page.screenshot({
              path: join(output, `${width}-${height}-${theme}-forge.png`),
            });
          }
          if (name === "arena") {
            await page
              .getByRole("button", { name: "Begin arena", exact: true })
              .click();
            await expect(page.locator("button[data-rune-cell]")).toHaveCount(
              25,
            );
            await fits(
              page,
              page.locator("button[data-rune-cell]").first(),
              "Arena rune tile",
              44,
            );
            await noOverflow(page, "Arena combat");
            await page.screenshot({
              path: join(
                output,
                `${width}-${height}-${theme}-arena-combat.png`,
              ),
            });
            await page
              .getByRole("button", { name: "Pause arena", exact: true })
              .click();
          }
        }
        await page.close();
      }
    }
  }

  const page = await setup();
  await go(page, "/rune-delve/__qa/board");
  await expect(page.getByTestId("rune-board-harness")).toBeVisible();
  await chooseTapPath(page);
  await page.getByRole("button", { name: "Cast", exact: true }).click();
  await expect(page.getByTestId("qa-chain-count")).toHaveText("1");
  await expect(
    page.locator('button[data-rune-cell][aria-pressed="true"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Drag", exact: true }).click();
  const coords = await page
    .locator('button[data-r="0"][data-c="0"]')
    .boundingBox();
  await page.mouse.move(
    coords.x + coords.width / 2,
    coords.y + coords.height / 2,
  );
  await page.mouse.down();
  for (const col of [1, 2]) {
    const rect = await page
      .locator(`button[data-r="0"][data-c="${col}"]`)
      .boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  }
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent("pointercancel")),
  );
  await page.mouse.up();
  await expect(page.getByTestId("qa-chain-count")).toHaveText("1");
  await expect(
    page.locator('button[data-rune-cell][aria-pressed="true"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Tap", exact: true }).click();
  await chooseTapPath(page);
  await page
    .getByRole("button", { name: "Clear selected runes", exact: true })
    .click();
  await expect(
    page.locator('button[data-rune-cell][aria-pressed="true"]'),
  ).toHaveCount(0);
  await expect(page.getByTestId("qa-chain-count")).toHaveText("1");

  await go(page, "/rune-delve/play/1");
  await expect(page.locator("button[data-rune-cell]")).toHaveCount(25);
  await chooseTapPath(page);
  await page.getByRole("button", { name: "Cast", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.entries(sessionStorage).some(
          ([key, value]) =>
            key.startsWith("rd-run:") &&
            JSON.parse(value).chainCountTotal === 1,
        ),
      ),
    )
    .toBe(true);
  const stored = await page.evaluate(() =>
    Object.entries(sessionStorage).find(([key]) => key.startsWith("rd-run:")),
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("button[data-rune-cell]")).toHaveCount(25);
  const restored = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key)),
    stored[0],
  );
  assert.equal(
    restored.chainCountTotal,
    1,
    "Campaign resumes exactly one committed chain",
  );
  assert.equal(
    restored.combat.turnsRemaining,
    JSON.parse(stored[1]).combat.turnsRemaining,
    "Campaign turn budget persists",
  );

  await go(page, "/rune-delve/expedition");
  await expect(page.getByTestId("expedition-start")).toBeVisible();
  await fits(
    page,
    page.getByTestId("expedition-start"),
    "Start expedition",
    44,
  );
  await expect(
    page.getByRole("button", { name: "Ascension 2, locked", exact: true }),
  ).toBeDisabled();
  await page.getByTestId("expedition-start").click();
  await expect(page.getByTestId("expedition-combat")).toBeVisible();
  await chooseTapPath(page);
  await page.getByRole("button", { name: "Cast", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("rd-expedition:v1:member:club"))
            ?.totalTurns,
      ),
    )
    .toBe(1);
  const expeditionCheckpoint = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("rd-expedition:v1:member:club")),
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByRole("dialog", { name: "Expedition paused", exact: true }),
  ).toBeVisible();
  await fits(page, page.getByTestId("expedition-resume"), "Resume action", 44);
  await page.getByTestId("expedition-resume").click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("rd-expedition:v1:member:club"))
          .totalTurns,
    ),
    1,
    "Expedition keeps committed turn after reload",
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("rd-expedition:v1:member:club")).combat
          .hp,
    ),
    expeditionCheckpoint.combat.hp,
    "Expedition keeps HP after reload",
  );
  // A controlled completed-room checkpoint tests postcombat UI and transport;
  // the actual difficulty curve is tested separately by the engine simulation.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("__rune-qa-next-boon") !== "1") return;
    sessionStorage.removeItem("__rune-qa-next-boon");
    const run = JSON.parse(
      localStorage.getItem("rd-expedition:v1:member:club"),
    );
    run.phase = "boon";
    run.roomsCleared = 1;
    run.score = 220;
    run.combat.enemies = run.combat.enemies.map((enemy) => ({
      ...enemy,
      hp: 0,
    }));
    localStorage.setItem("rd-expedition:v1:member:club", JSON.stringify(run));
  });
  await page.evaluate(() => sessionStorage.setItem("__rune-qa-next-boon", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("expedition-resume").click();
  await expect(page.getByTestId("expedition-boons")).toBeVisible();
  const offeredBoons = await draftIds(page, "boon", "Blessings");
  assert.equal(
    offeredBoons.length,
    3,
    "Every blessing draft offers three choices across its pages",
  );
  const boon = page.getByTestId(`expedition-boon-${offeredBoons[0]}`);
  await revealPagedItem(page, boon, "Blessings");
  await fits(page, boon, "Boon choice", 44);
  await page.screenshot({ path: join(output, "390-844-dark-boon.png") });
  await boon.click();
  await expect(page.getByTestId("expedition-routes")).toBeVisible();
  await expect(page.locator('[data-testid^="expedition-route-"]')).toHaveCount(
    2,
  );
  await page.screenshot({ path: join(output, "390-844-dark-paths.png") });
  await page.locator('[data-testid^="expedition-route-"]').first().click();
  await expect(page.getByTestId("expedition-combat")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chamber 2", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(
          JSON.parse(localStorage.getItem("rd-expedition:v1:member:club"))
            .boons,
        ).length,
    ),
    1,
    "Chosen blessing persists into next room",
  );
  await page
    .getByRole("button", { name: "Your expedition build", exact: true })
    .click();
  await fits(
    page,
    page.getByRole("dialog", { name: "Your expedition build", exact: true }),
    "Build overlay",
  );
  await page.getByRole("button", { name: "Close build", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause expedition", exact: true })
    .click();
  await page.getByRole("button", { name: /^Retreat · bank/ }).click();
  await expect(page.getByTestId("expedition-summary")).toBeVisible();
  await page.evaluate(() =>
    window.runeQa.failRpc.push("rune_delve_expedition_finish"),
  );
  await page.getByTestId("expedition-bank").click();
  await expect(page.getByRole("alert")).toBeVisible();
  assert.ok(
    await page.evaluate(() =>
      localStorage.getItem("rd-expedition:v1:member:club"),
    ),
    "Failed bank retains checkpoint for safe retry",
  );
  await page
    .getByRole("button", { name: "Back to expedition", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Expedition update", exact: true }),
  ).toBeHidden();
  await page.evaluate(() => {
    window.runeQa.failRpc = [];
  });
  await page.getByTestId("expedition-bank").click();
  await expect(
    page.getByRole("button", { name: "Another expedition", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () =>
        window.runeQa.writes.filter(
          (write) => write.table === "expedition-finish",
        ).length,
    ),
    1,
    "One successful reward receipt",
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("rd-expedition:v1:member:club"),
    ),
    null,
    "Banked run releases device checkpoint",
  );

  await go(page, "/rune-delve/armory");
  await noOverflow(page, "Armory");
  await page.getByRole("tab", { name: /^Collection/ }).click();
  await revealPagedItem(
    page,
    page.getByRole("button", { name: /^Ember Edge\./ }),
    "Relics",
  );
  await page.getByRole("button", { name: /^Ember Edge\./ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.runeQa.tables.rune_delve_loadouts.find(
            (row) => row.class === "warrior",
          )?.slot_1,
      ),
    )
    .toBe("ember_edge");
  await expect(
    page.getByRole("button", { name: /^Ember Edge\./ }),
  ).toHaveAttribute("data-state", "equipped");
  await page
    .getByRole("combobox", { name: "Loadout class", exact: true })
    .selectOption("mage");
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Mage loadout", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Collection/ }).click();
  await revealPagedItem(
    page,
    page.getByRole("button", { name: /^Ember Edge\./ }),
    "Relics",
  );
  await expect(
    page.getByRole("button", { name: /^Ember Edge\./ }),
  ).toHaveAttribute("data-state", "owned");
  await page
    .getByRole("combobox", { name: "Loadout class", exact: true })
    .selectOption("warrior");
  await revealPagedItem(
    page,
    page.getByRole("button", { name: /^Ember Edge\./ }),
    "Relics",
  );
  await expect(
    page.getByRole("button", { name: /^Ember Edge\./ }),
  ).toHaveAttribute("data-state", "equipped");
  await go(page, "/rune-delve/shop");
  await noOverflow(page, "Shop");
  await page
    .getByRole("combobox", { name: "Relic tier", exact: true })
    .selectOption("1");
  await page
    .getByRole("combobox", { name: "Relic category", exact: true })
    .selectOption("all");
  await revealPagedItem(
    page,
    page.getByRole("button", { name: /^Keysight\./ }),
    "Relics",
  );
  await page.evaluate(() => window.runeQa.failRpc.push("rune_delve_buy_relic"));
  await page.getByRole("button", { name: /^Keysight\./ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.runeQa.rpcs.filter(
            (call) => call.name === "rune_delve_buy_relic",
          ).length,
      ),
    )
    .toBe(1);
  assert.equal(
    await page.evaluate(() => window.runeQa.tables.rune_delve_wallet[0].shards),
    2400,
    "Failed purchase does not debit wallet",
  );
  await page.evaluate(() => {
    window.runeQa.failRpc = [];
  });
  await page.getByRole("button", { name: /^Keysight\./ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.runeQa.tables.rune_delve_wallet[0].shards),
    )
    .toBe(2280);
  await expect(
    page.getByRole("button", { name: /^Keysight\./ }),
  ).toHaveAttribute("data-state", "owned");
  await page.getByRole("button", { name: /^Keysight\./ }).click();
  const upgrade = page.getByRole("dialog", { name: /Keysight$/ });
  await expect(upgrade).toBeVisible();
  await readPreviewPages(upgrade, "Relic comparison");
  await upgrade.getByRole("button", { name: /^Upgrade to R2/ }).click();
  await expect(upgrade).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.runeQa.tables.rune_delve_relic_unlocks.find(
            (row) => row.relic_id === "keysight",
          )?.rank,
      ),
    )
    .toBe(2);
  assert.equal(
    await page.evaluate(
      () =>
        window.runeQa.rpcs.filter((call) =>
          /rune_delve_(spend|earn)_shards/.test(call.name),
        ).length,
    ),
    0,
    "Shop uses atomic purchases with no separate debit/refund",
  );
  await page
    .getByRole("combobox", { name: "Relic tier", exact: true })
    .selectOption("2");
  await expect(
    page.getByText("Unlocks in Chapter 2", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".rd-relic-tile").first()).toBeDisabled();
  await go(page, "/rune-delve/shop", "dark", "offline");
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.runeQa.failTables = [];
  });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Relic Forge", exact: true }),
  ).toBeVisible();
  await go(page, "/rune-delve", "dark", "offline");
  await expect(page.getByRole("alert")).toHaveText(
    /The sanctum couldn’t connect/,
  );
  await page.evaluate(() => {
    window.runeQa.failTables = [];
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("rune-home")).toBeVisible();
  await fits(
    page,
    page.getByRole("link", { name: "Enter Expedition", exact: true }),
    "Expedition primary action",
    44,
  );
  await fits(
    page,
    page.getByRole("link", { name: "Continue campaign", exact: true }),
    "Campaign action",
    44,
  );
  await go(page, "/rune-delve", "light", "new");
  await expect(page.getByTestId("rune-forge")).toBeVisible();
  await page.getByRole("button", { name: "Choose Mage", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose Mage", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Hero name", exact: true })
    .fill("Elara");
  await page.evaluate(() => window.runeQa.failTables.push("rune_delve_heroes"));
  await page
    .getByRole("button", { name: "Enter the sanctum", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Hero name", exact: true }),
  ).toHaveValue("Elara");
  await page.evaluate(() => {
    window.runeQa.failTables = [];
  });
  await page
    .getByRole("button", { name: "Enter the sanctum", exact: true })
    .click();
  await expect(page.getByTestId("rune-home")).toBeVisible();
  assert.equal(
    await page.evaluate(
      () =>
        window.runeQa.tables.rune_delve_heroes.find(
          (row) => row.user_id === "member",
        )?.class,
    ),
    "mage",
    "Hero class saved",
  );
  await page.close();
  await checkDailyArena();
  assert.deepEqual(errors, [], "No uncaught runtime errors");
  console.log(
    process.env.RUNE_QA_INTERACTIONS_ONLY
      ? "PASS interactions:"
      : "PASS five viewports/both themes and interactions:",
    "strict-mode single chain commit, pointer cancel, checkpoint restore, class equipment, atomic purchases/upgrades, tier gating, error recovery, hero creation, Expedition blessings/routes/reward retry, Daily Arena inspection/pause/rapid actions/save retry and daily-best reward improvements.",
  );
} finally {
  await browser.close();
}
