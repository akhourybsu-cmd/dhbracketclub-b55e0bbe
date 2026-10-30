// Production menus with an isolated backend; no live mutations.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installNexusFixture } from "./nexus-ui-fixture.mjs";
const base = process.env.NEXUS_QA_URL || "http://127.0.0.1:8080";
const output = await mkdtemp(join(tmpdir(), "nexus-expanded-menus-"));
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
        reducedMotion: "reduce",
        hasTouch: true,
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await installNexusFixture(page);
    const go = (route) =>
      page.goto(
        `${base}/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
        { waitUntil: "networkidle" },
      );
    const fits = async () => {
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const geometry = await page
        .locator(".nc-menu-content")
        .evaluate((el) => ({
          height: el.clientHeight,
          scroll: el.scrollHeight,
          width: el.clientWidth,
          scrollWidth: el.scrollWidth,
        }));
      assert.ok(
        geometry.scroll <= geometry.height + 1 &&
          geometry.scrollWidth <= geometry.width + 1,
        `No menu scrolling: ${JSON.stringify(geometry)}`,
      );
      for (const el of await page
        .locator(".nc-selector-keys button,.nc-bay-action-row button")
        .all()) {
        await expect
          .poll(async () => {
            const r = await el.boundingBox();
            return !!r && r.height >= 43 && r.width >= 43;
          })
          .toBe(true);
        const r = await el.boundingBox();
        assert.ok(
          r &&
            r.width >= 43 &&
            r.height >= 43 &&
            r.x >= -1 &&
            r.y >= -1 &&
            r.x + r.width <= width + 1 &&
            r.y + r.height <= height + 1,
          `Visible44px control ${await el.getAttribute("aria-label")}: ${JSON.stringify(r)}`,
        );
      }
      const bay = await page.locator(".nc-equipment-bay").boundingBox();
      const action = await page.locator(".nc-bay-action-row").boundingBox();
      const heading = await page.locator(".nc-bay-heading").boundingBox();
      assert.ok(
        heading &&
          heading.height >= 30 &&
          heading.y >= bay.y - 1 &&
          heading.y + heading.height <= action.y + 1,
        `Equipment heading and actions do not overlap ${JSON.stringify({ bay, action, heading, item: await page.locator(".nc-bay-heading h2").textContent() })}`,
      );
      assert.ok(
        bay &&
          action &&
          action.y >= bay.y - 1 &&
          action.y + action.height <= bay.y + bay.height + 1,
        `Action fits equipment bay ${JSON.stringify({ bay, action, heading, item: await page.locator(".nc-bay-heading h2").textContent() })}`,
      );
    };
    await go("/nexus/loadout/endless");
    await expect(page.locator(".nc-selector-keys button")).toHaveCount(7);
    await fits();
    for (const key of await page.locator(".nc-selector-keys button").all()) {
      await key.tap();
      await fits();
    }
    await page.getByRole("tab", { name: /^Support/ }).tap();
    await expect(page.locator(".nc-selector-keys button")).toHaveCount(5);
    for (const key of await page.locator(".nc-selector-keys button").all()) {
      await key.tap();
      await fits();
    }
    await page.screenshot({
      path: join(output, `${width}-${height}-loadout.png`),
    });
    await go("/nexus/research?tab=armory");
    for (const key of await page.locator(".nc-selector-keys button").all()) {
      await key.tap();
      await fits();
    }
    await page.getByRole("tab", { name: "Support", exact: true }).tap();
    for (const key of await page.locator(".nc-selector-keys button").all()) {
      await key.tap();
      await fits();
    }
    await page.getByRole("tab", { name: "Research", exact: true }).tap();
    for (const key of await page.locator(".nc-selector-keys button").all()) {
      await key.tap();
      await fits();
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "aria-valuemax",
        "30",
      );
      await expect(page.locator(".nc-bay-level i")).toHaveCount(30);
    }
    await page.screenshot({
      path: join(output, `${width}-${height}-research.png`),
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS expanded7weapon/5support selectors,30-level research,44px targets and no scrolling across8sizes",
  );
} finally {
  await browser.close();
}
