// Production menu components and engine; isolated account backend, no live writes.
import { chromium, expect } from "@playwright/test";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const output = await mkdtemp(join(tmpdir(), "nexus-menus-"));
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
    const go = (route = "/nexus") =>
      page.goto(
        `http://127.0.0.1:8080/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
        { waitUntil: "networkidle" },
      );
    const within = async (locator, label) => {
      await expect
        .poll(
          async () => {
            const r = await locator.boundingBox();
            return (
              !!r &&
              r.x >= -1 &&
              r.y >= -1 &&
              r.x + r.width <= width + 1 &&
              r.y + r.height <= height + 1
            );
          },
          { message: label },
        )
        .toBe(true);
    };
    const touch = async (locator, label) => {
      await within(locator, label);
      const r = await locator.boundingBox();
      assert.ok(r.height >= 43 && r.width >= 43, label + " has a 44px target");
    };
    const noOverflow = async () =>
      assert.ok(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.body.scrollWidth <= innerWidth,
        ),
        "No horizontal overflow",
      );
    await go();
    await expect(
      page.getByRole("heading", { name: "NEXUS DEFENSE", exact: true }),
    ).toBeVisible();
    const root = page.locator(".nc-game-shell");
    await within(root, "Game frame");
    const rect = await root.boundingBox();
    assert.equal(Math.round(rect.height), height);
    assert.ok(
      await root.evaluate((el) => el.parentElement === document.body),
      "Menu portal escapes page transforms",
    );
    for (const locator of [
      page.getByRole("button", { name: "PLAY", exact: true }),
      page.getByRole("link", { name: "ARSENAL", exact: true }),
      page.getByRole("link", { name: "RESEARCH", exact: true }),
      page.getByRole("link", { name: "RECORDS", exact: true }),
      page.getByRole("link", { name: "Field guide", exact: true }),
    ])
      await touch(locator, "Title control");
    const play = await page
      .getByRole("button", { name: "PLAY", exact: true })
      .boundingBox();
    if (height > width && width < 600)
      assert.ok(play.y > height * 0.5, "Play sits in thumb zone");
    assert.ok(
      (await page.locator(".nc-title-screen").innerText()).split(/\s+/).length <
        45,
      "Title is a game menu, with concise copy",
    );
    assert.equal(
      await page
        .locator(".nc-sigil-outer")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
      "Reduced motion respected",
    );
    await noOverflow();
    await page.screenshot({
      path: join(output, `${width}-${height}-title.png`),
    });
    if (width === 390) {
      await page.setViewportSize({ width, height: 700 });
      await touch(
        page.getByRole("button", { name: "PLAY", exact: true }),
        "Play after browser resize",
      );
      await page.addStyleTag({
        content:
          ".nx-mode.nc-shell.nc-game-shell,.nx-mode.nc-shell.nc-menu-actionbar { --nc-menu-safe-top:24px; --nc-menu-safe-bottom:34px; }",
      });
      const button = await page
        .getByRole("button", { name: "PLAY", exact: true })
        .boundingBox();
      assert.ok(button.y + button.height < 700 - 34);
      await page.screenshot({ path: join(output, "390-safe-area.png") });
      await page.setViewportSize({ width, height });
    }
    await go("/nexus/loadout/endless");
    await expect(
      page.getByRole("heading", { name: "Loadout", exact: true }),
    ).toBeVisible();
    await touch(
      page.getByRole("button", { name: "Deploy", exact: true }),
      "Deploy dock",
    );
    await touch(
      page.getByRole("button", { name: "Save loadout", exact: true }),
      "Save dock",
    );
    await expect(
      page.getByRole("button", { name: "Equip Orbital blades", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "About Orbital blades", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Orbital blades", exact: true }),
    ).toBeVisible();
    await within(page.getByRole("dialog"), "Item details");
    await touch(
      page.getByRole("button", { name: "Done", exact: true }),
      "Details close",
    );
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    await page.getByRole("tab", { name: /Support/ }).tap();
    await expect(
      page.getByRole("button", { name: "Equip Repair nanites", exact: true }),
    ).toBeDisabled();
    await page.getByRole("tab", { name: /Weapons/ }).tap();
    await noOverflow();
    await page.screenshot({
      path: join(output, `${width}-${height}-loadout.png`),
    });
    await go("/nexus/research");
    await expect(
      page.getByRole("heading", { name: "Core lab", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Wave milestones", exact: true })
      .tap();
    await expect(
      page.getByRole("dialog", { name: "Wave milestones", exact: true }),
    ).toBeVisible();
    await within(page.getByRole("dialog"), "Milestones");
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    await page.getByRole("tab", { name: "Research", exact: true }).tap();
    await expect(
      page.getByRole("button", {
        name: "Research Weapon amplifier",
        exact: true,
      }),
    ).toBeDisabled();
    await noOverflow();
    await page.screenshot({
      path: join(output, `${width}-${height}-research.png`),
    });
    await go("/nexus/codex");
    assert.equal(
      await page.locator(".nc-guide-section[open]").count(),
      0,
      "Guide details start folded",
    );
    await page.getByText("Weapons & support", { exact: true }).tap();
    await expect(page.getByText("Pulse cannon", { exact: true })).toBeVisible();
    await noOverflow();
    await go();
    await page.getByRole("button", { name: "PLAY", exact: true }).tap();
    await expect(
      page.getByRole("main", { name: "Nexus Defense battle" }),
    ).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club"))
              .time,
        ),
      )
      .toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Pause defense", exact: true })
      .tap();
    await page.getByRole("button", { name: "Save & exit", exact: true }).tap();
    await expect(page.getByRole("button", { name: /^RESUME/ })).toBeVisible();
    await page.getByRole("button", { name: /^RESUME/ }).tap();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Resume defense", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Pause defense", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "End run & collect", exact: true })
      .tap();
    await expect(
      page.getByText("Rewards saved", { exact: true }),
    ).toBeVisible();
    await touch(
      page.getByRole("button", { name: "PLAY AGAIN", exact: true }),
      "Play again",
    );
    await page.screenshot({
      path: join(output, `${width}-${height}-results.png`),
    });
    await page.getByRole("button", { name: "PLAY AGAIN", exact: true }).tap();
    await expect(
      page.getByRole("main", { name: "Nexus Defense battle" }),
    ).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    if (width === 390) {
      await page
        .getByRole("button", { name: "Pause defense", exact: true })
        .tap();
      await page
        .getByRole("button", { name: "Save & exit", exact: true })
        .tap();
      await page.getByRole("link", { name: "Field guide", exact: true }).tap();
      await page
        .getByRole("link", { name: "Back to title", exact: true })
        .tap();
      await page.getByRole("link", { name: "Exit Nexus", exact: true }).tap();
      assert.equal(
        await page.evaluate(() =>
          document.body.classList.contains("nc-menu-active"),
        ),
        false,
        "Leaving Nexus unlocks document",
      );
    }
    await context.close();
  }
  const motionContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "no-preference",
  });
  const motionPage = await motionContext.newPage();
  motionPage.on("pageerror", (e) => errors.push(e.message));
  await installNexusFixture(motionPage);
  await motionPage.goto(
    "http://127.0.0.1:8080/scripts/fixtures/nexus-core.html",
    { waitUntil: "networkidle" },
  );
  await motionPage.waitForTimeout(1200);
  assert.notEqual(
    await motionPage
      .locator(".nc-sigil-outer")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  const svg = await motionPage.locator(".nc-sigil").boundingBox(),
    ring = await motionPage
      .locator(".nc-sigil-outer > circle")
      .first()
      .boundingBox();
  assert.ok(
    Math.abs(svg.x + svg.width / 2 - ring.x - ring.width / 2) < 2 &&
      Math.abs(svg.y + svg.height / 2 - ring.y - ring.height / 2) < 2,
    "Animated rings stay centered on the core",
  );
  await motionPage.screenshot({ path: join(output, "390-animated-title.png") });
  await motionContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS full-screen menus, concise title, thumb controls, fixed deployment actions, details, milestones, folded guide, one-tap play/replay, paused resume and exit cleanup",
  );
} finally {
  await browser.close();
}
