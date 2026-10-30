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
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  } else if (route.endsWith("/leaderboard"))
    await expect(page.locator(".rd-mode main")).toContainText("Kael");
  else if (route.endsWith("/quests"))
    await expect(page.getByText("Daily Delver", { exact: true })).toBeVisible();
  else if (tab === "Levels")
    await expect(
      page.getByRole("article").filter({ hasText: "Level 17" }),
    ).toBeVisible();
  else
    await expect(page.getByRole("tabpanel")).toContainText(
      tab === "Daily" ? "3,456" : "Daily Delver",
    );
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
      for (const name of ["Guide", "Daily", "Masteries", "Relics"]) {
        const tab = dialog.getByRole("tab", { name, exact: true });
        await keyActivate(page, tab, "Space");
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(dialog.getByRole("tabpanel")).toBeVisible();
        assert.ok(
          (await dialog.getByRole("tabpanel").innerText()).trim().length > 20,
          `${name} has content`,
        );
        await noOverflow(page, `Codex ${name}`);
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
  );

  await go(page, "/rune-delve/hero");
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
  await keyActivate(
    page,
    page.getByRole("button", { name: "Switch to Mage, level 1", exact: true }),
  );
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
  await keyActivate(
    page,
    page.getByRole("button", {
      name: "Switch to Warrior, level 8",
      exact: true,
    }),
  );
  await expect(
    page.getByRole("button", { name: "Active Warrior, level 8", exact: true }),
  ).toBeDisabled();
  await keyActivate(
    page,
    page.getByRole("tab", { name: "Legacy", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Warrior titles", exact: true }),
  ).toBeVisible();

  await go(page, "/rune-delve/armory");
  const ember = page.getByRole("button", { name: /^Ember Edge\./ });
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
  await keyActivate(
    page,
    page.getByRole("button", { name: /^Aether Spark\./ }),
  );
  await expect(
    page.getByRole("button", { name: /^Aether Spark\./ }),
  ).toHaveAttribute("data-state", "equipped");
  const beforeFullSlot = await page.evaluate(
    () =>
      window.runeQa.rpcs.filter((call) => call.name === "rune_delve_equip")
        .length,
  );
  await keyActivate(
    page,
    page.getByRole("button", { name: /^Iron Resolve\./ }),
  );
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
  await keyActivate(
    page,
    page.getByRole("button", { name: "Unequip Ember Edge", exact: true }),
  );
  await expect(ember).toHaveAttribute("data-state", "owned");
  await keyActivate(
    page,
    page.getByRole("button", { name: /^Iron Resolve\./ }),
  );
  await expect(
    page.getByRole("button", { name: /^Iron Resolve\./ }),
  ).toHaveAttribute("data-state", "equipped");
  await keyActivate(page, page.getByRole("tab", { name: "Mage", exact: true }));
  await expect(
    page
      .getByRole("region", { name: "Mage loadout", exact: true })
      .getByRole("button", {
        name: "Choose a relic for this empty slot",
        exact: true,
      }),
  ).toHaveCount(2);
  await keyActivate(
    page,
    page.getByRole("tab", { name: "Warrior", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: /^Iron Resolve\./ }),
  ).toHaveAttribute("data-state", "equipped");
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
  await expect(
    page.getByRole("article").filter({ hasText: "Level 17" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Daily", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("tabpanel")).toContainText("3,456");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Quests", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText("Daily Delver");
  await page.getByRole("tab", { name: "Levels", exact: true }).click();
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

  await go(page, "/rune-delve/leaderboard");
  await expect(page.locator(".rd-mode main")).toContainText("Kael");
  await expect(page.locator(".rd-mode main")).toContainText("Thalia Stormvein");
  await expect(page.locator(".rd-mode main")).toContainText("(you)");

  await go(page, "/rune-delve/quests");
  await expect(
    page.getByRole("heading", { name: "Daily Quests", exact: true }),
  ).toBeVisible();
  const claim = page.getByRole("button", { name: /Claim \+25/ }).first();
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
    onboarding.getByRole("button", { name: "Enter the sanctum", exact: true }),
  );
  const help = onboarding.getByRole("dialog", {
    name: "One chain. One decision.",
    exact: true,
  });
  await expect(help).toBeVisible();
  await expect(help).toContainText("Sanctuary");
  await expect(help).toContainText("Connect 3+");
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
    "PASS menu QA: Codex four tabs, keyboard activation/focus trapping/restoration, sound dialog, rename failure/retry/class progression, equipment failure/rapid save/full-slot/unequip/class isolation, discovered/hidden Bestiary, search/filters/deep-link exit, all History tabs, campaign leaders, quest claim failure/retry, seven secondary data retries, victory/defeat/missing results navigation, first-run class help.",
  );
} finally {
  await browser.close();
}
