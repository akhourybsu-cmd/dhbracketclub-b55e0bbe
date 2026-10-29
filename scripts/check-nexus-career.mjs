// Real progression UI and hooks, isolated backend. Vite on :8080, no live writes.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
const output = await mkdtemp(join(tmpdir(), "nexus-career-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const go = (page, route = "/nexus") =>
  page.goto(
    "http://127.0.0.1:8080/scripts/fixtures/nexus-core.html?route=" +
      encodeURIComponent(route),
    { waitUntil: "networkidle" },
  );
const fits = async (page, locator, label) => {
  const r = await locator.boundingBox(),
    v = page.viewportSize();
  assert.ok(
    r &&
      r.x >= -1 &&
      r.y >= -1 &&
      r.x + r.width <= v.width + 1 &&
      r.y + r.height <= v.height + 1,
    `${label} fits: ${JSON.stringify(r)}`,
  );
};
const touch = async (page, locator, label) => {
  await fits(page, locator, label);
  const r = await locator.boundingBox();
  assert.ok(r.width >= 43 && r.height >= 43, `${label} has a 44px target`);
};
const noScroll = async (page) => {
  const r = await page.locator(".nc-menu-content").evaluate((el) => ({
    height: el.clientHeight,
    scroll: el.scrollHeight,
    width: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
  assert.ok(
    r.scroll <= r.height + 1 && r.scrollWidth <= r.width + 1,
    `Primary screen needs no scrolling: ${JSON.stringify(r)}`,
  );
};
try {
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [390, 844],
    [430, 932],
    [768, 1024],
    [844, 390],
    [568, 320],
    [1440, 900],
  ]) {
    console.log(`Checking ${width}×${height}`);
    const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: true,
        isMobile: width < 1000,
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await installNexusFixture(page);
    await go(page);
    await noScroll(page);
    const objective = page.getByRole("button", {
      name: "Next objective: Clear wave 05",
      exact: true,
    });
    await touch(page, objective, "Next objective");
    const career = page.getByRole("button", {
      name: "Open defender career",
      exact: true,
    });
    await touch(page, career, "Career");
    await career.tap();
    const dialog = page.getByRole("dialog", {
      name: "Defender career",
      exact: true,
    });
    await fits(page, dialog, "Career panel");
    await expect(
      dialog.getByRole("heading", { name: "Recruit", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("25 waves to Sentinel", { exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /^Medals/ }).tap();
    await expect(
      page.getByRole("button", { name: "First Light: 0 of 1", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next medals", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Tactician: 0 of 3", exact: true }),
    ).toBeVisible();
    await touch(
      page,
      page.getByRole("button", { name: "Done", exact: true }),
      "Career close",
    );
    await page.screenshot({ path: join(output, `${width}-medals.png`) });
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    assert.equal(
      await page.evaluate(() => window.nexusQa.profile.credits),
      0,
      "Viewing career does not grant credits",
    );
    await page.evaluate(() =>
      window.setNexusProfile({
        credits: 1000,
        total_waves: 100,
        endless_best: 10,
      }),
    );
    await go(page, "/nexus/research");
    await page
      .getByRole("button", { name: "Unlock Orbital blades", exact: true })
      .tap();
    await expect(
      page.getByRole("dialog", { name: "Orbital blades", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("SYSTEM ACQUIRED", { exact: true }),
    ).toBeVisible();
    await fits(page, page.getByRole("dialog"), "Unlock reveal");
    await touch(
      page,
      page.getByRole("link", { name: "Equip now", exact: true }),
      "Equip now",
    );
    await page.screenshot({ path: join(output, `${width}-unlock.png`) });
    assert.equal(
      await page.evaluate(() => window.nexusQa.profile.credits),
      910,
    );
    await page.getByRole("link", { name: "Equip now", exact: true }).tap();
    await expect(
      page.getByRole("tab", { name: "Inspect Orbital blades", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page
      .getByRole("button", { name: "Equip Orbital blades", exact: true })
      .tap();
    await page.getByRole("button", { name: "Save loadout", exact: true }).tap();
    await expect(
      page.getByText("LOADOUT SAVED", { exact: true }),
    ).toBeVisible();
    await noScroll(page);
    await go(page);
    await page.evaluate(() => window.stageNexusResult());
    await go(page, "/nexus/results/endless");
    await expect(
      page.getByText("Rewards saved", { exact: true }),
    ).toBeVisible();
    await noScroll(page);
    if (height > width)
      await touch(
        page,
        page.getByRole("button", { name: "View career progress", exact: true }),
        "Career result",
      );
    await page.screenshot({ path: join(output, `${width}-results.png`) });
    await go(page);
    await page.evaluate(() =>
      window.setNexusProfile({
        credits: 999999,
        total_waves: 2500,
        endless_best: 27,
        unlocks: [
          "orbit",
          "arc",
          "rail",
          "mortar",
          "repair",
          "siphon",
          "stasis",
        ],
        loadout: { weapons: ["rail", "orbit"], module: "repair" },
        research: {
          weapons: 10,
          reactor: 10,
          plating: 10,
          barrier: 10,
          salvage: 10,
          nova: 10,
        },
      }),
    );
    await go(page);
    await noScroll(page);
    await touch(
      page,
      page.getByRole("button", { name: "Open defender career", exact: true }),
      "Maximum rank",
    );
    await page
      .getByRole("button", { name: "Open defender career", exact: true })
      .tap();
    await expect(
      page.getByRole("heading", { name: "Nexus Prime", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("NEXUS PRIME · MAX RANK", { exact: true }),
    ).toBeVisible();
    await context.close();
  }
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "no-preference",
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await installNexusFixture(page);
  await go(page);
  // Offline settlement cannot promote a core. Retrying banks once; refreshing is idempotent.
  await page.evaluate(() => {
    window.setNexusProfile({ total_waves: 20, total_runs: 4, endless_best: 6 });
    window.stageNexusResult();
    sessionStorage.setItem("nexus-qa-fail", "1");
  });
  await go(page, "/nexus/results/endless");
  await expect(page.getByRole("alert")).toContainText("Offline");
  await expect(
    page.getByRole("heading", { name: "CORE LOST", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => window.nexusQa.profile.total_waves),
    20,
  );
  await page.evaluate(() => {
    window.nexusQa.failClaims = false;
    sessionStorage.removeItem("nexus-qa-fail");
  });
  await page.getByRole("button", { name: "Retry sync", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "RANK UP", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("+10 career waves", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => window.nexusQa.profile.total_waves),
    30,
  );
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 77);
  await page.screenshot({ path: join(output, "rank-promotion.png") });
  await go(page, "/nexus/results/endless");
  await expect(page.getByText("Rewards saved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "RANK UP", exact: true }),
  ).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 77);
  // Failed equipment purchases never reveal an acquisition.
  await page.evaluate(() =>
    window.setNexusProfile({ credits: 1000, total_waves: 100 }),
  );
  await go(page, "/nexus/research");
  await page.evaluate(() => (window.nexusQa.failUnlock = true));
  await page
    .getByRole("button", { name: "Unlock Orbital blades", exact: true })
    .click();
  await expect(page.getByText("Armory offline", { exact: true })).toBeVisible();
  await expect(page.locator(".nc-unlock-reveal")).toHaveCount(0);
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 1000);
  await page.evaluate(() => (window.nexusQa.failUnlock = false));
  await page
    .getByRole("button", { name: "Unlock Orbital blades", exact: true })
    .click();
  await expect(page.locator(".nc-unlock-reveal")).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 910);
  await page.screenshot({ path: join(output, "animated-acquisition.png") });
  await context.close();
  const medalContext = await browser.newContext({
    viewport: { width: 320, height: 568 },
    reducedMotion: "reduce",
  });
  const medalPage = await medalContext.newPage();
  medalPage.on("pageerror", (e) => errors.push(e.message));
  await installNexusFixture(medalPage);
  await go(medalPage);
  await medalPage.evaluate(() => window.stageNexusResult());
  await go(medalPage, "/nexus/results/endless");
  await expect(
    medalPage.getByRole("heading", { name: "2 MEDALS EARNED", exact: true }),
  ).toBeVisible();
  await noScroll(medalPage);
  assert.equal(
    await medalPage.evaluate(() => window.nexusQa.profile.credits),
    97,
  );
  await medalPage
    .getByRole("button", { name: "View career progress", exact: true })
    .click();
  await medalPage.getByRole("tab", { name: /^Medals/ }).click();
  await expect(
    medalPage.getByRole("button", { name: "First Light: earned", exact: true }),
  ).toBeVisible();
  await expect(
    medalPage.getByRole("button", {
      name: "Siegebreaker: earned",
      exact: true,
    }),
  ).toBeVisible();
  await medalPage.screenshot({ path: join(output, "first-medals.png") });
  await go(medalPage, "/nexus/results/endless");
  await expect(
    medalPage.getByText("Rewards saved", { exact: true }),
  ).toBeVisible();
  await expect(
    medalPage.getByRole("heading", { name: "CORE LOST", exact: true }),
  ).toBeVisible();
  assert.equal(
    await medalPage.evaluate(() => window.nexusQa.profile.credits),
    97,
  );
  await medalContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS career ranks, eight medals, objectives, permanent ownership, unlock reveals, equip flow, no-scroll menus, eight sizes, maximum progression, offline retry and receipt idempotency",
  );
} finally {
  await browser.close();
}
