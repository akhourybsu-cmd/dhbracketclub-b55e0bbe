// Production Drop UI and real native playback with browser-local transport.
// node scripts/check-drop-polish.mjs [--visual-only|--interactions-only|--media-only]
// Owns Vite8098 unless DROP_QA_URL supplies an existing preview. No live writes.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { installDropFixture } from "./drop-fixture.mjs";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output =
  process.env.DROP_QA_OUTPUT || (await mkdtemp(join(tmpdir(), "drop-polish-")));
await mkdir(output, { recursive: true });
const base = process.env.DROP_QA_URL || "http://127.0.0.1:8098";
const visualOnly = process.argv.includes("--visual-only");
const interactionsOnly = process.argv.includes("--interactions-only");
const mediaOnly = process.argv.includes("--media-only");
const report = {
  checks: [],
  errors: [],
  runtimeErrors: [],
  artifacts: output,
  fixtures:
    "Production pages, hooks, controls and HTML5 decoder; browser-local identity and isolated backend.",
};
let server, serverLog, serverExit, browser, currentPage;
let serverReady = Boolean(process.env.DROP_QA_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const record = (label, detail = {}) => {
  report.checks.push({ label, ok: true, ...detail });
  console.log("PASS", label);
};
async function cleanup() {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, sleep(1500)]);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill("SIGKILL");
      await Promise.race([exited, sleep(1000)]);
    }
  }
  server?.stdout?.unpipe(serverLog);
  server?.stderr?.unpipe(serverLog);
  serverLog?.end();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => void cleanup().finally(() => process.exit(130)));
