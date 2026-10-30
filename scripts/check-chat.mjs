// Real chat, composer, timeline, hooks and app shell; isolated fake transport.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installChatFixture } from "./chat-fixture.mjs";
const output = await mkdtemp(join(tmpdir(), "dh-chat-ui-"));
console.log("Screenshots:", output);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const base = process.env.CHAT_QA_URL || "http://127.0.0.1:8080";
const open = async (page, theme = "dark") => {
  page.on("pageerror", (error) => errors.push(error.message));
  await installChatFixture(page);
  await page.goto(`${base}/scripts/fixtures/chat.html?theme=${theme}`);
  await expect(
    page.getByRole("heading", { name: "Chat", exact: true }),
  ).toBeVisible();
  if (page.viewportSize().width < 1024) {
    assert.equal(
      await page.evaluate(
        () =>
          window.chatQa.writes.filter(
            (write) => write.table === "channel_read_states",
          ).length,
      ),
      0,
      "Opening the directory marks nothing read",
    );
    await page.getByRole("button", { name: /^general/ }).click();
  }
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-message-id]")).toHaveCount(50);
};
const fits = async (page, locator, label, min = 0) => {
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
      { message: label + " settles inside viewport" },
    )
    .toBe(true);
  const r = await locator.boundingBox(),
    v = page.viewportSize();
  assert.ok(
    r &&
      r.x >= -1 &&
      r.y >= -1 &&
      r.x + r.width <= v.width + 1 &&
      r.y + r.height <= v.height + 1,
    `${label} fits: ${JSON.stringify(r)}`,
  );
  if (min)
    assert.ok(
      r.width >= min - 1 && r.height >= min - 1,
      `${label} touch size: ${JSON.stringify(r)}`,
    );
};
const noPageScroll = async (page) =>
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
    "No page overflow",
  );
