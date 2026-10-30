// Actual complete encounters: every chain, ability, blessing and route uses
// production UI controls. Only identity/data/awards are browser-local fixtures.
// RUNE_QA_URL=http://127.0.0.1:8087 node scripts/check-rune-journeys.mjs
// Optional: RUNE_QA_CAMPAIGN_LEVELS=1,25,50,75,100,125,150
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installRuneFixture } from "./rune-fixture.mjs";

const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8087";
const output = await mkdtemp(join(tmpdir(), "rune-journeys-"));
const browser = await chromium.launch({
  executablePath: process.env.RUNE_QA_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [],
  report = [];
const classes = ["warrior", "mage", "rogue", "cleric"];
const expeditionKey = "rd-expedition:v1:member:club";
console.log("Journey artifacts:", output);
async function setup() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(12_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await installRuneFixture(page);
  return page;
}
async function go(page, route, cls = "warrior") {
  const query = new URLSearchParams({
    route,
    class: cls,
    completed: "149",
    theme: "dark",
  });
  await page.goto(`${base}/scripts/fixtures/rune.html?${query}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => Boolean(window.runeQa));
  await expect(page.locator(".rd-mode main")).toBeVisible();
}
async function dismissIntroductions(page) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const introduction = page
      .getByRole("dialog")
      .getByRole("button", {
        name: /^(Face the Boss|Begin Level \d+|Ready to delve)/,
      })
      .last();
    if (await introduction.isVisible()) {
      await introduction.click();
      continue;
    }
    const steady = page.getByRole("button", { name: /^◇ Steady Path/ });
    if (await steady.isVisible()) {
      await steady.click();
      continue;
    }
    break;
  }
}
async function perform(page, action, keyboard = false) {
  if (action.kind === "ability") {
    const ability = page.getByRole("button", { name: /\. Ready to cast/ });
    await expect(ability).toBeEnabled();
    await ability.click();
    return;
  }
  await page.getByRole("button", { name: "Tap", exact: true }).click();
  for (const { r, c } of action.cells) {
    const cell = page.locator(`button[data-r="${r}"][data-c="${c}"]`);
    if (keyboard) {
      await cell.focus();
      await page.keyboard.press("Space");
    } else await cell.click();
  }
  await expect(
    page.locator('button[data-rune-cell][aria-pressed="true"]'),
  ).toHaveCount(action.cells.length);
  const cast = page.getByRole("button", { name: "Cast", exact: true });
  await expect(cast).toBeEnabled();
  if (keyboard) {
    await cast.focus();
    await page.keyboard.press("Enter");
  } else await cast.click();
}
async function campaignState(page, level) {
  return page.evaluate((level) => {
    const entry = Object.entries(sessionStorage).find(
      ([key, raw]) =>
        key.startsWith("rd-run:") && JSON.parse(raw).levelNumber === level,
    );
    return entry
      ? { key: entry[0], raw: entry[1], run: JSON.parse(entry[1]) }
      : null;
  }, level);
}
async function campaignEncounter(
  level,
  cls,
  policy = "win",
  retrySave = false,
) {
  const page = await setup();
  try {
    await go(page, `/rune-delve/play/${level}`, cls);
    await expect(page.locator("button[data-rune-cell]").first()).toBeVisible();
    await dismissIntroductions(page);
    if (retrySave)
      await page.evaluate(() =>
        window.runeQa.failRpc.push("rune_delve_save_run"),
      );
    let actions = 0;
    for (; actions < 220; actions++) {
      if (
        await page
          .getByRole("button", {
            name: /^(View Results|Retry save|Saving your run…)/,
          })
          .isVisible()
      )
        break;
      await dismissIntroductions(page);
      const before = await campaignState(page, level);
      assert.ok(before, `Campaign ${level} has an active checkpoint`);
      const action = await page.evaluate(
        async ({ run, cls, policy }) => {
          const driver = await import("/scripts/fixtures/rune-driver.ts");
          return driver.campaignAction(run, cls, policy);
        },
        { run: before.run, cls, policy },
      );
      await perform(page, action, level === 1 && actions === 0);
      await expect
        .poll(
          async () => {
            if (
              await page
                .getByRole("button", {
                  name: /^(View Results|Retry save|Saving your run…)/,
                })
                .isVisible()
            )
              return true;
            const after = await campaignState(page, level);
            return (
              !!after &&
              (after.run.chainCountTotal !== before.run.chainCountTotal ||
                after.run.abilityUsedCount !== before.run.abilityUsedCount)
            );
          },
          { message: `Campaign ${level} action ${actions + 1} commits` },
        )
        .toBe(true);
    }
    assert.ok(actions < 220, `Campaign ${level} reaches a terminal state`);
    const summary = page
      .getByRole("dialog")
      .filter({
        has: page.getByRole("button", {
          name: /^(View Results|Retry save|Saving your run…)/,
        }),
      });
    await expect(summary).toBeVisible();
    const reason = await summary.getByRole("heading").innerText();
    if (policy === "win")
      assert.match(
        reason,
        /Cleared/,
        "Campaign encounter is won through actual controls",
      );
    if (policy !== "win")
      assert.doesNotMatch(
        reason,
        /Cleared/,
        `Passive ${policy} policy reaches a real failed attempt`,
      );
    if (retrySave) {
      await expect(
        page.getByRole("button", { name: "Retry save", exact: true }),
      ).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(summary).toBeVisible();
      assert.ok(
        await campaignState(page, level),
        "Unconfirmed campaign reward retains its checkpoint",
      );
      assert.equal(
        await page.evaluate(
          () => window.runeQa.tables.rune_delve_wallet[0].shards,
        ),
        2400,
        "Failed save awards no currency",
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
    }
    await expect(
      page.getByRole("button", { name: "View Results", exact: true }),
    ).toBeEnabled();
    const settlement = await page.evaluate(() => ({
      calls: window.runeQa.rpcs.filter(
        (call) => call.name === "rune_delve_save_run",
      ),
      awards: window.runeQa.writes.filter(
        (write) => write.table === "atomic-run",
      ),
      wallet: window.runeQa.tables.rune_delve_wallet[0],
      tracks: window.runeQa.tables.rune_delve_class_progress,
      results: Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("rd-result-v2:"),
      ),
    }));
    assert.equal(
      settlement.awards.length,
      1,
      "Exactly one campaign settlement",
    );
    assert.equal(
      settlement.calls.length,
      retrySave ? 2 : 1,
      "No duplicate campaign save",
    );
    if (retrySave)
      assert.equal(
        settlement.calls[0].args.p_request_id,
        settlement.calls[1].args.p_request_id,
        "Campaign retry keeps its idempotency key",
      );
    const submission = settlement.calls.at(-1).args.p_run;
    assert.equal(submission.level_number, level);
    assert.equal(submission.hero_class, cls);
    assert.ok(
      submission.turns_used > 0 && submission.longest_chain >= 3,
      "Real action telemetry reaches the save RPC",
    );
    assert.ok(
      settlement.wallet.shards > 2400,
      "Confirmed save credits the wallet",
    );
    assert.ok(
      settlement.results.some(
        ([key, raw]) =>
          key.endsWith(`:${cls}:${level}`) &&
          JSON.parse(raw).dungeonCleared === submission.dungeon_cleared,
      ),
      "Result cache preserves this attempt",
    );
    assert.equal(
      await campaignState(page, level),
      null,
      "Confirmed campaign result clears active checkpoint",
    );
    await page
      .getByRole("button", { name: "View Results", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: submission.dungeon_cleared
          ? "Chamber conquered"
          : submission.hp_remaining <= 0
            ? "Fallen, not finished"
            : "Out of moves",
        exact: true,
      }),
    ).toBeVisible();
    if (level === 150)
      await expect(page.getByRole("button", { name: /^Next/ })).toHaveCount(0);
    await page.screenshot({
      path: join(output, `campaign-${level}-${cls}-${policy}.png`),
      fullPage: true,
    });
    const row = {
      kind: "campaign",
      level,
      cls,
      policy,
      actions,
      reason,
      cleared: submission.dungeon_cleared,
      score: submission.score,
      hp: submission.hp_remaining,
      turns: submission.turns_used,
      saveCalls: settlement.calls.length,
    };
    report.push(row);
    console.log("PASS", JSON.stringify(row));
  } catch (error) {
    await page.screenshot({
      path: join(output, `FAILED-campaign-${level}-${cls}-${policy}.png`),
      fullPage: true,
    });
    console.log(
      "CAMPAIGN DEBUG",
      await page.locator(".rd-mode main").innerText(),
    );
    throw error;
  } finally {
    await page.close();
  }
}
async function expeditionEncounter(cls, policy = "win") {
  const page = await setup();
  try {
    await go(page, "/rune-delve/expedition", cls);
    await expect(page.getByTestId("expedition-start")).toBeEnabled();
    // Expedition class choice is independent from the campaign hero.
    const classChoice = page.getByRole("button", {
      name: new RegExp(`^${cls}$`, "i"),
    });
    if (await classChoice.count()) await classChoice.click();
    await page.getByTestId("expedition-start").click();
    await expect(page.getByTestId("expedition-combat")).toBeVisible();
    let actions = 0,
      boons = 0,
      routes = 0;
    const rooms = new Set();
    while (actions < 250) {
      const before = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        expeditionKey,
      );
      assert.ok(before, "Active expedition has a local checkpoint");
      rooms.add(before.room);
      assert.equal(
        before.heroClass,
        cls,
        "Selected Expedition class is preserved",
      );
      if (before.phase === "won" || before.phase === "lost") break;
      if (before.phase === "boon" || before.phase === "route") {
        const kind = before.phase;
        const options = page.locator(`[data-testid^="expedition-${kind}-"]`);
        const ids = await options.evaluateAll((nodes) =>
          nodes.map((node) =>
            node.dataset.testid.replace(/^expedition-(boon|route)-/, ""),
          ),
        );
        assert.equal(
          ids.length,
          kind === "boon" ? 3 : 2,
          "Every draft offers the expected choice count",
        );
        const selected = await page.evaluate(
          async ({ run, kind, ids }) => {
            const driver = await import("/scripts/fixtures/rune-driver.ts");
            return driver.expeditionDraft(run, kind, ids);
          },
          { run: before, kind, ids },
        );
        await page.getByTestId(`expedition-${kind}-${selected}`).click();
        if (kind === "boon") boons++;
        else routes++;
      } else {
        const action = await page.evaluate(
          async ({ run, policy }) => {
            const driver = await import("/scripts/fixtures/rune-driver.ts");
            return driver.expeditionAction(run, policy);
          },
          { run: before, policy },
        );
        await perform(page, action, actions === 0);
        actions++;
      }
      await expect
        .poll(
          () =>
            page.evaluate(({ key, raw }) => localStorage.getItem(key) !== raw, {
              key: expeditionKey,
              raw: JSON.stringify(before),
            }),
          { message: `Expedition ${cls} commits action/draft ${actions}` },
        )
        .toBe(true);
    }
    assert.ok(actions < 250, "Expedition is bounded");
    await expect(page.getByTestId("expedition-summary")).toBeVisible();
    const final = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      expeditionKey,
    );
    if (policy === "win") {
      assert.equal(
        final.phase,
        "won",
        `${cls} can complete a full six-room Expedition`,
      );
      assert.equal(final.roomsCleared, 6);
      assert.equal(rooms.size, 6, "Every room was visited through UI");
      assert.equal(boons, 5, "Five blessings drafted");
      assert.equal(routes, 5, "Five routes drafted");
    } else
      assert.equal(
        final.phase,
        "lost",
        "Passive policy reaches a real Expedition failure",
      );
    await page.getByTestId("expedition-bank").evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(
      page.getByRole("button", { name: "Another expedition", exact: true }),
    ).toBeVisible();
    const settlement = await page.evaluate(() => ({
      calls: window.runeQa.rpcs.filter(
        (call) => call.name === "rune_delve_expedition_finish",
      ),
      awards: window.runeQa.writes.filter(
        (write) => write.table === "expedition-finish",
      ),
      wallet: window.runeQa.tables.rune_delve_wallet[0],
    }));
    assert.equal(
      settlement.calls.length,
      1,
      "Rapid repeated banking calls one RPC",
    );
    assert.equal(settlement.awards.length, 1, "One confirmed Expedition award");
    assert.equal(settlement.calls[0].args.p_rooms, final.roomsCleared);
    assert.equal(settlement.calls[0].args.p_cleared, policy === "win");
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), expeditionKey),
      null,
      "Banked Expedition clears active checkpoint",
    );
    if (policy === "win")
      await expect(
        page.getByText("Ascension 2 unlocked", { exact: true }),
      ).toBeVisible();
    await page.screenshot({
      path: join(output, `expedition-${cls}-${policy}.png`),
      fullPage: true,
    });
    const row = {
      kind: "expedition",
      cls,
      policy,
      actions,
      boons,
      routes,
      rooms: final.roomsCleared,
      cleared: final.phase === "won",
      hp: final.combat.hp,
      score: final.score,
      awarded: settlement.wallet.shards - 2400,
    };
    report.push(row);
    console.log("PASS", JSON.stringify(row));
  } catch (error) {
    await page.screenshot({
      path: join(output, `FAILED-expedition-${cls}-${policy}.png`),
      fullPage: true,
    });
    console.log(
      "EXPEDITION DEBUG",
      await page.locator(".rd-mode main").innerText(),
      await page.evaluate((key) => localStorage.getItem(key), expeditionKey),
    );
    throw error;
  } finally {
    await page.close();
  }
}
try {
  const levels = (process.env.RUNE_QA_CAMPAIGN_LEVELS || "1,25,150")
    .split(",")
    .map(Number);
  for (const [index, level] of levels.entries())
    await campaignEncounter(
      level,
      classes[index % classes.length],
      "win",
      index === 0,
    );
  await campaignEncounter(1, "cleric", "timeout");
  await campaignEncounter(150, "mage", "defeat");
  for (const cls of classes) await expeditionEncounter(cls);
  await expeditionEncounter("warrior", "defeat");
  assert.deepEqual(
    errors,
    [],
    "No uncaught runtime errors during complete encounters",
  );
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("PASS complete Rune Delve browser journeys", report.length);
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