async function start() {
  console.log("Drop artifacts:", output);
  if (!process.env.DROP_QA_URL) {
    serverLog = createWriteStream(join(output, "vite.log"));
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "8098",
        "--strictPort",
      ],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("Local:")) serverReady = true;
    });
    server.stdout.pipe(serverLog);
    server.stderr.pipe(serverLog);
    server.on("exit", (code) => {
      serverExit = code;
    });
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverExit !== undefined)
      throw Error("Owned preview exited " + serverExit + "; inspect vite.log");
    try {
      if (serverReady && (await fetch(base + "/scripts/fixtures/drop.html")).ok)
        break;
    } catch {
      /* Bounded startup. */
    }
    if (attempt === 99)
      throw Error("Drop preview did not start within twenty seconds");
    await sleep(200);
  }
  browser = await chromium.launch({
    executablePath: process.env.DROP_QA_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
}
async function setup(width = 390, height = 844, motion = "no-preference") {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    reducedMotion: motion,
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(15_000);
  page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
  await installDropFixture(page);
  return { page, context };
}
async function go(page, route = "/finds", theme = "dark") {
  const params = new URLSearchParams({ route, theme });
  await page.goto(base + "/scripts/fixtures/drop.html?" + params, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => Boolean(window.dropQa));
  await expect(
    page.getByRole("region", { name: "The Drop", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function loaded(page) {
  await expect(
    page
      .locator(
        ".drop-social > .drop-social-feed [data-drop-id], .drop-social [data-drop-id]",
      )
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading Drops", exact: true }),
  ).toHaveCount(0);
}
async function top(page) {
  await page.evaluate(() => {
    document.body.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTo({ top: 0, behavior: "auto" });
  });
}
async function shot(page, label) {
  await page.screenshot({ path: join(output, label + ".png") });
}
async function closeDialog(page) {
  await page.keyboard.press("Escape");
  await expect(
    page.locator('[role="dialog"], [role="alertdialog"]'),
  ).toHaveCount(0);
}
async function fits(page, locator, label, min = 0) {
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox(),
          viewport = page.viewportSize();
        return Boolean(
          box &&
          box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= viewport.width + 1 &&
          box.y + box.height <= viewport.height + 1,
        );
      },
      { message: label + " remains within the viewport" },
    )
    .toBe(true);
  if (min) {
    const box = await locator.boundingBox();
    assert.ok(
      box.width >= min - 1 && box.height >= min - 1,
      label + " is at least " + min + "px",
    );
  }
}
async function cardTargets(page, card) {
  for (const label of ["Like Drop", "Open comments", "Share this Drop"]) {
    const button = card.getByRole("button", { name: label, exact: true });
    await button.scrollIntoViewIfNeeded();
    await fits(page, button, label, 44);
  }
}
async function visual(width, height, theme) {
  const label = width + "x" + height + "-" + theme;
  const { page, context } = await setup(
    width,
    height,
    width === 390 ? "reduce" : "no-preference",
  );
  try {
    await go(page, "/finds", theme);
    await loaded(page);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "No horizontal document overflow",
    );
    assert.equal(
      await page
        .locator(".drop-social-feed")
        .first()
        .evaluate((el) => getComputedStyle(el).overflowY),
      "visible",
      "The feed uses native document scrolling",
    );
    await expect(page.locator(".drop-snap-feed")).toHaveCount(0);
    for (const name of ["Share a Drop", "Search Drops", "Browse Drop archive"])
      await fits(
        page,
        page.getByRole("button", { name, exact: true }).first(),
        name,
        44,
      );
    await shot(page, label + "-feed");
    record(label + "-feed-fit-native-scroll");
    await cardTargets(page, page.locator("[data-drop-id]").first());
    const previous = await page.evaluate(() => document.body.scrollTop);
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => page.evaluate(() => document.body.scrollTop))
      .toBeGreaterThan(previous);
    record(label + "-44px-actions-and-wheel-scroll");
    await top(page);
    await page
      .getByRole("button", { name: "Share a Drop", exact: true })
      .first()
      .click();
    let sheet = page.getByRole("dialog", { name: "New Drop", exact: true });
    await expect(sheet).toBeVisible();
    await fits(page, sheet, "Composer");
    await fits(
      page,
      sheet.getByRole("button", { name: "Share Drop", exact: true }),
      "Share Drop",
      44,
    );
    await shot(page, label + "-compose");
    await closeDialog(page);
    record(label + "-composer-fit");
    const first = page.locator("[data-drop-id]").first();
    await first
      .getByRole("button", { name: "Open comments", exact: true })
      .click();
    sheet = page.getByRole("dialog", { name: /^Comments/ });
    await expect(sheet).toBeVisible();
    await fits(page, sheet, "Comments");
    await fits(
      page,
      sheet.getByRole("textbox", { name: "Add a comment", exact: true }),
      "Comment field",
    );
    await fits(
      page,
      sheet.getByRole("button", { name: "Post comment", exact: true }),
      "Post comment",
      44,
    );
    await shot(page, label + "-comments");
    await closeDialog(page);
    await first
      .getByRole("button", { name: "Share this Drop", exact: true })
      .click();
    sheet = page.getByRole("dialog", { name: "Share Drop", exact: true });
    await expect(sheet).toBeVisible();
    await fits(page, sheet, "Sharing");
    await fits(
      page,
      sheet.getByRole("button", { name: "Copy link", exact: true }),
      "Copy link",
      44,
    );
    await shot(page, label + "-share");
    await closeDialog(page);
    record(label + "-comments-and-share-fit");
    await top(page);
    await page
      .getByRole("button", { name: "Browse Drop archive", exact: true })
      .click();
    sheet = page.getByRole("dialog", { name: "From the archive", exact: true });
    await expect(sheet).toBeVisible();
    await fits(page, sheet, "Archive");
    const calendar = await sheet.locator(".drop-calendar").evaluate((root) => {
      const bounds = root.getBoundingClientRect();
      const targets = [...root.querySelectorAll("button")].map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.getAttribute("aria-label"),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      });
      return {
        targets,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      };
    });
    assert.ok(calendar.targets.length > 28, "Archive contains its month grid");
    assert.deepEqual(
      calendar.targets.filter(
        (target) => target.width < 43.5 || target.height < 43.5,
      ),
      [],
      "Archive dates and month controls retain 44px touch targets",
    );
    assert.deepEqual(
      calendar.targets.filter(
        (target) =>
          target.x < calendar.bounds.x - 0.75 ||
          target.y < calendar.bounds.y - 0.75 ||
          target.x + target.width >
            calendar.bounds.x + calendar.bounds.width + 0.75 ||
          target.y + target.height >
            calendar.bounds.y + calendar.bounds.height + 0.75,
      ),
      [],
      "Calendar controls remain within their calendar surface",
    );
    const overlaps = [];
    for (let i = 0; i < calendar.targets.length; i++)
      for (let j = i + 1; j < calendar.targets.length; j++) {
        const a = calendar.targets[i],
          b = calendar.targets[j];
        const width =
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const height =
          Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (width > 0.75 && height > 0.75)
          overlaps.push({ first: a.label, second: b.label, width, height });
      }
    assert.deepEqual(overlaps, [], "Calendar targets never overlap");
    await shot(page, label + "-archive");
    await closeDialog(page);
    record(label + "-archive-fit");
  } catch (error) {
    await shot(page, label + "-failure").catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
async function interactions() {
  const { page, context } = await setup();
  try {
    await go(page);
    await loaded(page);
    await page.getByRole("button", { name: "Yours", exact: true }).click();
    await expect(page.locator(".drop-social-author strong").first()).toHaveText(
      "Alex",
    );
    await page.getByRole("button", { name: "Latest", exact: true }).click();
    await expect(page.locator("[data-drop-id]").first()).toBeVisible();
    await page
      .getByRole("button", { name: "Search Drops", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Search Drops", exact: true })
      .fill("trail");
    await expect(
      page.locator("[data-drop-id]").first().getByRole("heading", {
        name: "Out on the trail",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close Drop search", exact: true })
      .click();
    await expect(
      page.getByRole("searchbox", { name: "Search Drops", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("[data-drop-id]").first()).toBeVisible();
    record("filter-search-and-feed-return");
    // Warm more than one feed page so a broad interaction refetch would be
    // observable as multiple reads rather than an indistinguishable first page.
    await page.locator(".drop-social-more").scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.locator("[data-drop-id]").count())
      .toBeGreaterThan(30);
    let first = page.locator("[data-drop-id]").first();
    const like = first.getByRole("button", { name: "Like Drop", exact: true });
    await like.scrollIntoViewIfNeeded();
    const beforeLike = await page.evaluate(() => ({
      reads: window.dropQa.queries.filter(
        (query) => query.table === "daily_finds" && query.verb === "select",
      ).length,
      id: document
        .querySelector("[data-drop-id]")
        ?.getAttribute("data-drop-id"),
      rows: document.querySelectorAll("[data-drop-id]").length,
      scroll: document.body.scrollTop,
    }));
    await like.click();
    await expect(
      first.getByRole("button", { name: "Unlike Drop", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      first.getByRole("button", { name: "Unlike Drop", exact: true }),
    ).toBeEnabled();
    const afterLike = await page.evaluate(() => ({
      reads: window.dropQa.queries.filter(
        (query) => query.table === "daily_finds" && query.verb === "select",
      ).length,
      id: document
        .querySelector("[data-drop-id]")
        ?.getAttribute("data-drop-id"),
      rows: document.querySelectorAll("[data-drop-id]").length,
      scroll: document.body.scrollTop,
    }));
    assert.equal(
      afterLike.reads - beforeLike.reads,
      1,
      "A like confirms its one changed row without rereading every loaded page",
    );
    assert.equal(
      afterLike.id,
      beforeLike.id,
      "Like confirmation retains feed order",
    );
    assert.equal(
      afterLike.rows,
      beforeLike.rows,
      "Like confirmation retains loaded pages",
    );
    assert.ok(
      Math.abs(afterLike.scroll - beforeLike.scroll) < 3,
      "Like confirmation retains the reading position",
    );
    record("multi-page-like-confirms-one-row-without-feed-refetch", {
      loadedRows: beforeLike.rows,
      confirmationReads: afterLike.reads - beforeLike.reads,
    });
    assert.equal(
      await page.evaluate(
        () =>
          window.dropQa.writes.filter(
            (w) => w.table === "daily_find_reactions" && w.verb === "insert",
          ).length,
      ),
      1,
    );
    await page.evaluate(() => {
      window.dropQa.failReact = true;
    });
    await first
      .getByRole("button", { name: "Unlike Drop", exact: true })
      .click();
    await expect(
      first.getByRole("button", { name: "Unlike Drop", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => {
      window.dropQa.failReact = false;
    });
    record("one-like-write-and-failed-unlike-rollback");
    await first
      .getByRole("button", { name: "Open comments", exact: true })
      .click();
    let sheet = page.getByRole("dialog", { name: /^Comments/ });
    await expect(
      sheet.getByText("Absolutely in.", { exact: true }),
    ).toBeVisible();
    const comment = sheet.getByRole("textbox", {
      name: "Add a comment",
      exact: true,
    });
    await comment.fill("Keeping this one for the weekend.");
    await page.evaluate(() => {
      window.dropQa.failComment = true;
    });
    await sheet
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(sheet.getByRole("alert")).toBeVisible();
    await expect(comment).toHaveValue("Keeping this one for the weekend.");
    await page.evaluate(() => {
      window.dropQa.failComment = false;
    });
    await sheet
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(
      sheet.getByText("Keeping this one for the weekend.", { exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () =>
          window.dropQa.writes.filter(
            (w) => w.table === "daily_find_comments" && w.verb === "insert",
          ).length,
      ),
      1,
    );
    await closeDialog(page);
    record("comment-retry-preserves-draft-and-posts-once");
    await first
      .getByRole("button", { name: "Share this Drop", exact: true })
      .click();
    sheet = page.getByRole("dialog", { name: "Share Drop", exact: true });
    await sheet.getByRole("button", { name: "Copy link", exact: true }).click();
    assert.ok(
      await page.evaluate(() => window.dropClipboard?.includes("/finds/")),
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
    );
    record("copy-permalink-and-isolated-chat-share");
    await go(page);
    await loaded(page);
    first = page.locator("[data-drop-id]").first();
    await first
      .getByRole("button", { name: "Play YouTube video", exact: true })
      .click();
    await expect(first.locator("iframe")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Share a Drop", exact: true })
      .first()
      .click();
    await expect(page.locator(".drop-player-frame iframe")).toHaveCount(0);
    sheet = page.getByRole("dialog", { name: "New Drop", exact: true });
    await expect(sheet.getByRole("radio")).toHaveCount(0);
    await sheet
      .getByRole("textbox", { name: "Your Drop", exact: true })
      .fill("A fresh idea for the weekend.");
    await page.evaluate(() => {
      window.dropQa.failPost = true;
    });
    await sheet
      .getByRole("button", { name: "Share Drop", exact: true })
      .click();
    await expect(sheet.getByRole("alert")).toBeVisible();
    await expect(
      sheet.getByRole("textbox", { name: "Your Drop", exact: true }),
    ).toHaveValue("A fresh idea for the weekend.");
    await page.evaluate(() => {
      window.dropQa.failPost = false;
    });
    await sheet
      .getByRole("button", { name: "Share Drop", exact: true })
      .click();
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
    record("composer-pauses-media-and-retries-without-leaving-feed");
    const expected = await page.evaluate(
      () => window.dropQa.tables.daily_finds.length,
    );
    for (
      let i = 0;
      i < 4 && (await page.locator("[data-drop-id]").count()) < expected;
      i++
    ) {
      const previous = await page.locator("[data-drop-id]").count();
      await page.locator(".drop-social-more").scrollIntoViewIfNeeded();
      await expect
        .poll(() => page.locator("[data-drop-id]").count())
        .toBeGreaterThan(previous);
    }
    const ids = await page
      .locator("[data-drop-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-drop-id")),
      );
    assert.equal(
      ids.length,
      expected,
      "All rows remain reachable through cursor paging",
    );
    assert.equal(new Set(ids).size, ids.length, "Paging never duplicates ids");
    record("long-feed-cursor-pagination-with-timestamp-ties", {
      rows: ids.length,
    });
  } catch (error) {
    await shot(page, "interactions-failure").catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
  const failure = await setup();
  try {
    await failure.page.addInitScript(() => {
      window.__dropFailFeed = true;
    });
    await go(failure.page);
    await expect(
      failure.page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    await failure.page.evaluate(() => {
      window.dropQa.failFeed = false;
    });
    await failure.page
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await loaded(failure.page);
    record("failed-feed-retry");
  } finally {
    await failure.context.close();
  }
}
async function nativeMedia() {
  const clip = process.env.DROP_QA_CLIP || join(output, "native-clip.webm");
  if (!existsSync(clip))
    execFileSync(
      "ffmpeg",
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x180:rate=24",
        "-t",
        "12",
        "-c:v",
        "libvpx",
        "-an",
        "-y",
        clip,
      ],
      { stdio: "ignore" },
    );
  const { page, context } = await setup(800, 1400, "reduce");
  try {
    const clipBytes = await readFile(clip);
    let clipRequests = 0;
    await page.route("**/clip.webm*", (route) => {
      clipRequests++;
      const headers = {
        "accept-ranges": "bytes",
        "content-type": "video/webm",
        "cache-control": "no-store",
      };
      const range = route.request().headers()["range"];
      if (!range)
        return route.fulfill({
          status: 200,
          headers: { ...headers, "content-length": String(clipBytes.length) },
          body: clipBytes,
        });
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return route.fulfill({
          status: 416,
          headers: {
            ...headers,
            "content-range": "bytes */" + clipBytes.length,
          },
          body: "",
        });
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, clipBytes.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(Number(match[2]), clipBytes.length - 1)
          : clipBytes.length - 1;
      if (start > end || start >= clipBytes.length)
        return route.fulfill({
          status: 416,
          headers: {
            ...headers,
            "content-range": "bytes */" + clipBytes.length,
          },
          body: "",
        });
      const body = clipBytes.subarray(start, end + 1);
      return route.fulfill({
        status: 206,
        headers: {
          ...headers,
          "content-range":
            "bytes " + start + "-" + end + "/" + clipBytes.length,
          "content-length": String(body.length),
        },
        body,
      });
    });
    await page.goto(base + "/scripts/fixtures/drop-media-qa.html", {
      waitUntil: "domcontentloaded",
    });
    const videos = page.locator("video");
    await expect(videos).toHaveCount(2);
    await page.evaluate(() => {
      window.__dropMediaTrace = [];
      for (const type of [
        "loadedmetadata",
        "seeking",
        "seeked",
        "play",
        "playing",
        "pause",
        "waiting",
        "stalled",
        "emptied",
        "ended",
        "error",
      ])
        document.addEventListener(
          type,
          (event) => {
            const video = event.target;
            if (!(video instanceof HTMLVideoElement)) return;
            const ranges = (range) =>
              Array.from({ length: range.length }, (_, index) => [
                range.start(index),
                range.end(index),
              ]);
            window.__dropMediaTrace.push({
              event: type,
              video: [...document.querySelectorAll("video")].indexOf(video),
              stamp: Math.round(performance.now()),
              time: video.currentTime,
              paused: video.paused,
              seeking: video.seeking,
              readyState: video.readyState,
              duration: video.duration,
              src: video.getAttribute("src"),
              seekable: ranges(video.seekable),
              error: video.error?.code ?? null,
            });
            if (window.__dropMediaTrace.length > 80)
              window.__dropMediaTrace.shift();
          },
          true,
        );
    });
    assert.equal(await videos.first().getAttribute("src"), null);
    assert.equal(
      clipRequests,
      0,
      "Video bytes remain deferred until explicit play",
    );
    const firstFrame = page.locator("[data-drop-player]").first();
    const firstMedia = page.locator(".drop-video-preview").first();
    await firstFrame
      .getByRole("button", { name: "Play video", exact: true })
      .click();
    await expect
      .poll(() =>
        videos
          .first()
          .evaluate((video) => !video.paused && video.currentTime > 0.15),
      )
      .toBe(true);
    // Seek the real decoder precisely, then operate the production pause/resume controls.
    await videos.first().evaluate((video) => {
      video.currentTime = 2.25;
    });
    await page.waitForFunction(() => {
      const video = document.querySelector("video");
      return (
        video &&
        video.currentTime >= 2 &&
        !video.seeking &&
        window.__dropMediaTrace.some(
          (event) =>
            event.video === 0 && event.event === "seeked" && event.time >= 2,
        )
      );
    });
    await firstMedia
      .getByRole("button", { name: "Pause video", exact: true })
      .click();
    await expect
      .poll(() =>
        videos
          .first()
          .evaluate((video) => video.paused && video.hasAttribute("src")),
      )
      .toBe(true);
    const pausedAt = await videos
      .first()
      .evaluate((video) => video.currentTime);
    assert.ok(pausedAt >= 2, "Local pause retains the playhead");
    await firstMedia
      .getByRole("button", { name: "Resume video", exact: true })
      .click();
    await expect
      .poll(() =>
        videos.first().evaluate((video) => !video.paused && video.currentTime),
      )
      .toBeGreaterThan(pausedAt);
    record("native-real-decode-lazy-load-and-pause-resume", { pausedAt });
    await page
      .getByRole("button", { name: "Play YouTube video", exact: true })
      .click();
    await expect(page.locator("iframe")).toHaveCount(1);
    await expect
      .poll(() =>
        videos
          .first()
          .evaluate((video) => video.paused && !video.hasAttribute("src")),
      )
      .toBe(true);
    await expect(
      page.locator('[data-drop-player][data-playing="true"]'),
    ).toHaveCount(1);
    const lastFrame = page.locator("[data-drop-player]").last();
    await lastFrame
      .getByRole("button", { name: "Play video", exact: true })
      .click();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect
      .poll(() =>
        videos
          .last()
          .evaluate((video) => !video.paused && video.currentTime > 0.3),
      )
      .toBe(true);
    await expect(
      page.locator('[data-drop-player][data-playing="true"]'),
    ).toHaveCount(1);
    record("native-iframe-switch-keeps-one-active-player");
    const offscreenAt = await videos
      .last()
      .evaluate((video) => video.currentTime);
    await page.evaluate(() =>
      document.body.scrollTo({ top: 2200, behavior: "auto" }),
    );
    await expect
      .poll(() =>
        videos
          .last()
          .evaluate((video) => video.paused && !video.hasAttribute("src")),
      )
      .toBe(true);
    await expect(page.locator("iframe")).toHaveCount(0);
    await top(page);
    await lastFrame.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        videos
          .last()
          .evaluate((video) => video.paused && !video.hasAttribute("src")),
      )
      .toBe(true);
    await lastFrame
      .getByRole("button", { name: "Resume video", exact: true })
      .click();
    await expect
      .poll(() =>
        videos.last().evaluate((video) => !video.paused && video.currentTime),
      )
      .toBeGreaterThanOrEqual(offscreenAt - 0.15);
    record("offscreen-unload-and-explicit-bookmarked-resume");
    await shot(page, "native-media-resumed");
  } catch (error) {
    const diagnostics = await page
      .evaluate(() => ({
        videos: [...document.querySelectorAll("video")].map((video) => ({
          time: video.currentTime,
          duration: video.duration,
          paused: video.paused,
          seeking: video.seeking,
          readyState: video.readyState,
          src: video.getAttribute("src"),
          currentSrc: video.currentSrc,
          error: video.error?.code ?? null,
          seekable: Array.from(
            { length: video.seekable.length },
            (_, index) => [
              video.seekable.start(index),
              video.seekable.end(index),
            ],
          ),
        })),
        trace: window.__dropMediaTrace ?? [],
      }))
      .catch(() => null);
    console.error("Native media diagnostics:", JSON.stringify(diagnostics));
    await writeFile(
      join(output, "native-media-diagnostics.json"),
      JSON.stringify(diagnostics, null, 2),
    );
    await shot(page, "native-media-failure").catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
try {
  await start();
  if (!interactionsOnly && !mediaOnly)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [844, 390],
      [1440, 900],
    ])
      for (const theme of ["light", "dark"]) await visual(width, height, theme);
  if (!visualOnly && !mediaOnly) await interactions();
  if (!visualOnly && !interactionsOnly) await nativeMedia();
  assert.deepEqual(report.runtimeErrors, [], "No unhandled browser errors");
  console.log("PASS Drop polish: " + report.checks.length + " checks");
} catch (error) {
  report.errors.push(error.stack || String(error));
  console.error(error);
  if (currentPage && !currentPage.isClosed())
    await shot(currentPage, "failure").catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("Report:", join(output, "report.json"));
  await cleanup();
}