const latest = async (page) => {
  await page.locator(".chat-message-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect
    .poll(() =>
      page
        .locator(".chat-message-scroll")
        .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
    )
    .toBeLessThan(3);
};
try {
  for (const [width, height] of process.env.CHAT_QA_INTERACTIONS_ONLY
    ? []
    : [
        [320, 568],
        [360, 740],
        [390, 844],
        [430, 932],
        [700, 900],
        [768, 1024],
        [844, 390],
        [1280, 900],
        [1920, 1080],
      ])
    for (const theme of ["light", "dark"]) {
      console.log(`Checking ${width}×${height} ${theme}`);
      const page = await browser.newPage({
        viewport: { width, height },
        isMobile: width < 1000,
        hasTouch: width < 1000,
        reducedMotion: "reduce",
      });
      await open(page, theme);
      await latest(page);
      await noPageScroll(page);
      const nav = page.locator("[data-mobile-bottom-nav]");
      if (width < 1024) {
        await expect(nav).toBeVisible();
        await expect(
          nav.getByRole("button", { name: "Chat", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        await expect
          .poll(async () => {
            const input = await page
              .getByRole("textbox", { name: "Message", exact: true })
              .boundingBox();
            const bar = await nav.boundingBox();
            return input.y + input.height <= bar.y + 1;
          })
          .toBe(true);
      } else await expect(nav).toBeHidden();
      await fits(
        page,
        page.getByRole("textbox", { name: "Message", exact: true }),
        "Composer",
      );
      await fits(
        page,
        page.getByRole("button", { name: "Send message", exact: true }),
        "Send",
        44,
      );
      await fits(
        page,
        page.getByRole("button", { name: "Search messages", exact: true }),
        "Search",
        44,
      );
      assert.equal(
        await page
          .locator(".chat-message-copy")
          .last()
          .evaluate((el) => getComputedStyle(el).fontSize),
        "15px",
      );
      await page
        .getByRole("button", { name: "Search messages", exact: true })
        .click();
      await expect(page.getByRole("searchbox")).toBeVisible();
      await page.getByRole("searchbox").fill("grill");
      await expect
        .poll(() =>
          page
            .getByRole("button", { name: /I’ll bring something for the grill/ })
            .count(),
        )
        .toBeGreaterThan(0);
      await fits(
        page,
        page.getByRole("button", { name: "Close search" }),
        "Close search",
        44,
      );
      await page.getByRole("button", { name: "Close search" }).click();
      const input = page.getByRole("textbox", { name: "Message", exact: true });
      await input.fill("@Jo");
      await expect(
        page.getByRole("listbox", { name: "Mention a member" }),
      ).toBeVisible();
      await fits(
        page,
        page.getByRole("listbox", { name: "Mention a member" }),
        "Mention popup",
      );
      await input.press("Enter");
      await expect(input).toHaveValue("@Jordan ");
      await input.fill("/shr");
      await expect(
        page.getByRole("listbox", { name: "Message commands" }),
      ).toBeVisible();
      await fits(
        page,
        page.getByRole("listbox", { name: "Message commands" }),
        "Command popup",
      );
      await input.press("Escape");
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await input.fill("");
      await page
        .getByRole("button", { name: "Add attachment", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Add to message" }),
      ).toBeVisible();
      await fits(
        page,
        page.getByRole("dialog", { name: "Add to message" }),
        "Attachment menu",
      );
      if (width < 768) {
        await page.getByRole("button", { name: "Emoji", exact: true }).click();
        await expect(
          page.getByRole("dialog", { name: "Emoji", exact: true }),
        ).toBeVisible();
        await fits(
          page,
          page.getByRole("dialog", { name: "Emoji", exact: true }),
          "Emoji sheet",
        );
        await page.keyboard.press("Escape");
      } else await page.keyboard.press("Escape");
      await input.fill("A clean conversation.");
      await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
      await expect(input).toHaveValue("A clean conversation.");
      if (width < 768) {
        await input.press("Enter");
        await expect(input).toHaveValue("A clean conversation.\n");
      }
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      await expect(input).toHaveValue("");
      await expect(
        page
          .locator("[data-message-id] .chat-message-copy")
          .filter({ hasText: "A clean conversation." }),
      ).toHaveCount(1);
      await latest(page);
      await noPageScroll(page);
      await page.screenshot({
        path: join(output, `${width}-${height}-${theme}.png`),
      });
      await page.close();
    }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await open(page);
  const input = page.getByRole("textbox", { name: "Message", exact: true });
  await input.fill("Saved on this phone.");
  await page.getByRole("button", { name: "Back to channels" }).click();
  await page.getByRole("button", { name: /^sports/ }).click();
  await expect(input).toHaveValue("");
  await input.fill("A different room.");
  await page.getByRole("button", { name: "Back to channels" }).click();
  await page.getByRole("button", { name: /^general/ }).click();
  await expect(input).toHaveValue("Saved on this phone.");
  await page
    .locator("input[type=file]")
    .nth(2)
    .setInputFiles({
      name: "game-plan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nfixture"),
    });
  await expect(page.getByText("game-plan.pdf", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to channels" }).click();
  await page.getByRole("button", { name: /^sports/ }).click();
  await expect(page.getByRole("button", { name: "Remove file" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Back to channels" }).click();
  await page.getByRole("button", { name: /^general/ }).click();
  await expect(page.getByText("game-plan.pdf", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.chatQa.failSend = true;
  });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(input).toHaveValue("Saved on this phone.");
  await expect(page.getByText("game-plan.pdf", { exact: true })).toBeVisible();
  const uploaded = await page.evaluate(
    () => window.chatQa.writes.filter((w) => w.table === "storage").length,
  );
  await page.evaluate(() => {
    window.chatQa.failSend = false;
  });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Remove file" })).toHaveCount(
    0,
  );
  assert.equal(
    await page.evaluate(
      () => window.chatQa.writes.filter((w) => w.table === "storage").length,
    ),
    uploaded,
    "Retry reuses successful uploads",
  );
  await input.fill("");
  await latest(page);
  await page.locator(".chat-message-scroll").evaluate((el) => {
    el.scrollTop = 120;
  });
  await expect(
    page.getByRole("button", { name: "Jump to latest message" }),
  ).toBeVisible();
  const anchor = await page
    .locator(".chat-message-scroll")
    .evaluate((el) => ({ height: el.scrollHeight, top: el.scrollTop }));
  await page.locator(".chat-message-scroll").evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect
    .poll(() => page.locator("[data-message-id]").count())
    .toBeGreaterThan(51);
  await expect(
    page.getByRole("button", { name: "Jump to latest message" }),
  ).toBeVisible();
  assert.ok(
    await page
      .locator(".chat-message-scroll")
      .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight > 150),
    "History load does not jump to bottom",
  );
  await page.evaluate(() =>
    window.chatQa.emit("messages", "INSERT", {
      id: "new-arrival",
      channel_id: "general",
      user_id: "jordan",
      content: "New while you read.",
      created_at: new Date().toISOString(),
      parent_message_id: null,
      is_pinned: false,
      edited_at: null,
    }),
  );
  await expect(
    page.getByRole("button", { name: "Jump to 1 new message" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jump to 1 new message" }).click();
  await latest(page);
  await page.locator(".chat-message-scroll").evaluate((el) => {
    el.scrollTop = 220;
  });
  await expect(
    page.getByRole("button", { name: "Jump to latest message" }),
  ).toBeVisible();
  const reading = await page
    .locator(".chat-message-scroll")
    .evaluate((el) => el.scrollTop);
  await page
    .getByRole("button", { name: "Search messages", exact: true })
    .click();
  await page.getByRole("button", { name: "Close search" }).click();
  await expect
    .poll(() =>
      page.locator(".chat-message-scroll").evaluate((el) => el.scrollTop),
    )
    .toBeCloseTo(reading, 0);
  await page
    .getByRole("button", { name: "Search messages", exact: true })
    .click();
  await page.getByRole("searchbox").fill("grill");
  const oldResult = page
    .getByRole("button", { name: /I’ll bring something for the grill/ })
    .last();
  await expect(oldResult).toBeVisible();
  await oldResult.click();
  await expect(page.locator('[data-message-id="message-001"]')).toBeAttached();
  await page.getByRole("button", { name: "Jump to latest message" }).click();
  await expect(page.locator('[data-message-id="message-001"]')).toHaveCount(0);
  await expect(page.locator('[data-message-id="new-arrival"]')).toBeAttached();
  await page.evaluate(() =>
    window.chatQa.status("chat-general", "CHANNEL_ERROR"),
  );
  await expect(page.getByText("Reconnecting…", { exact: false })).toBeVisible();
  await page.evaluate(() => window.chatQa.status("chat-general", "SUBSCRIBED"));
  await expect(page.getByText("Reconnecting…", { exact: false })).toHaveCount(
    0,
  );
  await page.addInitScript(() => {
    let inset = 0;
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => innerHeight - inset },
      width: { get: () => innerWidth },
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    window.chatKeyboard = (value) => {
      inset = value;
      viewport.dispatchEvent(new Event("resize"));
    };
  });
  await page.reload();
  await page.getByRole("button", { name: /^general/ }).click();
  await expect(input).toBeVisible();
  await noPageScroll(page);
  await input.focus();
  await page.evaluate(() => window.chatKeyboard(320));
  await expect(page.locator(".dh-chat")).toHaveAttribute(
    "data-keyboard-open",
    "true",
  );
  await expect(page.locator("[data-mobile-bottom-nav]")).toBeHidden();
  assert.ok(
    (await input.boundingBox()).y + (await input.boundingBox()).height <= 524,
    "Composer stays above keyboard",
  );
  await input.fill("@Jo");
  await expect(
    page.getByRole("listbox", { name: "Mention a member" }),
  ).toBeVisible();
  const popup = await page
    .getByRole("listbox", { name: "Mention a member" })
    .boundingBox();
  assert.ok(
    popup.y >= 0 && popup.y + popup.height <= 524,
    "Suggestions stay above keyboard",
  );
  await page.evaluate(() => window.chatKeyboard(0));
  await expect(page.locator(".dh-chat")).toHaveAttribute(
    "data-keyboard-open",
    "false",
  );
  await expect(page.locator("[data-mobile-bottom-nav]")).toBeVisible();
  assert.deepEqual(errors, []);
  await page.close();
  console.log(
    "PASS nine sizes and both themes; full-screen layout, touch controls, real message hooks, mobile/IME input, portaled suggestions and menus, room drafts, failed attachments/retry, stable history and genuine-arrival counts",
  );
} finally {
  await browser.close();
}
