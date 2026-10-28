import { installNexusFixture } from "./nexus-ui-fixture.mjs";
// Real game pages, hooks, engine, and CSS. An in-memory backend replaces only
// auth/club/Supabase in the fixture. No live accounts or database writes.
import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const output = await mkdtemp(join(tmpdir(), "nexus-core-ui-"));
console.log(`Screenshots: ${output}`);
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
  const go = async (route = "/nexus") =>
    page.goto(
      `http://127.0.0.1:8080/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
      { waitUntil: "networkidle" },
    );
  const noOverflow = async () =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "No horizontal overflow",
    );
  // Visual and layout coverage in both app themes, including very narrow phones.
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
        fullPage: true,
      });
      await page.getByRole("link", { name: /Campaign Eight sectors/ }).click();
      await expect(
        page.getByRole("heading", { name: "Secure the perimeter." }),
      ).toBeVisible();
      await expect(page.getByText("Clear First light to unlock")).toBeVisible();
      await noOverflow();
      await go("/nexus/challenges");
      await expect(
        page.getByRole("heading", { name: "Glass cannon" }),
      ).toBeVisible();
      await noOverflow();
      await go("/nexus/research");
      await expect(
        page.getByRole("heading", { name: "Built to last." }),
      ).toBeVisible();
      await noOverflow();
    }
  await page.setViewportSize({ width: 390, height: 844 });
  // Atomic research response updates the live wallet and subsequent starts.
  await go("/nexus/research");
  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Weapon amplifier" }) })
    .getByRole("button")
    .click();
  await expect(page.getByText("LEVEL 1 / 10", { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 145);
  await go("/nexus/loadout/1");
  await page.getByRole("button", { name: "Deploy nexus" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  assert.ok(
    bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390,
    "Pause dialog is in the viewport",
  );
  await page.getByRole("button", { name: "Start defense" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /Weapon power, level 0/ }).click();
  await expect(
    page.getByRole("button", { name: /Weapon power, level 1/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Defense", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Hull plating/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause defense" }).click();
  await expect(dialog).toBeVisible();
  const snapshot = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")),
  );
  assert.equal(snapshot.research.weapons, 1);
  assert.equal(snapshot.upgrades.damage, 1);
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")).time,
    ),
    snapshot.time,
    "Paused run does not advance",
  );
  await page.screenshot({ path: join(output, "390-paused.png") });
  await page.getByRole("button", { name: "Save & exit" }).click();
  await page.getByRole("link", { name: /Resume your defense/ }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Resume defense" }).click();
  await page.getByRole("button", { name: /Battle speed 1 times/ }).click();
  await expect(
    page.getByRole("button", { name: /Battle speed 2 times/ }),
  ).toBeVisible();
  await page.waitForTimeout(1300);
  await noOverflow();
  await page.screenshot({
    path: join(output, "390-battle.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: join(output, "1440-battle.png"),
    fullPage: true,
  });
  // A browser reload restores from checkpoint and never silently replaces it.
  await go("/nexus/loadout/endless");
  await expect(
    page.getByRole("link", { name: "Resume saved run" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace saved run" }).click();
  await page.getByRole("button", { name: "Deploy nexus" }).click();
  await page.getByRole("button", { name: "Start defense" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(dialog).toBeVisible();
  // Direct URLs cannot bypass campaign unlocks.
  await go("/nexus/battle/8");
  await expect(
    page.getByRole("heading", { name: "Sector locked." }),
  ).toBeVisible();
  // Exercise every live weapon and the exact-value upgrade previews in real UI.
  await go();
  await page.evaluate(() => window.stageNexusBattle());
  await go("/nexus/battle/endless");
  await page.getByRole("button", { name: "Resume defense" }).click();
  await page.getByRole("button", { name: "Open weapon systems" }).click();
  await expect(page.getByText("4 / 4 online")).toBeVisible();
  await page.getByRole("button", { name: "Return to defense" }).click();
  await page.getByRole("tab", { name: "Weapons", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Chain arc, level 1/ }),
  ).toContainText("targets");
  await page.getByRole("button", { name: /Rail lance, level 1/ }).click();
  await expect(
    page.getByRole("button", { name: /Rail lance, level 2/ }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = JSON.parse(
            localStorage.getItem("nexus_core_run_v2:member:club"),
          );
          return ["pulse", "arc", "rail", "orbit"].every(
            (k) => s.metrics.damage[k] > 0,
          );
        }),
      { timeout: 10000 },
    )
    .toBe(true);
  await noOverflow();
  await page.screenshot({
    path: join(output, "1440-weapon-systems.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(output, "390-weapon-systems.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Reward failures show a retry. A retry unlocks the next sector.
  await go();
  await page.evaluate(() => {
    window.stageNexusResult();
    sessionStorage.setItem("nexus-qa-fail", "1");
  });
  await go("/nexus/results/1");
  await expect(page.getByRole("alert")).toContainText("Offline");
  await expect(page.getByRole("link", { name: "Deploy again" })).toHaveCount(0);
  await page.evaluate(() => {
    window.nexusQa.failClaims = false;
    sessionStorage.removeItem("nexus-qa-fail");
  });
  await page.getByRole("button", { name: "Retry sync →" }).click();
  await expect(page.getByText("Credits and record synced")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Next sector: Fast approach" }),
  ).toBeVisible();
  await page.screenshot({
    path: join(output, "1440-results.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => window.nexusQa.claims),
    2,
    "Result retries only after an explicit retry",
  );
  await go("/nexus/codex");
  await expect(
    page.getByRole("heading", { name: "Know your perimeter." }),
  ).toBeVisible();
  await go("/nexus/research");
  await expect(page.getByLabel("Credit history")).toContainText(
    "first-clear bonus",
  );
  await go("/nexus/leaderboard");
  await expect(
    page.getByRole("heading", { name: "The first record is yours to set." }),
  ).toBeVisible();
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS responsive themes, campaign locks, challenges, research, live upgrades, pause/resume, replacement, 2× speed, blur, reward sync, field guide, and records",
  );
} finally {
  await browser.close();
}
