// Real HTML5 decode/playback with a generated local test clip. No live writes.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { installDropFixture } from "./drop-fixture.mjs";
const base = process.env.DROP_QA_URL || "http://127.0.0.1:8087";
const clip = process.env.DROP_QA_CLIP || "/tmp/drop-media-clip.webm";
if (!existsSync(clip))
  execFileSync(
    "ffmpeg",
    [
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=24",
      "-t",
      "6",
      "-c:v",
      "libvpx",
      "-an",
      "-y",
      clip,
    ],
    { stdio: "ignore" },
  );
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 800, height: 1400 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installDropFixture(page);
  await page.route("**/clip.webm*", (route) =>
    route.fulfill({ path: clip, contentType: "video/webm" }),
  );
  await page.goto(base + "/scripts/fixtures/drop-media-qa.html", {
    waitUntil: "networkidle",
  });
  const videos = page.locator("video");
  await expect(videos).toHaveCount(2);
  assert.equal(
    await videos.first().getAttribute("src"),
    null,
    "No video download before tap",
  );
  await page
    .getByRole("button", { name: "Play video", exact: true })
    .first()
    .click();
  await expect
    .poll(() => videos.first().evaluate((v) => !v.paused && v.currentTime > 0))
    .toBe(true);
  await page
    .getByRole("button", { name: "Play YouTube video", exact: true })
    .click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect
    .poll(() =>
      videos.first().evaluate((v) => v.paused && !v.hasAttribute("src")),
    )
    .toBe(true);
  await page
    .locator("[data-drop-player]")
    .last()
    .getByRole("button", { name: "Play video", exact: true })
    .click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect
    .poll(() => videos.last().evaluate((v) => !v.paused && v.currentTime > 0))
    .toBe(true);
  await page.evaluate(() => document.body.scrollTo(0, 2000));
  await expect
    .poll(() =>
      videos.last().evaluate((v) => v.paused && !v.hasAttribute("src")),
    )
    .toBe(true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS real native video decode, tap playback, one player, iframe switch and offscreen unload",
  );
} finally {
  await browser.close();
}
