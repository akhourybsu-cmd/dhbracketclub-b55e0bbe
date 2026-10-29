// Real UI/engine with an isolated account backend; no live account writes.
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const output = await mkdtemp(join(tmpdir(), "nexus-endless-ui-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await installNexusFixture(page);
  const go = (route = "/nexus") =>
    page.goto(
      `http://127.0.0.1:8080/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
      { waitUntil: "networkidle" },
    );
  const noOverflow = async () =>
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No horizontal overflow",
    );
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1440, 1000],
  ])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height });
      await go();
      await page.evaluate(
        (theme) => (document.documentElement.className = theme),
        theme,
      );
      await expect(
        page.getByRole("heading", { name: "Hold the core. Defy the swarm." }),
      ).toBeVisible();
      await noOverflow();
      await page.screenshot({
        path: join(output, `${width}-${theme}-home.png`),
        fullPage: false,
      });
      await go("/nexus/missions");
      await expect(
        page.getByRole("heading", { name: "Build your defense." }),
      ).toBeVisible();
      await noOverflow();
      await expect(
        page.getByRole("button", { name: "Equip Orbital blades", exact: true }),
      ).toBeDisabled();
      await page.screenshot({
        path: join(output, `${width}-${theme}-loadout.png`),
        fullPage: false,
      });
      await go("/nexus/research");
      await expect(
        page.getByRole("heading", { name: "Earn your arsenal." }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Unlock Orbital blades",
          exact: true,
        }),
      ).toBeDisabled();
      await noOverflow();
      await page.screenshot({
        path: join(output, `${width}-${theme}-armory.png`),
        fullPage: false,
      });
      await page
        .getByRole("tab", { name: "Core research", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Research Weapon amplifier",
          exact: true,
        }),
      ).toBeDisabled();
      await noOverflow();
    }
  console.log(
    "PASS starter state, endless redirects, responsive layouts and both themes",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await go();
  await page.evaluate(() => {
    window.stageNexusResult();
    sessionStorage.setItem("nexus-qa-fail", "1");
  });
  await go("/nexus/results/endless");
  await expect(page.getByRole("alert")).toContainText("Offline");
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 0);
  await page.evaluate(() => {
    window.nexusQa.failClaims = false;
    sessionStorage.removeItem("nexus-qa-fail");
  });
  await page.getByRole("button", { name: "Retry sync" }).click();
  await expect(page.getByText("Credits and record synced")).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 97);
  assert.equal(
    await page.evaluate(() => window.nexusQa.profile.total_waves),
    10,
  );
  await go("/nexus/results/endless");
  await expect(page.getByText("Credits and record synced")).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 97);
  await page.evaluate(() => window.stageNexusResult());
  await go("/nexus/results/endless");
  await expect(page.getByText("Credits and record synced")).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 139);
  await page.screenshot({
    path: join(output, "390-results.png"),
    fullPage: false,
  });
  await go("/nexus/research");
  const unlock = page.getByRole("button", {
    name: "Unlock Orbital blades",
    exact: true,
  });
  await expect(unlock).toBeEnabled();
  await unlock.click();
  await expect(unlock).toBeDisabled();
  assert.deepEqual(await page.evaluate(() => window.nexusQa.profile.unlocks), [
    "orbit",
  ]);
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 49);
  await go("/nexus/loadout/endless");
  await page
    .getByRole("button", { name: "Equip Orbital blades", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unequip Orbital blades", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Save loadout", exact: true }).click();
  await expect(
    page.getByText("Loadout synced. Ready for your next defense."),
  ).toBeVisible();
  await go("/nexus/loadout/endless");
  await expect(
    page.getByRole("button", { name: "Unequip Orbital blades", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Deploy nexus", exact: true }).click();
  await page
    .getByRole("button", { name: "Start defense", exact: true })
    .click();
  const save = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")),
    );
  assert.deepEqual((await save()).upgrades, { orbit: 1 });
  assert.equal((await save()).metrics.energySpent, 0);
  await page.getByRole("tab", { name: "Weapons", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Orbital blades, level 1/ }),
  ).toBeVisible();
  assert.equal(await page.locator(".nc-upgrade").count(), 1);
  await page.getByRole("tab", { name: "Utility", exact: true }).click();
  await expect(page.getByText(/No support module equipped/)).toBeVisible();
  await page.getByRole("button", { name: "Open weapon systems" }).click();
  await expect(
    page.getByRole("dialog", { name: "Weapon systems", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not in this loadout")).toHaveCount(3);
  await page.getByRole("button", { name: "Return to defense" }).click();
  await page.getByRole("button", { name: "Pause defense" }).click();
  await page
    .getByRole("button", { name: "End run & collect", exact: true })
    .click();
  await expect(page.getByText("Credits and record synced")).toBeVisible();
  await expect(page.getByText(/Earnings banked/)).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 49);
  console.log(
    "PASS offline reward retry, milestone idempotency, repeat income, unlock debit, saved loadout, online weapon and cash out",
  );
  await page.evaluate(() =>
    window.setNexusProfile({
      credits: 1500,
      total_waves: 100,
      unlocks: ["orbit", "arc", "rail", "mortar", "repair", "siphon", "stasis"],
    }),
  );
  await go("/nexus/loadout/endless");
  await page
    .getByRole("button", { name: "Equip Rail lance", exact: true })
    .click();
  await expect(page.getByLabel("4 of 4 power used")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Equip Chain arc", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unequip Rail lance", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Unequip Orbital blades", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Chain arc", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Siege mortar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Stasis field", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Equip Repair nanites", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Equip Stasis field", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Save loadout", exact: true }).click();
  await expect(
    page.getByText("Loadout synced. Ready for your next defense."),
  ).toBeVisible();
  assert.deepEqual(await page.evaluate(() => window.nexusQa.profile.loadout), {
    weapons: ["arc", "mortar"],
    module: "repair",
  });
  await go("/nexus/loadout/endless");
  await page.screenshot({
    path: join(output, "390-equipped-loadout.png"),
    fullPage: false,
  });
  await go("/nexus/research");
  await page.getByRole("tab", { name: "Core research", exact: true }).click();
  await page
    .getByRole("button", { name: "Research Weapon amplifier", exact: true })
    .click();
  await expect(page.getByText("LEVEL 1 / 10", { exact: true })).toBeVisible();
  assert.equal(
    await page.evaluate(() => window.nexusQa.profile.research.weapons),
    1,
  );
  await page.locator(".nc-history summary").click();
  await expect(page.getByLabel("Credit history")).toContainText(
    "Unlocked · Orbital blades",
  );
  await go();
  await page.evaluate(() => window.stageNexusBattle());
  await go("/nexus/battle/endless");
  await page
    .getByRole("button", { name: "Resume defense", exact: true })
    .click();
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: "Pause defense" }).click();
  const battle = await save();
  assert.ok(battle.metrics.damage.pulse > 0);
  assert.ok(battle.metrics.damage.arc > 0);
  assert.ok(battle.metrics.damage.mortar > 0);
  await page
    .getByRole("button", { name: "Resume defense", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nova burst ready", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Nova burst ready in/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Overdrive ready", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Overdrive ready in/ }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Battle speed 1 times. Change speed." })
    .click();
  await expect(
    page.getByRole("button", { name: "Battle speed 2 times. Change speed." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open weapon systems" }).click();
  await page.screenshot({ path: join(output, "390-weapon-systems.png") });
  await page.getByRole("button", { name: "Return to defense" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Save & exit", exact: true }).click();
  await go("/nexus/codex");
  await expect(
    page.getByRole("heading", { name: "Know your perimeter." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Siege mortar · Area bombardment",
      exact: true,
    }),
  ).toBeVisible();
  await go("/nexus/leaderboard");
  await expect(
    page.getByRole("heading", { name: "The first record is yours to set." }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS power limit, exclusive support, research, ledger, mortar damage, abilities, 2× speed, blur pause, guide and endless records",
  );
} finally {
  await browser.close();
}
