// Real chat lifecycle and app navigation; isolated API failures only.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { installChatFixture } from "./chat-fixture.mjs";
const base = process.env.CHAT_QA_URL || "http://127.0.0.1:8080";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const failure of ["categories", "previews", "channels"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await installChatFixture(page);
    await page.addInitScript((failure) => {
      window.__chatFailTables =
        failure === "categories"
          ? ["channel_categories"]
          : failure === "channels"
            ? ["channels"]
            : [];
      window.__chatFailPreviews = failure === "previews";
      localStorage.setItem(
        "dh_nav_usage_v1:member:club",
        JSON.stringify({
          "/finds": 10000,
          "/compete": 9000,
          "/club": 8000,
          "/chat": 0,
        }),
      );
    }, failure);
    await page.goto(`${base}/scripts/fixtures/chat.html`);
    const nav = page.locator("[data-mobile-bottom-nav]");
    await expect(
      nav.getByRole("button", { name: "Chat", exact: true }),
    ).toBeVisible();
    if (failure === "channels") {
      await expect(
        page.getByText("Connection interrupted", { exact: true }),
      ).toBeVisible();
      await page.evaluate(() => {
        window.chatQa.failTables = [];
      });
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
    }
    await page.getByRole("button", { name: /^general/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-message-id]")).toHaveCount(50);
    const input = await page
        .getByRole("textbox", { name: "Message", exact: true })
        .boundingBox(),
      bar = await nav.boundingBox();
    assert.ok(
      input.y + input.height <= bar.y,
      "Composer clears pinned navigation",
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${failure} failure recovery, readable timeline and pinned Chat`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
