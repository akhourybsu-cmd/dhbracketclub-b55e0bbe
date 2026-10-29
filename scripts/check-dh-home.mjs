import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { installHomeFixture } from "./dh-home-fixture.mjs";
const output = await mkdtemp(join(tmpdir(), "dh-home-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  }),
  errors = [];
const go = (page, theme = "dark", scenario = "full") =>
  page.goto(
    "http://127.0.0.1:8080/scripts/fixtures/dh-home.html?theme=" +
      theme +
      "&scenario=" +
      scenario,
    { waitUntil: "networkidle" },
  );
const noOverflow = async (page) =>
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal overflow",
  );
const settle = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
try {
  for (const [width, height] of [
    [320, 568],
    [360, 740],
    [390, 844],
    [430, 932],
    [768, 1024],
    [844, 390],
    [1280, 900],
    [1920, 1080],
  ])
    for (const theme of ["light", "dark"]) {
      console.log(`Checking ${width}×${height} ${theme}`);
      const context = await browser.newContext({
          viewport: { width, height },
          isMobile: width < 1000,
          hasTouch: true,
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await installHomeFixture(page);
      await go(page, theme);
      await expect(
        page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("1,240", { exact: false }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Your draft pick is up",
          exact: true,
        }),
      ).toBeVisible();
      await settle(page);
      await noOverflow(page);
      const contrast = await page
        .locator(
          '.home-text-link,.home-score-rank,.home-feature-caption,.home-feature-detail,.home-feature-footer,.home-tab[aria-selected="true"]',
        )
        .evaluateAll((elements) =>
          elements.map((el) => {
            const rgba = (value) => {
              const n = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
              return [n[0], n[1], n[2], n[3] ?? 1];
            };
            const mix = (front, back) =>
              front
                .slice(0, 3)
                .map((v, i) => v * front[3] + back[i] * (1 - front[3]));
            const layers = [];
            for (let node = el; node; node = node.parentElement)
              layers.push(rgba(getComputedStyle(node).backgroundColor));
            let background = [255, 255, 255];
            for (const color of layers.reverse())
              background = mix(color, background);
            const ink = mix(rgba(getComputedStyle(el).color), background);
            const luminance = (rgb) =>
              rgb
                .map((v) => v / 255)
                .map((v) =>
                  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
                )
                .reduce(
                  (sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i],
                  0,
                );
            const a = luminance(ink),
              b = luminance(background);
            return {
              text: el.textContent.slice(0, 45),
              ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
            };
          }),
        );
      assert.ok(
        contrast.every((c) => c.ratio >= 4.5),
        `Readable secondary text in ${theme}: ${JSON.stringify(contrast.filter((c) => c.ratio < 4.5))}`,
      );
      assert.equal(await page.locator(".home-experience").count(), 1);
      assert.equal(
        await page
          .getByRole("button", { name: /^Notifications(?: \(|$)/ })
          .count(),
        1,
      );
      assert.equal(
        await page.evaluate(() => window.homeQa.widgetsMounted),
        0,
        "Heavy widgets stay unmounted until requested",
      );
      await expect(page.getByText("$58,250", { exact: true })).toBeVisible();
      await expect(
        page.getByText("+16.5% this season", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: "Last 7 recorded portfolio values" }),
      ).toBeVisible();
      const own = await page.evaluate(() =>
        window.homeQa.queries.filter((q) =>
          ["pw_portfolios", "workout_log_sessions"].includes(q.table),
        ),
      );
      assert.ok(
        own.every(
          (q) =>
            q.filters.some(
              (f) => f.key === "user_id" && f.value === "member",
            ) &&
            q.filters.some((f) => f.key === "club_id" && f.value === "club"),
        ),
        "Own data is scoped to member and club",
      );
      assert.equal(
        (await page.evaluate(() => window.homeQa.writes)).length,
        0,
        "Home performs no feature-creation writes",
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: join(output, `${width}-${theme}-top.png`),
      });
      await page.locator(".home-focus-section").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(output, `${width}-${theme}-focus.png`),
      });
      await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
      await expect(
        page
          .getByRole("tabpanel")
          .getByText("Sunday watch party", { exact: true }),
      ).toBeVisible();
      await page.getByRole("tab", { name: "In progress", exact: true }).focus();
      await page.keyboard.press("Home");
      await expect(
        page.getByRole("tab", { name: "Latest", exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Customize shortcuts", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Your shortcuts", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page
        .getByRole("button", { name: "Club extras", exact: true })
        .first()
        .click();
      await expect(
        page.getByRole("dialog", { name: "More from your club", exact: true }),
      ).toBeVisible();
      assert.ok((await page.evaluate(() => window.homeQa.widgetsMounted)) > 0);
      await page.keyboard.press("Escape");
      await context.close();
    }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await installHomeFixture(page);
  await go(page, "light");
  await expect(
    page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View goal: Make the Drop", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Make the Drop", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Next: 20", { exact: true })).toBeVisible();
  await go(page, "light");
  await page.getByRole("link", { name: "Add a Drop", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  assert.equal(
    (await page.evaluate(() => window.homeQa.writes)).length,
    0,
    "Opening the composer creates no post",
  );
  await go(page, "dark", "resume");
  await page.evaluate(() => window.stageHomeRun());
  await expect(
    page.getByRole("heading", { name: "Resume your run", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "For you", exact: true })
    .getByRole("link")
    .first()
    .click();
  await expect(
    page.getByText("/nexus/battle/endless", { exact: true }),
  ).toBeVisible();
  await go(page, "light", "limited");
  await expect(
    page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  assert.equal(await page.locator(".home-feature-card").count(), 0);
  assert.ok(
    !(await page.evaluate(() => window.homeQa.queries)).some((q) =>
      [
        "daily_finds",
        "pw_portfolios",
        "workout_log_sessions",
        "nexus_core_profiles",
      ].includes(q.table),
    ),
    "Unavailable features do not query their signal tables",
  );
  await go(page, "dark", "empty");
  await expect(
    page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await expect(
    page.getByText("0 feats unlocked", { exact: true }),
  ).toBeVisible();
  await go(page, "dark");
  await expect(
    page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.homeQa.failTables = ["activity_feed"];
  });
  await page.getByRole("button", { name: "Refresh home", exact: true }).click();
  await expect(page.locator(".home-error")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hey, Alex.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("$58,250", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Upcoming", exact: true }).click();
  await expect(
    page.getByRole("tabpanel").getByText("Sunday watch party", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.homeQa.failTables = [];
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".home-error")).not.toBeVisible();
  await page.evaluate(() => {
    window.homeQa.failProgress = true;
  });
  await page.getByRole("button", { name: "Refresh home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh your progress", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.homeQa.failProgress = false;
  });
  await page
    .getByRole("button", { name: "Refresh your progress", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View goal: Make the Drop", exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS actual Dashboard/shared shell/signals across eight sizes and both themes; own-data filters, no feature writes, lazy extras, shortcuts, activity, goal/composer deep links, current Nexus resume, unavailable apps and independent error recovery",
  );
} finally {
  await browser.close();
}
