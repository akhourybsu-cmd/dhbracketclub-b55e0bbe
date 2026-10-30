// Actual game screens with an isolated account backend. No live account writes.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
const output = await mkdtemp(join(tmpdir(), "nexus-game-feel-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const go = (page, route = "/nexus") =>
  page.goto(
    (process.env.NEXUS_QA_URL || "http://127.0.0.1:8080") +
      "/scripts/fixtures/nexus-core.html?route=" +
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
  assert.ok(
    r.width >= 43 && r.height >= 43,
    `${label} has a 44px target: ${JSON.stringify(r)}`,
  );
};
const noScroll = async (page) => {
  const geometry = await page.locator(".nc-menu-content").evaluate((el) => ({
    height: el.clientHeight,
    scroll: el.scrollHeight,
    width: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
  assert.ok(
    geometry.scroll <= geometry.height + 1 &&
      geometry.scrollWidth <= geometry.width + 1,
    `Primary screen needs no scrolling: ${JSON.stringify(geometry)}`,
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
    await go(page, "/nexus/loadout/endless");
    assert.equal(
      await page
        .locator(".nc-nebula")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
      "Reduced motion disables the moving background",
    );
    for (const name of [
      "Orbital blades",
      "Chain arc",
      "Rail lance",
      "Siege mortar",
      "Flak battery",
      "Prism laser",
      "Corrosive injector",
    ]) {
      const key = page.getByRole("tab", {
        name: "Inspect " + name,
        exact: true,
      });
      await touch(page, key, name + " selector");
      await key.tap();
      await expect(
        page.getByRole("heading", { name, exact: true }),
      ).toBeVisible();
      const equip = page.getByRole("button", {
        name: "Equip " + name,
        exact: true,
      });
      await touch(page, equip, name + " action");
      await expect(equip).toBeDisabled();
      await noScroll(page);
    }
    await page
      .getByRole("tab", { name: "Inspect Orbital blades", exact: true })
      .tap();
    await page.getByRole("tab", { name: /^Support/ }).tap();
    for (const name of [
      "Repair nanites",
      "Energy siphon",
      "Stasis field",
      "Pulse capacitor",
      "Retaliation grid",
    ]) {
      await page
        .getByRole("tab", { name: "Inspect " + name, exact: true })
        .tap();
      await touch(
        page,
        page.getByRole("button", { name: "Equip " + name, exact: true }),
        name,
      );
      await noScroll(page);
    }
    await page.getByRole("tab", { name: /^Weapons/ }).tap();
    await touch(
      page,
      page.getByRole("button", { name: "Save loadout", exact: true }),
      "Save",
    );
    await touch(
      page,
      page.getByRole("button", { name: "Deploy", exact: true }),
      "Deploy",
    );
    await page.screenshot({ path: join(output, `${width}-loadout.png`) });
    await go(page, "/nexus/research?tab=research");
    for (const name of [
      "Weapon amplifier",
      "Reactor tuning",
      "Core structure",
      "Shield matrix",
      "Energy reserves",
      "Nova capacitor",
    ]) {
      const key = page.getByRole("tab", {
        name: "Inspect " + name,
        exact: true,
      });
      await touch(page, key, name + " selector");
      await key.tap();
      await expect(
        page.getByRole("button", { name: "Research " + name, exact: true }),
      ).toBeDisabled();
      await noScroll(page);
    }
    // Keyboard navigation changes selection and focus together, without page scrolling.
    const first = page.getByRole("tab", {
      name: "Inspect Weapon amplifier",
      exact: true,
    });
    await first.focus();
    await first.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Inspect Reactor tuning", exact: true }),
    ).toBeFocused();
    await page.screenshot({ path: join(output, `${width}-research.png`) });
    await page.evaluate(() =>
      sessionStorage.setItem(
        "nexus-qa-records",
        JSON.stringify(
          Array.from({ length: 12 }, (_, i) => ({
            user_id: String(i),
            score: 1000 - i,
            waves: 25 - i,
            scenario_id: "endless",
            display_name: "Defender " + (i + 1),
          })),
        ),
      ),
    );
    await go(page, "/nexus/leaderboard");
    await expect(page.locator(".nc-record-row").first()).toBeVisible();
    await noScroll(page);
    assert.ok(
      (await page.locator(".nc-record-row").count()) < 12,
      "Records paginate to fit the screen",
    );
    await page.getByRole("button", { name: "Next records", exact: true }).tap();
    assert.notEqual(
      (await page.locator(".nc-record-rank").first().innerText()).trim(),
      "01",
    );
    await noScroll(page);
    await go(page);
    await page.evaluate(() => window.stageNexusResult());
    await go(page, "/nexus/results/endless");
    await expect(
      page.getByText("Rewards saved", { exact: true }),
    ).toBeVisible();
    await noScroll(page);
    const statBox = await page.locator(".nc-result-grid").boundingBox(),
      rewardBox = await page.locator(".nc-reward").boundingBox();
    if (height < width)
      assert.ok(
        statBox.y + statBox.height <= rewardBox.y + 1,
        "Landscape statistics and rewards do not overlap",
      );
    await page.getByRole("button", { name: "Run details", exact: true }).tap();
    await fits(
      page,
      page.getByRole("dialog", { name: "Run details", exact: true }),
      "Run statistics",
    );
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    await page.getByRole("button", { name: /^Next unlock:/ }).tap();
    await fits(page, page.getByRole("dialog"), "Unlock preview");
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    await touch(
      page,
      page.getByRole("button", { name: "PLAY AGAIN", exact: true }),
      "Replay",
    );
    await page.screenshot({ path: join(output, `${width}-results.png`) });
    await go(page, "/nexus/codex");
    await page.getByText("Combat & abilities", { exact: true }).tap();
    await page.getByText("Weapons & support", { exact: true }).tap();
    assert.equal(
      await page.locator(".nc-guide-section[open]").count(),
      1,
      "Guide keeps one group expanded",
    );
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
  assert.notEqual(
    await page
      .locator(".nc-nebula")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
    "World background animates",
  );
  await page.evaluate(() =>
    window.setNexusProfile({ credits: 1000, total_waves: 100 }),
  );
  await go(page, "/nexus/research");
  await page
    .getByRole("button", { name: "Unlock Orbital blades", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Orbital blades", exact: true }),
  ).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 910);
  await page.getByRole("link", { name: "Equip now", exact: true }).click();
  await page
    .getByRole("button", { name: "Equip Orbital blades", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("SYSTEM EQUIPPED");
  await page.getByRole("button", { name: "Save loadout", exact: true }).click();
  await expect(page.getByText("LOADOUT SAVED", { exact: true })).toBeVisible();
  assert.equal(
    await page.locator(".nc-game-feedback").count(),
    1,
    "A new action replaces the previous feedback",
  );
  assert.notEqual(
    await page
      .locator(".nc-bay-artwork>.nc-equipment-art")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
    "Equipment animates",
  );
  await page.screenshot({ path: join(output, "animated-equipped.png") });
  await go(page);
  await page.evaluate(() => {
    window.stageNexusBattle();
    const key = "nexus_core_run_v2:member:club",
      run = JSON.parse(localStorage.getItem(key));
    run.enemies[0].kind = "boss";
    localStorage.setItem(key, JSON.stringify(run));
  });
  await go(page, "/nexus/battle/endless");
  await page
    .getByRole("button", { name: "Resume defense", exact: true })
    .click();
  await expect(page.locator(".nc-boss-intro")).toContainText("SIEGE INBOUND");
  await expect(page.locator(".nc-boss-track")).toBeVisible();
  await page.getByRole("button", { name: /Weapon power, level/ }).click();
  await expect(
    page.getByText("SYSTEM UPGRADED", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Overdrive ready", exact: true })
    .click();
  await expect(page.locator(".nc-field")).toHaveAttribute(
    "data-overdrive",
    "true",
  );
  await page.screenshot({ path: join(output, "animated-boss.png") });
  await context.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS no-scroll selection screens, every equipment/research selector, touch targets, keyboard navigation, paged records, compact results, exclusive guide panels, motion and real purchase/combat feedback",
  );
} finally {
  await browser.close();
}
