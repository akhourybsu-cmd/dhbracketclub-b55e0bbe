// Production feed, sheets, hooks and media with isolated accounts and transport.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installDropFixture } from "./drop-fixture.mjs";
const base = process.env.DROP_QA_URL || "http://127.0.0.1:8087";
const output = await mkdtemp(join(tmpdir(), "drop-social-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const go = (page, route = "/finds", theme = "dark") =>
  page.goto(
    base +
      "/scripts/fixtures/drop.html?theme=" +
      theme +
      "&route=" +
      encodeURIComponent(route),
    { waitUntil: "networkidle" },
  );
async function setup(width, height, theme = "dark") {
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await installDropFixture(page);
  await go(page, "/finds", theme);
  await expect(page.locator("[data-drop-id]")).toHaveCount(30);
  return page;
}
async function fits(page, locator, label, min = 0) {
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
      { message: label + " fits" },
    )
    .toBe(true);
  if (min) {
    const r = await locator.boundingBox();
    assert.ok(r.width >= min - 1 && r.height >= min - 1, label + " target");
  }
}
try {
  if (!process.env.DROP_QA_INTERACTIONS_ONLY) {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [844, 390],
      [1440, 900],
    ])
      for (const theme of ["light", "dark"]) {
        console.log("Checking", width + "×" + height, theme);
        const page = await setup(width, height, theme);
        await page.evaluate(() => document.fonts.ready);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "No horizontal overflow",
        );
        assert.equal(
          await page
            .locator(".drop-social-feed")
            .evaluate((el) => getComputedStyle(el).overflowY),
          "visible",
          "Feed uses native document scrolling",
        );
        assert.equal(
          await page.locator(".drop-snap-feed").count(),
          0,
          "No forced snap carousel",
        );
        await fits(
          page,
          page.getByRole("button", { name: "Share a Drop", exact: true }),
          "Share entry",
          44,
        );
        const first = page.locator("[data-drop-id]").first();
        for (const name of ["Like Drop", "Open comments", "Share this Drop"]) {
          const button = first.getByRole("button", { name, exact: true });
          await button.scrollIntoViewIfNeeded();
          const r = await button.boundingBox();
          assert.ok(r.width >= 43 && r.height >= 43, name + "44px");
        }
        await page.evaluate(() => document.body.scrollTo(0, 0));
        await page.screenshot({
          path: join(output, width + "-" + height + "-" + theme + ".png"),
        });
        const before = await page.evaluate(() => document.body.scrollTop);
        await page.mouse.move(width / 2, height / 2);
        await page.mouse.wheel(0, 420);
        await expect
          .poll(() => page.evaluate(() => document.body.scrollTop))
          .toBeGreaterThan(before);
        await page
          .getByRole("button", { name: "Share a Drop", exact: true })
          .click();
        const dialog = page.getByRole("dialog", {
          name: "New Drop",
          exact: true,
        });
        await expect(dialog).toBeVisible();
        await fits(page, dialog, "Composer");
        await fits(
          page,
          dialog.getByRole("button", { name: "Share Drop", exact: true }),
          "Publish",
          44,
        );
        await page.screenshot({
          path: join(
            output,
            width + "-" + height + "-" + theme + "-compose.png",
          ),
        });
        await page.close();
      }
  }
  const page = await setup(390, 844);
  await page.getByRole("button", { name: "Search Drops", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search Drops", exact: true })
    .fill("weekend");
  await expect(page.locator("[data-drop-id]").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Close Drop search", exact: true })
    .click();
  await expect(page.locator("[data-drop-id]")).toHaveCount(30);
  await page
    .getByRole("button", { name: "Browse Drop archive", exact: true })
    .click();
  await fits(
    page,
    page.getByRole("dialog", { name: "From the archive", exact: true }),
    "Archive",
  );
  await page.keyboard.press("Escape");
  let first = page.locator("[data-drop-id]").first();
  const firstId = await first.getAttribute("data-drop-id");
  await first.getByRole("button", { name: "Like Drop", exact: true }).click();
  await expect(
    first.getByRole("button", { name: "Unlike Drop", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  assert.equal(
    await page.evaluate(
      () =>
        window.dropQa.writes.filter(
          (w) => w.table === "daily_find_reactions" && w.verb === "insert",
        ).length,
    ),
    1,
    "One like write",
  );
  await page.evaluate(() => {
    window.dropQa.failReact = true;
  });
  await first.getByRole("button", { name: "Unlike Drop", exact: true }).click();
  await expect(
    first.getByRole("button", { name: "Unlike Drop", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    window.dropQa.failReact = false;
  });
  await first
    .getByRole("button", { name: "Open comments", exact: true })
    .click();
  let sheet = page.getByRole("dialog", { name: /^Comments/ });
  await expect(sheet).toBeVisible();
  await fits(page, sheet, "Comments");
  await expect(
    sheet.getByText("Absolutely in.", { exact: true }),
  ).toBeVisible();
  await sheet
    .getByRole("textbox", { name: "Add a comment", exact: true })
    .fill("Saving this for later.");
  await sheet
    .getByRole("button", { name: "Post comment", exact: true })
    .click();
  await expect(
    sheet.getByText("Saving this for later.", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await first
    .getByRole("button", { name: "Share this Drop", exact: true })
    .click();
  sheet = page.getByRole("dialog", { name: "Share Drop", exact: true });
  await expect(sheet).toBeVisible();
  await fits(page, sheet, "Share");
  await sheet.getByRole("button", { name: "Copy link", exact: true }).click();
  assert.ok(
    await page.evaluate(() => window.dropClipboard?.includes("/finds/")),
    "Copy creates app permalink",
  );
  await expect(
    sheet.getByRole("combobox", { name: "Drop chat channel", exact: true }),
  ).toHaveValue("general");
  await sheet
    .getByRole("button", { name: "Send to Chat", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chat reached", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () =>
        window.dropQa.writes.filter(
          (w) => w.table === "messages" && w.verb === "insert",
        ).length,
    ),
    1,
    "One isolated share message",
  );
  await go(page);
  first = page.locator("[data-drop-id]").first();
  await first
    .getByRole("button", { name: "Play YouTube video", exact: true })
    .click();
  await expect(first.locator("iframe")).toHaveCount(1);
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    "/finds",
  );
  const second = page.locator("[data-drop-id]").nth(1);
  await second
    .getByRole("button", { name: "Play YouTube video", exact: true })
    .click();
  await expect(page.locator(".drop-player-frame iframe")).toHaveCount(1);
  await expect(first.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Share a Drop", exact: true }).click();
  await expect(page.locator(".drop-player-frame iframe")).toHaveCount(0);
  sheet = page.getByRole("dialog", { name: "New Drop", exact: true });
  await expect(sheet.getByRole("radio")).toHaveCount(0);
  await sheet
    .getByRole("textbox", { name: "Your Drop", exact: true })
    .fill("A fresh idea for the weekend.");
  await page.evaluate(() => {
    window.dropQa.failPost = true;
  });
  await sheet.getByRole("button", { name: "Share Drop", exact: true }).click();
  await expect(sheet.getByRole("alert")).toBeVisible();
  await expect(
    sheet.getByRole("textbox", { name: "Your Drop", exact: true }),
  ).toHaveValue("A fresh idea for the weekend.");
  await page.evaluate(() => {
    window.dropQa.failPost = false;
  });
  await sheet.getByRole("button", { name: "Share Drop", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    "/finds",
  );
  await expect(
    page.locator("[data-drop-id]").first().getByRole("heading", {
      name: "A fresh idea for the weekend.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yours", exact: true }).click();
  await expect
    .poll(() => page.locator("[data-drop-id]").count())
    .toBeGreaterThan(0);
  await expect(page.locator(".drop-social-author strong").first()).toHaveText(
    "Alex",
  );
  await page.getByRole("button", { name: "Latest", exact: true }).click();
  await page.getByRole("button", { name: "Search Drops", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search Drops", exact: true })
    .fill("trail");
  await expect(
    page
      .locator("[data-drop-id]")
      .first()
      .getByRole("heading", { name: "Out on the trail", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close Drop search", exact: true })
    .click();
  await page
    .getByRole("button", { name: "More Drops", exact: true })
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() => page.locator("[data-drop-id]").count())
    .toBeGreaterThan(30);
  const ids = await page
    .locator("[data-drop-id]")
    .evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("data-drop-id")),
    );
  assert.equal(
    new Set(ids).size,
    ids.length,
    "Timestamp tie pagination never duplicates",
  );
  assert.deepEqual(errors, []);
  await page.close();
  const failed = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  failed.on("pageerror", (error) => errors.push(error.message));
  await installDropFixture(failed);
  await failed.addInitScript(() => {
    window.__dropFailFeed = true;
  });
  await go(failed);
  await expect(
    failed.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await failed.evaluate(() => {
    window.dropQa.failFeed = false;
  });
  await failed.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(failed.locator("[data-drop-id]")).toHaveCount(30);
  assert.deepEqual(errors, []);
  await failed.close();
  console.log(
    "PASS native feed scrolling, five viewport sizes/both themes, inline reactions/comments/share, drafts/retry, one active player, composer stays in feed and cursor pagination",
  );
} finally {
  await browser.close();
}
