// Production board + hooks + real PostgreSQL protocol, isolated from live data.
import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createFeatsFixture } from "./dh-feats-fixture.mjs";
const output = await mkdtemp(join(tmpdir(), "dh-feats-ui-"));
console.log("Screenshots:", output);
const backend = await createFeatsFixture(),
  { id } = backend;
for (let n = 0; n < 19; n++)
  await backend.seed("daily_finds", {
    user_id: id(1),
    club_id: id(10),
    kind: n % 3 === 0 ? "article" : n % 3 === 1 ? "photo" : "learned",
    title: "Find " + n,
    created_at: "2026-01-01T12:00:00Z",
  });
const initial = await backend.rpc("dh_feats_board", { p_club_id: id(10) });
await backend.rpc("dh_feats_seen", { p_through: initial.data.as_of });
const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  }),
  errors = [];
const go = (page) =>
  page.goto("http://127.0.0.1:8080/scripts/fixtures/dh-feats.html", {
    waitUntil: "networkidle",
  });
const fits = async (page, locator, label) => {
  const r = await locator.boundingBox(),
    v = page.viewportSize();
  assert.ok(
    r &&
      r.x >= -1 &&
      r.y >= -1 &&
      r.x + r.width <= v.width + 1 &&
      r.y + r.height <= v.height + 1,
    `${label} fits ${JSON.stringify(r)}`,
  );
};
const touch = async (page, locator, label) => {
  await fits(page, locator, label);
  const r = await locator.boundingBox();
  assert.ok(
    r.width >= 43 && r.height >= 43,
    `${label} touch size ${JSON.stringify(r)}`,
  );
};
const noScroll = async (page) => {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "No horizontal document overflow",
  );
  const r = await page.locator(".dh-feats-workspace").evaluate((el) => ({
    h: el.clientHeight,
    sh: el.scrollHeight,
    w: el.clientWidth,
    sw: el.scrollWidth,
  }));
  assert.ok(
    r.sh <= r.h + 1 && r.sw <= r.w + 1,
    `No primary-screen scrolling ${JSON.stringify(r)}`,
  );
  for (const card of await page.locator(".dh-feat-card").all()) {
    await fits(page, card, "Feat card");
    const c = await card.boundingBox(),
      a = await page.locator(".dh-list-space").boundingBox();
    assert.ok(
      c.y + c.height <= a.y + a.height + 1,
      `Feat is fully visible in its list ${JSON.stringify({ c, a })}`,
    );
  }
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
        isMobile: width < 1000,
        hasTouch: true,
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await backend.install(page);
    await go(page);
    await expect(
      page.getByRole("heading", { name: "DH SCORE", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Within reach", exact: true }),
    ).toBeVisible();
    await noScroll(page);
    await touch(
      page,
      page.getByRole("button", { name: "About DH Score", exact: true }),
      "Help",
    );
    await page
      .getByRole("button", { name: "About DH Score", exact: true })
      .tap();
    await expect(
      page.getByRole("dialog", { name: "Your DH legacy", exact: true }),
    ).toBeVisible();
    await touch(
      page,
      page.getByRole("button", { name: "Let’s go", exact: true }),
      "Close help",
    );
    await page.getByRole("button", { name: "Let’s go", exact: true }).tap();
    await page.getByRole("button", { name: "Feats", exact: true }).tap();
    await page
      .getByRole("combobox", { name: "Feat feature", exact: true })
      .selectOption("drop");
    await page
      .getByRole("searchbox", { name: "Search feats" })
      .fill("Make the Drop");
    await expect(
      page.getByRole("button", { name: "Make the Drop, Gold", exact: true }),
    ).toBeVisible();
    await noScroll(page);
    await page
      .getByRole("button", { name: "Make the Drop, Gold", exact: true })
      .tap();
    const detail = page.getByRole("dialog", {
      name: "Make the Drop",
      exact: true,
    });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Next: 20", { exact: true })).toBeVisible();
    await touch(
      page,
      page.getByRole("button", { name: "Track this feat", exact: true }),
      "Track",
    );
    await touch(
      page,
      page.getByRole("link", { name: "Jump in", exact: true }),
      "Jump in",
    );
    await page
      .getByRole("button", { name: "Track this feat", exact: true })
      .tap();
    await expect(
      page.getByRole("button", { name: "Untrack feat", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: join(output, `${width}-detail.png`) });
    await detail.getByRole("button", { name: "Close", exact: true }).tap();
    await page.getByRole("button", { name: "Next up", exact: true }).tap();
    await expect(
      page.getByRole("heading", { name: "Your next feats", exact: true }),
    ).toBeVisible();
    await noScroll(page);
    await page.screenshot({ path: join(output, `${width}-next.png`) });
    await page.getByRole("button", { name: "Feats", exact: true }).tap();
    await page
      .getByRole("combobox", { name: "Feat feature", exact: true })
      .selectOption("portfolio");
    await page.getByRole("searchbox", { name: "Search feats" }).fill("Big Day");
    await page
      .getByRole("button", { name: "Big Day, Bronze", exact: true })
      .tap();
    await expect(
      page.getByRole("dialog").getByText("$100", { exact: false }).first(),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .tap();
    await noScroll(page);
    await page.screenshot({ path: join(output, `${width}-collection.png`) });
    await page.getByRole("button", { name: "Club", exact: true }).tap();
    await expect(
      page.getByRole("heading", { name: "Dry My Horse", exact: true }),
    ).toBeVisible();
    await noScroll(page);
    await touch(
      page,
      page.getByRole("button", { name: "This month", exact: true }),
      "Monthly leaderboard",
    );
    await page.getByRole("button", { name: "This month", exact: true }).tap();
    await noScroll(page);
    await page.screenshot({ path: join(output, `${width}-club.png`) });
    await backend.rpc("dh_feats_pin", { p_keys: [] });
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await backend.install(page);
  await go(page);
  await backend.seed("daily_finds", {
    user_id: id(1),
    club_id: id(10),
    kind: "article",
    title: "The twentieth Drop",
  });
  await page
    .getByRole("button", { name: "Refresh DH Score", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: /FEAT.*UNLOCKED/ }),
  ).toBeVisible();
  const before = (await backend.rpc("dh_feats_board", { p_club_id: id(10) }))
    .data.score;
  await page.screenshot({ path: join(output, "unlock.png") });
  await page.getByRole("button", { name: "Keep going", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await go(page);
  await expect(
    page.getByRole("heading", { name: "Within reach", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  assert.equal(
    (await backend.rpc("dh_feats_board", { p_club_id: id(10) })).data.score,
    before,
    "Refreshing cannot grant a duplicate receipt",
  );
  await page.getByRole("button", { name: "Feats", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search feats" })
    .fill("Make the Drop");
  await page
    .getByRole("button", { name: "Make the Drop, Platinum", exact: true })
    .click();
  await page.evaluate(() => {
    window.failFeatPins = true;
  });
  await page
    .getByRole("button", { name: "Track this feat", exact: true })
    .click();
  await expect(
    page.getByText("Tracking could not sync. Try again.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Track this feat", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.failFeatPins = false;
  });
  await page
    .getByRole("button", { name: "Track this feat", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Untrack feat", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Jump in", exact: true }).click();
  await expect(
    page.getByText("Feature destination", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() =>
      document.body.classList.contains("dh-feats-active"),
    ),
    false,
  );
  await page.addInitScript(() => {
    window.featOffline = true;
  });
  await go(page);
  await expect(
    page.getByRole("heading", { name: "DH SCORE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry sync", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => {
    window.featOffline = false;
  });
  await page.getByRole("button", { name: "Retry sync", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your next feats", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.className = "light";
  });
  await noScroll(page);
  await page.screenshot({ path: join(output, "light.png") });
  await page.evaluate(() => {
    document.documentElement.className = "dark";
  });
  await noScroll(page);
  await page.getByRole("button", { name: "Feats", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Club", exact: true }),
  ).toBeFocused();
  const restricted = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await backend.rpc("dh_feats_pin", { p_keys: ["pw_profit"] });
  await backend.install(restricted);
  await restricted.addInitScript(() => {
    window.disabledFeatAssets = ["portfolio-wars"];
  });
  await go(restricted);
  await restricted
    .getByRole("button", { name: "In the Green, Bronze", exact: true })
    .click();
  await expect(
    restricted.getByRole("link", { name: "Jump in", exact: true }),
  ).toHaveCount(0);
  await expect(
    restricted.getByText("This app is currently unavailable in your club.", {
      exact: true,
    }),
  ).toBeVisible();
  await restricted
    .getByRole("button", { name: "Untrack feat", exact: true })
    .click();
  await restricted
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await restricted.getByRole("button", { name: "Feats", exact: true }).click();
  await expect(
    restricted
      .getByRole("combobox", { name: "Feat feature" })
      .locator('option[value="portfolio"]'),
  ).toHaveCount(0);
  await restricted.close();
  await backend.ownerQuery(
    `insert into dh_feat_progress(user_id,feat_key,value) select $1,key,thresholds[cardinality(thresholds)] from dh_feat_catalog on conflict(user_id,feat_key) do update set value=excluded.value`,
    [id(1)],
  );
  await backend.ownerQuery(
    "update dh_feat_accounts set dirty=true where user_id=$1",
    [id(1)],
  );
  const maximum = await backend.rpc("dh_feats_board", { p_club_id: id(10) });
  assert.equal(maximum.data.unlocked, 314);
  assert.equal(maximum.data.score, 18750);
  await backend.rpc("dh_feats_seen", { p_through: maximum.data.as_of });
  const maxPage = await browser.newPage({
    viewport: { width: 320, height: 568 },
    reducedMotion: "reduce",
  });
  await backend.install(maxPage);
  await go(maxPage);
  await expect(
    maxPage.getByText("DH ICON · MAX RANK", { exact: true }),
  ).toBeVisible();
  await expect(
    maxPage.getByText("Every available feat mastered", { exact: true }),
  ).toBeVisible();
  await noScroll(maxPage);
  await maxPage.screenshot({ path: join(output, "max-career.png") });
  await maxPage.getByRole("button", { name: "Feats", exact: true }).click();
  await maxPage
    .getByRole("combobox", { name: "Feat progress filter" })
    .selectOption("mastered");
  await expect(maxPage.getByText("63 families", { exact: true })).toBeVisible();
  await noScroll(maxPage);
  await maxPage.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS eight screen sizes, all board views, real SQL progress and receipts, tracking rollback, cross-reload persistence, offline retry, light/dark, keyboard navigation and exit cleanup",
  );
} finally {
  await browser.close();
  await backend.close();
}
