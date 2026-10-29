// Actual game UI + engine, isolated account backend. Vite must run on :8080.
import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
const output = await mkdtemp(join(tmpdir(), "nexus-mobile-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
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
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await installNexusFixture(page);
    const go = async (route = "/nexus") =>
      page.goto(
        `http://127.0.0.1:8080/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
        { waitUntil: "networkidle" },
      );
    const within = async (locator, label) => {
      await expect
        .poll(
          async () => {
            const r = await locator.boundingBox(),
              v = page.viewportSize();
            return (
              !!r &&
              r.x >= -1 &&
              r.y >= -1 &&
              r.x + r.width <= v.width + 1 &&
              r.y + r.height <= v.height + 1
            );
          },
          { message: `${label} stays within viewport` },
        )
        .toBe(true);
    };
    const thumbTarget = async (locator, label) => {
      await within(locator, label);
      const r = await locator.boundingBox();
      assert.ok(
        r.width >= 43 && r.height >= 43,
        `${label} has at least a 44px touch target`,
      );
      if (width < 800 && height > width)
        assert.ok(
          r.y + r.height / 2 >= height * 0.5,
          `${label} stays in the lower half`,
        );
    };
    await go();
    await page.evaluate(() => window.stageNexusReady());
    await go("/nexus/battle/endless");
    await page.evaluate(() => document.fonts.ready);
    const intro = page.getByRole("alertdialog");
    await expect(intro).toBeVisible();
    await within(intro, "Deployment screen");
    await within(
      page.getByRole("button", { name: "Start defense" }),
      "Start defense",
    );
    if (width < 800 && height > width) {
      const r = await intro.boundingBox();
      await page.screenshot({ path: join(output, `${width}-entry-debug.png`) });

      assert.ok(
        Math.abs(r.width - width) < 1 && Math.abs(r.height - height) < 1,
        `Deployment fills the screen: ${JSON.stringify(r)} vs ${width}×${height}`,
      );
      const start = await page
        .getByRole("button", { name: "Start defense" })
        .boundingBox();
      assert.ok(start.y > height * 0.7, "Start is reachable near the bottom");
    }
    await page.screenshot({
      path: join(output, `${width}-${height}-entry.png`),
    });
    await page.getByRole("button", { name: "Start defense" }).tap();
    await expect(intro).toBeHidden();
    const screen = page.getByRole("main", { name: "Nexus Defense battle" });
    await within(screen, "Battle screen");
    const rect = await screen.boundingBox();
    assert.equal(Math.round(rect.height), height);
    assert.equal(Math.round(rect.width), width);
    assert.equal(
      await page.locator(".nc-header").count(),
      0,
      "The site header is absent during combat",
    );
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).overflowY),
      "hidden",
      "Battle does not scroll the document",
    );
    const field = await page.locator(".nc-field").boundingBox();
    assert.ok(
      field.height >= 170 && field.width >= 240,
      "The arena retains useful space",
    );
    for (const [locator, name] of [
      [page.getByRole("button", { name: "Nova burst ready" }), "Nova"],
      [page.getByRole("button", { name: "Overdrive ready" }), "Overdrive"],
      [page.getByRole("button", { name: "Pause defense" }), "Pause"],
      [page.getByRole("button", { name: /Battle speed/ }), "Speed"],
      [page.getByRole("button", { name: "Open weapon systems" }), "Systems"],
    ])
      await thumbTarget(locator, name);
    for (const tab of ["Attack", "Weapons", "Defense", "Utility"])
      await thumbTarget(page.getByRole("tab", { name: tab, exact: true }), tab);
    await within(page.locator(".nc-upgrade-list"), "Upgrade strip");
    await within(
      page.getByRole("button", { name: /Weapon power, level 0/ }),
      "First upgrade",
    );
    await page.getByRole("button", { name: /Weapon power, level 0/ }).tap();
    await expect(
      page.getByRole("button", { name: /Weapon power, level 1/ }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Defense", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: /Hull plating/ }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Attack", exact: true }).tap();
    if (width < 800 && height > width) {
      const strip = await page.locator(".nc-upgrade-list").boundingBox();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.synthesizeScrollGesture", {
        x: Math.round(strip.x + strip.width * 0.7),
        y: Math.round(strip.y + strip.height * 0.5),
        xDistance: -240,
        yDistance: 0,
        gestureSourceType: "touch",
      });
      await expect
        .poll(() =>
          page.locator(".nc-upgrade-list").evaluate((el) => el.scrollLeft),
        )
        .toBeGreaterThan(0);
      await within(
        page.getByRole("tab", { name: "Utility", exact: true }),
        "Tabs after a swipe",
      );
    }
    await page.screenshot({
      path: join(output, `${width}-${height}-battle.png`),
    });
    await page.getByRole("button", { name: "Pause defense" }).tap();
    const pause = page.getByRole("alertdialog");
    await expect(pause).toBeVisible();
    await within(pause, "Pause menu");
    await within(
      page.getByRole("button", { name: "Resume defense" }),
      "Resume",
    );
    await within(
      page.getByRole("button", { name: "Save & exit" }),
      "Save and exit",
    );
    await within(
      page.getByRole("button", { name: "End run & collect" }),
      "End run and collect",
    );
    const saved = await page.evaluate(() =>
      localStorage.getItem("nexus_core_run_v2:member:club"),
    );
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("nexus_core_run_v2:member:club"),
      ),
      saved,
      "Paused battles remain frozen",
    );
    await page.screenshot({
      path: join(output, `${width}-${height}-pause.png`),
    });
    await page.getByRole("button", { name: "Resume defense" }).tap();
    await page.getByRole("button", { name: "Open weapon systems" }).tap();
    const systems = page.getByRole("dialog", {
      name: "Weapon systems",
      exact: true,
    });
    await expect(systems).toBeVisible();
    await within(systems, "Systems panel");
    await page
      .getByRole("combobox", { name: "Prioritize" })
      .selectOption("fastest");
    await within(
      page.getByRole("button", { name: "Return to defense" }),
      "Return to defense",
    );
    const menuSave = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")).time,
    );
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club"))
            .time,
      ),
      menuSave,
      "Inspecting systems pauses the simulation",
    );
    await page.screenshot({
      path: join(output, `${width}-${height}-systems.png`),
    });
    await page.getByRole("button", { name: "Return to defense" }).tap();
    await expect(systems).toBeHidden();
    if (width === 390) {
      await page.setViewportSize({ width, height: 700 });
      await within(screen, "Dynamic browser-height battle");
      await thumbTarget(
        page.getByRole("button", { name: "Pause defense" }),
        "Pause after resize",
      );
      await page.addStyleTag({
        content:
          ".nx-mode.nc-shell.nc-play-screen,.nx-mode.nc-shell.nc-game-dialog { --nc-safe-top:24px; --nc-safe-bottom:34px; }",
      });
      await within(
        page.getByRole("tab", { name: "Utility", exact: true }),
        "Safe-area tabs",
      );
      const tab = await page
        .getByRole("tab", { name: "Utility", exact: true })
        .boundingBox();
      assert.ok(
        tab.y + tab.height <= 700 - 33,
        "Tabs clear the home indicator",
      );
      await page.screenshot({ path: join(output, "390-safe-area.png") });
    }
    await page.getByRole("button", { name: "Pause defense" }).tap();
    await page.getByRole("button", { name: "Save & exit" }).tap();
    await expect(
      page.getByRole("heading", { name: "Hold the core. Defy the swarm." }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(() =>
        document.body.classList.contains("nc-battle-active"),
      ),
      false,
      "Leaving combat restores page scrolling",
    );
    await context.close();
  }
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS immersive entry, full viewport, thumb targets, touch swipe, upgrades, pause, systems, safe areas, viewport resize, landscape, desktop, and exit cleanup",
  );
} finally {
  await browser.close();
}
