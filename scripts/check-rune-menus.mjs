// Secondary menu, onboarding and keyboard QA against real pages. No live data.
// Serve Vite, then: RUNE_QA_URL=http://127.0.0.1:8087 node scripts/check-rune-menus.mjs
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { installRuneFixture } from "./rune-fixture.mjs";

const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8087";
const browser = await chromium.launch({
  executablePath: process.env.RUNE_QA_CHROMIUM || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
async function setup(showHelp = false) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await installRuneFixture(page, { showHelp });
  return page;
}
async function go(
  page,
  route,
  { scenario = "archive", fail = "", theme = "dark" } = {},
) {
  const query = new URLSearchParams({ route, scenario, fail, theme });
  await page.goto(`${base}/scripts/fixtures/rune.html?${query}`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator(".rd-mode main")).toBeVisible();
  await page.waitForFunction(() => Boolean(window.runeQa));
  await expect(
    page.getByRole("heading", { name: "App destination reached" }),
  ).toHaveCount(0);
}
async function keyActivate(page, locator, key = "Enter") {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await expect(locator).toBeFocused();
  await page.keyboard.press(key);
}
function pagerIn(scope, label) {
  return label
    ? scope.getByRole("navigation", { name: label instanceof RegExp ? label : `${label} pages`, exact: true })
    : scope.locator("[data-rune-pager]:visible").first();
}
async function turnPage(page, pager, direction) {
  const before = Number(await pager.getAttribute("data-page"));
  await keyActivate(page, pager.getByRole("button", { name: direction > 0 ? /^Next / : /^Previous / }));
  await expect(pager).toHaveAttribute("data-page", String(before + direction));
}
async function visitPages(page, scope, label, inspect) {
  const pager = pagerIn(scope, label);
  if (!await pager.count()) { await inspect(); return; }
  while (await pager.getByRole("button", { name: /^Previous / }).isEnabled())
    await turnPage(page, pager, -1);
  const count = Number(await pager.getAttribute("data-page-count"));
  for (let index = 0; index < count; index++) {
    await inspect(index);
    if (index + 1 < count) await turnPage(page, pager, 1);
  }
}
/** Find content through the same explicit page buttons as a player. */
async function revealPaged(page, target, scope = page, label) {
  const pager = pagerIn(scope, label);
  await expect.poll(async () => await target.first().isVisible() || await pager.count() > 0).toBe(true);
  if (await target.first().isVisible()) return target.first();
  while (await pager.getByRole("button", { name: /^Previous / }).isEnabled())
    await turnPage(page, pager, -1);
  const count = Number(await pager.getAttribute("data-page-count"));
  for (let index = 0; index < count; index++) {
    if (await target.first().isVisible()) return target.first();
    if (index + 1 < count) await turnPage(page, pager, 1);
  }
  await expect(target.first(), `Content remains reachable through ${label || "explicit"} pages`).toBeVisible();
  return target.first();
}
async function modalKeyboard(page, trigger, name, inspect) {
  await keyActivate(page, trigger);
  const dialog = page.getByRole("dialog", { name, exact: true });
  await expect(dialog).toBeVisible();
  if (inspect) await inspect(dialog);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 3 === 0 ? "Shift+Tab" : "Tab");
    assert.ok(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      `${name} traps keyboard focus`,
    );
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}
async function noOverflow(page, label) {
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        document.body.scrollWidth <= innerWidth + 1,
    ),
    `${label}: no horizontal page overflow`,
  );
}
async function checkRetry(page, route, table, tab) {
  await go(page, route, { fail: table });
  if (tab) await page.getByRole("tab", { name: tab, exact: true }).click();
  const failure = page
    .locator('.rd-mode main [role="alert"], .rd-mode main [role="status"]')
    .filter({ hasText: "The dungeon lost your signal" });
  await expect(failure).toBeVisible();
  const retry = page
    .getByRole("button", { name: /^(Retry|Try again)$/ })
    .first();
  await expect(retry).toBeVisible();
  await page.evaluate(() => {
    window.runeQa.failTables = [];
  });
  await keyActivate(page, retry);
  await expect
    .poll(() => page.evaluate(() => window.runeQueryClient.isFetching()))
    .toBe(0);
  await expect(failure).toHaveCount(0);
  await expect(page.locator(".rd-mode main .skeleton-shimmer")).toHaveCount(0);
  if (route.endsWith("/bestiary")) {
    const name = await page.evaluate(
      async () =>
        (await import("/src/lib/runedelve/enemyRoster.ts")).BESTIARY_ROSTER[0]
          .name,
    );
    await revealPaged(page, page.getByRole("button", { name, exact: true }), page, "Bestiary");
  } else if (route.endsWith("/leaderboard"))
    await revealPaged(page, page.locator(".rd-codex-leader-name > strong").filter({ hasText: "Kael" }), page, "Standings");
  else if (route.endsWith("/quests"))
    await revealPaged(page, page.getByText("Daily Delver", { exact: true }), page, "Daily quest");
  else if (tab === "Levels")
    await revealPaged(page, page.getByRole("article").filter({ hasText: "Level 17" }), page, "Campaign history");
  else {
    const panel = page.getByRole("tabpanel");
    await revealPaged(page, panel.getByRole("article").filter({ hasText: tab === "Daily" ? "3,456" : "Daily Delver" }), panel, tab === "Daily" ? "Daily history" : "Quest history");
    await expect(panel).toContainText(tab === "Daily" ? "3,456" : "Daily Delver");
  }
  console.log("PASS retry", route, tab || "", table);
}
try {
  const page = await setup();
  await go(page, "/rune-delve");
  await modalKeyboard(
    page,
    page.getByRole("button", { name: "Open Codex", exact: true }),
    /Codex$/,
    async (dialog) => {
      for (const [name, id] of [["Guide", "mechanics"], ["Daily", "daily"], ["Masteries", "masteries"], ["Relics", "relics"]]) {
        const tab = dialog.getByRole("tab", { name, exact: true });
        await keyActivate(page, tab, "Space");
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(dialog.getByRole("tabpanel")).toBeVisible();
        await visitPages(page, dialog, `Codex ${id}`, async (index) => {
          assert.ok((await dialog.getByRole("tabpanel").innerText()).trim().length > 20, `${name} page ${index + 1} has content`);
          await noOverflow(page, `Codex ${name} page ${index + 1}`);
        });
      }
      // Radix tabs must also support arrow navigation without a mouse.
      await dialog.getByRole("tab", { name: "Guide", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        dialog.getByRole("tab", { name: "Daily", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    },
  );
  await modalKeyboard(
    page,
    page.getByRole("button", { name: "Sound settings", exact: true }),
    "Sound & Haptics",
    async (dialog) => {
      await expect(dialog.getByRole("switch", { name: "Master Sound", exact: true })).toBeVisible();
      await keyActivate(page, dialog.getByRole("tab", { name: "Effects", exact: true }), "Space");
      for (const name of ["UI & Menus", "Combat", "Rewards", "Ambient & Boot"])
        await expect(dialog.getByRole("switch", { name, exact: true })).toBeVisible();
      await keyActivate(page, dialog.getByRole("tab", { name: "General", exact: true }), "Space");
      await expect(dialog.getByRole("switch", { name: "Background Music", exact: true })).toBeVisible();
    },
  );

  await go(page, "/rune-delve/hero");
  await keyActivate(page, page.getByRole("tab", { name: "Profile", exact: true }));
  await keyActivate(
    page,
    page.getByRole("button", { name: "Rename hero", exact: true }),
  );
  const heroName = page.getByRole("textbox", {
    name: "Hero name",
    exact: true,
  });
  await heroName.fill("M");
  await expect(
    page.getByRole("button", { name: "Save name", exact: true }),
  ).toBeDisabled();
  await heroName.fill("Mira Dawnkeeper");
  await page.evaluate(() => window.runeQa.failTables.push("rune_delve_heroes"));
  await keyActivate(
    page,
    page.getByRole("button", { name: "Save name", exact: true }),
  );
  await expect(heroName).toHaveValue("Mira Dawnkeeper");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.runeQa.queries.some(
          (query) =>
            query.table === "rune_delve_heroes" && query.verb === "update",
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Save name", exact: true }),
  ).toBeEnabled();
  assert.equal(
    await page.evaluate(
      () => window.runeQa.tables.rune_delve_heroes[0].hero_name,
    ),
    "Thalia Stormvein",
    "Failed rename preserves saved identity",
  );
  await page.evaluate(() => {
    window.runeQa.failTables = [];
  });
  await keyActivate(
    page,
    page.getByRole("button", { name: "Save name", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Mira Dawnkeeper", exact: true }),
  ).toBeVisible();
  await keyActivate(
    page,
    page.getByRole("tab", { name: "Classes", exact: true }),
  );
  await keyActivate(page, await revealPaged(page, page.getByRole("button", { name: "Switch to Mage, level 1", exact: true }), page, "Classes"));
  await expect(
    page.getByRole("button", { name: "Active Mage, level 1", exact: true }),
  ).toBeDisabled();
  assert.equal(
    await page.evaluate(
      () =>
        window.runeQa.tables.rune_delve_class_progress.find(
          (track) => track.class === "warrior",
        ).highest_unlocked_level,
    ),
    18,
    "Class switching preserves the previous class campaign",
  );
  assert.equal(
    await page.evaluate(() => window.runeQa.tables.rune_delve_heroes[0].level),
    1,
    "Class switching restores the selected class level",
  );
  await keyActivate(page, await revealPaged(page, page.getByRole("button", { name: "Switch to Warrior, level 8", exact: true }), page, "Classes"));
  await expect(
    page.getByRole("button", { name: "Active Warrior, level 8", exact: true }),
  ).toBeDisabled();
  await keyActivate(
    page,
    page.getByRole("tab", { name: "Legacy", exact: true }),
  );
  await expect(page.getByRole("tab", { name: "Legacy", exact: true })).toHaveAttribute("aria-selected", "true");
  await visitPages(page, page, "Titles", async () => {
    await expect(page.locator(".rd-legacy-titles")).toBeVisible();
    await expect(page.locator(".rd-legacy-titles")).toContainText("Lv");
  });

  await go(page, "/rune-delve/armory");
  await keyActivate(page, page.getByRole("tab", { name: /^Collection/ }));
  const ember = page.getByRole("button", { name: /^Ember Edge\./ });
  await revealPaged(page, ember, page, "Relics");
  await page.evaluate(() => window.runeQa.failRpc.push("rune_delve_equip"));
  await keyActivate(page, ember);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.runeQa.rpcs.filter((call) => call.name === "rune_delve_equip")
            .length,
      ),
    )
    .toBe(1);
  await expect(ember).toBeEnabled();
  await expect(ember).toHaveAttribute("data-state", "owned");
  await page.evaluate(() => {
    window.runeQa.failRpc = [];
  });
  await ember.evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(ember).toHaveAttribute("data-state", "equipped");
  await keyActivate(page, await revealPaged(page, page.getByRole("button", { name: /^Aether Spark\./ }), page, "Relics"));
  await expect(
    page.getByRole("button", { name: /^Aether Spark\./ }),
  ).toHaveAttribute("data-state", "equipped");
  const beforeFullSlot = await page.evaluate(
    () =>
      window.runeQa.rpcs.filter((call) => call.name === "rune_delve_equip")
        .length,
  );
  await keyActivate(page, await revealPaged(page, page.getByRole("button", { name: /^Iron Resolve\./ }), page, "Relics"));
  await expect(
    page.getByRole("button", { name: /^Iron Resolve\./ }),
  ).toHaveAttribute("data-state", "owned");
  assert.equal(
    await page.evaluate(
      () =>
        window.runeQa.rpcs.filter((call) => call.name === "rune_delve_equip")
          .length,
    ),
    beforeFullSlot,
    "Full loadout needs an explicit free slot",
  );
  await keyActivate(page, page.getByRole("tab", { name: "Loadout", exact: true }));
  await keyActivate(page, page.getByRole("button", { name: "Unequip Ember Edge", exact: true }));
  await keyActivate(page, page.getByRole("tab", { name: /^Collection/ }));
  await revealPaged(page, ember, page, "Relics");
  await expect(ember).toHaveAttribute("data-state", "owned");
  await keyActivate(page, await revealPaged(page, page.getByRole("button", { name: /^Iron Resolve\./ }), page, "Relics"));
  await expect(
    page.getByRole("button", { name: /^Iron Resolve\./ }),
  ).toHaveAttribute("data-state", "equipped");
  await keyActivate(page, page.getByRole("tab", { name: "Loadout", exact: true }));
  await page.getByRole("combobox", { name: "Loadout class", exact: true }).selectOption("mage");
  await expect(
    page
      .getByRole("region", { name: "Mage loadout", exact: true })
      .getByRole("button", {
        name: "Choose a relic for this empty slot",
        exact: true,
      }),
  ).toHaveCount(2);
  await page.getByRole("combobox", { name: "Loadout class", exact: true }).selectOption("warrior");
  await keyActivate(page, page.getByRole("tab", { name: /^Collection/ }));
  await revealPaged(page, page.getByRole("button", { name: /^Iron Resolve\./ }), page, "Relics");
  await expect(page.getByRole("button", { name: /^Iron Resolve\./ })).toHaveAttribute("data-state", "equipped");
  await keyActivate(
    page,
    page.getByRole("tab", { name: "Combat stats", exact: true }),
  );
  await expect(
    page.getByRole("tab", { name: "Combat stats", exact: true }),
  ).toHaveAttribute("aria-selected", "true");

  await go(page, "/rune-delve/bestiary");
  const discoveredName = await page.evaluate(async () => {
    const { BESTIARY_ROSTER } =
      await import("/src/lib/runedelve/enemyRoster.ts");
    return BESTIARY_ROSTER[0].name;
  });
  const search = page.getByRole("textbox", { name: /Search/i });
  await search.fill(discoveredName);
  await modalKeyboard(
    page,
    page.getByRole("button", { name: discoveredName, exact: true }),
    discoveredName,
    async (dialog) => {
      await keyActivate(page, dialog.getByRole("tab", { name: "Record", exact: true }), "Space");
      await expect(dialog.getByText("Defeats", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Best Lvl", { exact: true })).toBeVisible();
    },
  );
  await search.fill("no-monster-has-this-name");
  await expect(page.getByText("No matches", { exact: true })).toBeVisible();
  await search.clear();
  const chapter = page.getByRole("button", { name: "Chapter 2", exact: true });
  await keyActivate(page, chapter);
  await expect(chapter).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "All", exact: true }).click();
  const unknown = page.getByRole("button", { name: /^Undiscovered/ }).first();
  await revealPaged(page, unknown, page, "Bestiary");
  await keyActivate(page, unknown);
  await expect(page.getByRole("dialog")).toContainText(/Defeat this/);
  await expect(
    page.getByRole("dialog").getByText("Defeats", { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  // A deep link is a valid entrypoint and still needs a reliable exit.
  await page
    .locator(".rd-mode main")
    .getByRole("link", { name: /Back/i })
    .click();
  await expect(page.getByTestId("rune-home")).toBeVisible();

  await go(page, "/rune-delve/history");
  await revealPaged(page, page.getByRole("article").filter({ hasText: "Level 17" }), page, "Campaign history");
  await page.getByRole("tab", { name: "Daily", exact: true }).focus();
  await page.keyboard.press("Space");
  await revealPaged(page, page.getByRole("tabpanel").getByRole("article").filter({ hasText: "3,456" }), page, "Daily history");
  await expect(page.getByRole("tabpanel")).toContainText("3,456");
  // Pager navigation changes focus, so return to the tab before its arrow key.
  await page.getByRole("tab", { name: "Daily", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Quests", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await revealPaged(page, page.getByRole("tabpanel").getByRole("article").filter({ hasText: "Daily Delver" }), page, "Quest history");
  await expect(page.getByRole("tabpanel")).toContainText("Daily Delver");
  await page.getByRole("tab", { name: "Levels", exact: true }).click();
  await revealPaged(page, page.getByRole("article").filter({ hasText: "Level 17" }), page, "Campaign history");
  await expect(
    page.getByRole("article").filter({ hasText: "Level 17" }),
  ).toContainText("2,234");
  await page
    .getByRole("navigation", { name: "Rune Delve navigation", exact: true })
    .getByRole("link", { name: "Campaign", exact: true })
    .click();
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    "/rune-delve/levels",
  );

  // A milestone keeps all variants reachable, including keyboard dismissal.
  await page.getByRole("navigation", { name: "Dungeon route stages", exact: true })
    .getByRole("button", { name: /^1–10 / }).click();
  const milestone = page.getByRole("button", { name: /^Level 10 ·/ });
  await revealPaged(page, milestone, page, /^Chambers .* pages$/);
  await modalKeyboard(page, milestone, "Choose your path.", async (dialog) => {
    const names = [];
    await visitPages(page, dialog, "Milestone paths", async () => {
      const heading = await dialog.getByRole("heading", { level: 3 }).innerText();
      names.push(heading);
      await expect(dialog.getByRole("button", { name: /^Choose (Standard|Treasure|Elite) Path$/ })).toBeVisible();
    });
    assert.equal(names.length, 3, "All three milestone variants remain reachable");
    assert.ok(names.some(name => name.includes("Treasure Path")), "Treasure path remains available");
    assert.ok(names.some(name => name.includes("Elite Path")), "Elite path remains available");
  });

  await go(page, "/rune-delve/leaderboard");
  await revealPaged(page, page.locator(".rd-codex-leader-name > strong").filter({ hasText: "Kael" }), page, "Standings");
  await expect(page.locator(".rd-mode main")).toContainText("Kael");
  await revealPaged(page, page.locator(".rd-codex-leader-name > strong").filter({ hasText: "Thalia Stormvein" }), page, "Standings");
  await expect(page.locator(".rd-mode main")).toContainText("Thalia Stormvein");
  await expect(page.locator(".rd-mode main")).toContainText("(you)");

  await go(page, "/rune-delve/quests");
  await expect(
    page.getByRole("heading", { name: "Daily Quests", exact: true }),
  ).toBeVisible();
  const claim = page.getByRole("button", { name: /Claim \+25/ }).first();
  await revealPaged(page, claim, page, "Daily quest");
  await page.evaluate(() =>
    window.runeQa.failRpc.push("rune_delve_claim_quest"),
  );
  await keyActivate(page, claim);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.runeQa.rpcs.filter(
            (call) => call.name === "rune_delve_claim_quest",
          ).length,
      ),
    )
    .toBe(1);
  await expect(claim).toBeEnabled();
  assert.equal(
    await page.evaluate(() => window.runeQa.tables.rune_delve_wallet[0].shards),
    2400,
    "Failed quest claim preserves balance",
  );
  await page.evaluate(() => {
    window.runeQa.failRpc = [];
  });
  await keyActivate(page, claim);
  await expect
    .poll(() =>
      page.evaluate(() => window.runeQa.tables.rune_delve_wallet[0].shards),
    )
    .toBe(2425);
  await expect(
    page.getByText("Reward claimed · Resets next period", { exact: true }),
  ).toBeVisible();

  for (const [route, table, tab] of [
    ["/rune-delve/bestiary", "rune_delve_bestiary"],
    ["/rune-delve/leaderboard", "rune_delve_progress"],
    ["/rune-delve/quests", "rune_delve_quest_definitions"],
    ["/rune-delve/quests", "rune_delve_active_quests"],
    ["/rune-delve/history", "rune_delve_runs", "Levels"],
    ["/rune-delve/history", "rune_delve_daily_runs", "Daily"],
    ["/rune-delve/history", "rune_delve_active_quests", "Quests"],
  ])
    await checkRetry(page, route, table, tab);

  await go(page, "/rune-delve/results/1");
  await expect(
    page.getByRole("heading", { name: "Chamber conquered", exact: true }),
  ).toBeVisible();
  await keyActivate(
    page,
    page.getByRole("tab", { name: "Records", exact: true }),
  );
  await expect(
    page.getByRole("tab", { name: "Records", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("heading", { name: "Your warrior record", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Club records", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play again", exact: true }).click();
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    "/rune-delve/play/1",
  );
  await go(page, "/rune-delve/results/2");
  await expect(
    page.getByRole("heading", { name: "Fallen, not finished", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Tune build/ }).click();
  await expect(
    page.getByRole("heading", { name: "Armory", exact: true }),
  ).toBeVisible();
  await go(page, "/rune-delve/results/99", { scenario: "full" });
  await expect(
    page.getByRole("heading", { name: "No saved run yet", exact: true }),
  ).toBeVisible();
  await page
    .locator(".rd-mode main")
    .getByRole("link", { name: "Dungeon", exact: true })
    .click();
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    "/rune-delve/levels",
  );
  await page.close();

  const onboarding = await setup(true);
  await go(onboarding, "/rune-delve", { scenario: "new" });
  await onboarding
    .getByRole("button", { name: "Choose Cleric", exact: true })
    .click();
  await onboarding
    .getByRole("textbox", { name: "Hero name", exact: true })
    .fill("Mira");
  await keyActivate(
    onboarding,
    onboarding.getByRole("button", { name: "Enter Combat Archive", exact: true }),
  );
  const help = onboarding.getByRole("dialog", {
    name: "One chain. One decision.",
    exact: true,
  });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Connect 3 or more");
  await visitPages(onboarding, help, "How to play", async (index) => {
    await expect(help.locator(".rd-dialog-body")).toBeVisible();
    assert.ok((await help.locator(".rd-dialog-body").innerText()).trim().length > 20, `Help page ${index + 1} has content`);
  });
  await revealPaged(onboarding, help.getByRole("heading", { name: /Sanctuary/ }), help, "How to play");
  await expect(help).toContainText("Sanctuary");
  await keyActivate(
    onboarding,
    help.getByRole("button", { name: "Ready to delve", exact: true }),
  );
  await expect(help).toBeHidden();
  assert.equal(
    await onboarding.evaluate(() => localStorage.getItem("rd-guide-v1:member")),
    "1",
    "First-run help is remembered for this account",
  );
  await onboarding.close();
  assert.deepEqual(errors, [], "No uncaught runtime errors");
  console.log(
    "PASS menu QA: all Codex/help pages, keyboard activation/focus trapping/restoration, both sound panels, rename failure/retry/class progression, paged equipment failure/rapid save/full-slot/unequip/class isolation, discovered/hidden Bestiary, search/filters/deep-link exit, paged History/leaders/quests, milestone variants, quest claim failure/retry, seven secondary data retries, victory/defeat/missing results navigation, first-run class help.",
  );
} finally {
  await browser.close();
}
