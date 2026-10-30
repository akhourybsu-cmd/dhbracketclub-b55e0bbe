// Real production pages/hooks, isolated account transport; no live writes.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
const base = process.env.NEXUS_QA_URL || "http://127.0.0.1:8080";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await installNexusFixture(page);
    const go = (route) =>
      page.goto(
        `${base}/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
        { waitUntil: "networkidle" },
      );
    await go("/nexus/loadout/endless");
    const select = page.getByRole("combobox", { name: "Endless threat level" });
    await expect(select).toHaveValue("1");
    assert.equal(
      await select.locator("option:disabled").count(),
      5,
      "New accounts see tier gates",
    );
    const rect = await select.boundingBox();
    assert.ok(
      rect.height >= 44 &&
        rect.x >= 0 &&
        rect.x + rect.width <= width &&
        rect.y + rect.height <= height,
      "Threat target fits",
    );
    await page.evaluate(() =>
      window.setNexusProfile({
        total_waves: 9500,
        credits: 100000,
        unlocks: ["laser", "flak", "venom"],
        loadout: { weapons: ["laser", "flak"], module: null },
        research: {
          weapons: 20,
          reactor: 20,
          plating: 20,
          barrier: 20,
          salvage: 20,
          nova: 20,
        },
      }),
    );
    await go("/nexus/loadout/endless");
    await select.selectOption("6");
    await page.getByRole("button", { name: "Threat level details" }).click();
    await expect(
      page.getByRole("heading", { name: "Choose your threat" }),
    ).toBeVisible();
    await expect(
      page.getByText("6 · Singularity", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ready", exact: true }).click();
    await page.getByRole("button", { name: "Deploy", exact: true }).click();
    await expect(page.locator(".nc-play-screen")).toBeVisible();
    const ticket = await page.evaluate(() =>
      Object.values(window.nexusQa.tickets).at(-1),
    );
    assert.equal(ticket.difficulty, 6);
    assert.equal(ticket.balance_version, 6);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")),
    );
    assert.equal(stored.difficulty, 6, "Deployed checkpoint keeps tier");
    await page
      .getByRole("button", { name: "Open weapon systems", exact: true })
      .click();
    await expect(page.getByText("Prism laser", { exact: true })).toBeVisible();
    await expect(page.getByText("Flak battery", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Corrosive injector", { exact: true }),
    ).toBeVisible();
    await go("/nexus");
    await expect(
      page.getByText("ENDLESS SURVIVAL · THREAT 6", { exact: true }),
    ).toBeVisible();
    await go("/nexus/leaderboard");
    const records = page.getByRole("combobox", { name: "Record threat level" });
    await records.selectOption("6");
    await expect(records).toHaveValue("6");
    // Preference can never grant access if the server profile lacks the gate.
    await page.evaluate(() => {
      window.setNexusProfile({ total_waves: 0 });
      localStorage.removeItem("nexus_core_run_v2:member:club");
    });
    await go("/nexus/loadout/endless");
    await expect(select).toHaveValue("1");
    await context.close();
    console.log(`PASS threat menu/tickets/locks/records ${width}×${height}`);
  }
  assert.deepEqual(errors, []);
  console.log("PASS threat flow without browser exceptions");
} finally {
  await browser.close();
}
