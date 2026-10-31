// Production spatial puzzle UI + isolated account/transport fixtures. No live writes.
// node scripts/check-rune-puzzles.mjs [--journey-only|--checks-only]
// Starts its own preview on8097; RUNE_QA_URL reuses an already-running preview.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { installRuneFixture } from "./rune-fixture.mjs";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output =
  process.env.RUNE_QA_OUTPUT ||
  (await mkdtemp(join(tmpdir(), "rune-puzzles-")));
await mkdir(output, { recursive: true });
const base = process.env.RUNE_QA_URL || "http://127.0.0.1:8097";
const journeyOnly = process.argv.includes("--journey-only");
const checksOnly = process.argv.includes("--checks-only");
const report = {
  checks: [],
  errors: [],
  runtimeErrors: [],
  artifacts: output,
  fixtures:
    "Browser-local identity and authoritative replay adapter. All moves, dialogs, navigation and rendering are production UI.",
};
let server, browser, currentPage, serverExit, serverLog;
let serverReady = Boolean(process.env.RUNE_QA_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keyFor = (direction) =>
  ({
    up: "ArrowUp",
    right: "ArrowRight",
    down: "ArrowDown",
    left: "ArrowLeft",
  })[direction];
const wasdFor = (direction) =>
  ({ up: "w", right: "d", down: "s", left: "a" })[direction];
const checkpointKey = (user, room) =>
  `rd-puzzle:v1:${encodeURIComponent(user)}:${encodeURIComponent(room.id)}:${room.version}`;
console.log("Puzzle artifacts:", output);
async function cleanupServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
    const exited = new Promise((resolve) => server.once("exit", resolve));
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
async function stop(code) {
  await browser?.close().catch(() => {});
  await cleanupServer();
  process.exit(code);
}
process.once("SIGINT", () => {
  void stop(130);
});
process.once("SIGTERM", () => {
  void stop(143);
});
async function start() {
  if (!process.env.RUNE_QA_URL) {
    serverLog = createWriteStream(join(output, "vite.log"));
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "8097",
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
      throw Error(`Preview exited ${serverExit}; inspect vite.log`);
    try {
      if (serverReady && (await fetch(`${base}/scripts/fixtures/rune.html`)).ok)
        break;
    } catch {
      /* Bounded startup. */
    }
    if (attempt === 99) throw Error("Preview did not start within20seconds");
    await sleep(200);
  }
  browser = await chromium.launch({
    executablePath: process.env.RUNE_QA_CHROMIUM || "/usr/bin/chromium",
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
  page.setDefaultTimeout(12_000);
  page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
  await installRuneFixture(page);
  await page.route("**/src/contexts/AuthContext.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `import React from '/node_modules/.vite/deps/react.js';
const get=()=>window.runeQa?.puzzleUserId??new URLSearchParams(location.search).get('puzzleUser')??'member';
const subscribe=fn=>{window.addEventListener('rune-qa-account',fn);return()=>window.removeEventListener('rune-qa-account',fn)};
export const useAuth=()=>{const id=React.useSyncExternalStore(subscribe,get,get);return {user:{id,user_metadata:{display_name:id==='member'?'Alex':'Other delver'}},signOut:async()=>{}}};`,
    }),
  );
  // Real workers still solve real boards. Delay only delivery when a race check asks for it.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends EventTarget {
      onmessage = null;
      onerror = null;
      onmessageerror = null;
      constructor(url, options) {
        super();
        this.worker = new NativeWorker(url, options);
        this.worker.addEventListener("message", (event) => {
          window.__runeQaWorkerQueued = (window.__runeQaWorkerQueued || 0) + 1;
          const deliver = () => {
            window.__runeQaWorkerDeliveries =
              (window.__runeQaWorkerDeliveries || 0) + 1;
            const next = new MessageEvent("message", { data: event.data });
            this.onmessage?.(next);
            this.dispatchEvent(next);
          };
          setTimeout(deliver, window.__runeQaHintDelay || 0);
        });
        this.worker.addEventListener("error", (event) => this.onerror?.(event));
        this.worker.addEventListener("messageerror", (event) =>
          this.onmessageerror?.(event),
        );
      }
      postMessage(message, options) {
        this.worker.postMessage(message, options);
      }
      terminate() {
        this.worker.terminate();
      }
    };
  });
  return { page, context };
}
async function go(page, route, extra = {}) {
  const query = new URLSearchParams({ route, theme: "dark", ...extra });
  await page.goto(`${base}/scripts/fixtures/rune.html?${query}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.runeQa && window.runeQueryClient);
  await expect(page.locator(".rd-mode main")).toBeVisible();
  await settle(page);
}
async function settle(page) {
  await page.waitForFunction(
    () =>
      window.runeQueryClient?.isFetching() === 0 &&
      window.runeQueryClient?.isMutating() === 0,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".rd-mode,.rd-dialog-theme")].every(
        (root) =>
          root
            .getAnimations({ subtree: true })
            .every(
              (animation) =>
                animation.playState !== "running" ||
                animation.effect?.getTiming().iterations === Infinity,
            ),
      ),
    undefined,
    { timeout: 4000 },
  );
}
async function routeIs(page, path) {
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    path,
  );
}
async function reloadChamber(page, room) {
  const route = `/rune-delve/chamber/${room.id}`;
  await routeIs(page, route);
  // The fixture's MemoryRouter does not update the browser URL on navigation.
  // Keep the real chamber route when remounting; state still comes from storage.
  await page.evaluate((path) => {
    const url = new URL(location.href);
    url.searchParams.set("route", path);
    history.replaceState(history.state, "", url);
  }, route);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.runeQa && window.runeQueryClient);
  await expect(page.locator(".rd-mode main")).toBeVisible();
  await settle(page);
}
async function shot(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`) });
}
async function fit(page, label, selector = ".rd-mode main") {
  await settle(page);
  const issues = await page.locator(selector).evaluate((root) => {
    const failures = [],
      tolerance = 2;
    if (
      document.documentElement.scrollWidth > innerWidth + tolerance ||
      document.documentElement.scrollHeight > innerHeight + tolerance
    )
      failures.push("document scrolls outside viewport");
    const visible = (node) =>
      node instanceof HTMLElement &&
      node.getClientRects().length &&
      !node.closest("[hidden],[aria-hidden=true]") &&
      getComputedStyle(node).display !== "none" &&
      getComputedStyle(node).visibility !== "hidden";
    const bounds = (node) => {
      const rect = node.getBoundingClientRect(),
        name = (
          node.getAttribute("aria-label") ||
          node.innerText ||
          node.tagName
        )
          .trim()
          .slice(0, 90);
      if (
        rect.left < -tolerance ||
        rect.top < -tolerance ||
        rect.right > innerWidth + tolerance ||
        rect.bottom > innerHeight + tolerance
      )
        failures.push(`${name}: outside viewport`);
      for (
        let ancestor = node.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor),
          limit = ancestor.getBoundingClientRect();
        if (
          /(hidden|clip|auto|scroll)/.test(style.overflowX) &&
          (rect.left < limit.left - tolerance ||
            rect.right > limit.right + tolerance)
        ) {
          failures.push(`${name}: horizontally clipped`);
          break;
        }
        if (
          /(hidden|clip|auto|scroll)/.test(style.overflowY) &&
          (rect.top < limit.top - tolerance ||
            rect.bottom > limit.bottom + tolerance)
        ) {
          failures.push(`${name}: vertically clipped`);
          break;
        }
      }
      return { rect, name };
    };
    for (const node of root.querySelectorAll(
      "button,a,input,select,[role=tab]",
    )) {
      if (!visible(node)) continue;
      const { rect, name } = bounds(node);
      if (rect.width < 43.5 || rect.height < 43.5)
        failures.push(
          `${name}: target ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`,
        );
    }
    for (const node of root.querySelectorAll(
      ".rp-lesson,.rp-feedback,.rp-heading,.rp-play-heading,.rp-goal,.rp-route-stats,.rp-command-deck,.rp-result-objectives",
    ))
      if (visible(node)) bounds(node);
    for (const node of [
      root,
      ...root.querySelectorAll(
        ".rd-screen,.rp-play-stage,.rp-board-area,.rp-play-deck,.rp-room-grid,.rd-dialog-body,.rp-result-dialog",
      ),
    ]) {
      if (!visible(node)) continue;
      const style = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight + tolerance
      )
        failures.push(`${node.className}: internal vertical scrolling`);
      if (
        /(auto|scroll)/.test(style.overflowX) &&
        node.scrollWidth > node.clientWidth + tolerance
      )
        failures.push(`${node.className}: internal horizontal scrolling`);
    }
    return [...new Set(failures)];
  });
  report.checks.push({ label, ok: !issues.length, issues });
  if (issues.length) {
    await shot(page, `${label}-failure`);
    assert.deepEqual(issues, [], label);
  }
}
async function roomData(page) {
  return page.evaluate(async () => {
    const { PUZZLE_ROOMS, PUZZLE_CHAPTERS } =
      await import("/src/lib/runedelve/puzzles/rooms.ts");
    return { rooms: PUZZLE_ROOMS, chapters: PUZZLE_CHAPTERS };
  });
}
async function modelPath(page, room, actions = room.solution) {
  return page.evaluate(
    async ({ room, actions }) => {
      const { initialPuzzleState, movePuzzle, puzzleStars } =
        await import("/src/lib/runedelve/puzzles/engine.ts");
      let state = initialPuzzleState(room);
      const states = [structuredClone(state)];
      for (const action of actions) {
        const next = movePuzzle(room, state, action);
        if (!next.moved)
          throw Error(`Invalid authored path ${room.id}/${action}`);
        state = next.state;
        states.push(structuredClone(state));
      }
      return { states, stars: puzzleStars(room, state) };
    },
    { room, actions },
  );
}
async function readBoard(page) {
  return page.locator('[data-testid="puzzle-play"]').evaluate((root) => {
    const player = Number(
      root
        .querySelector('[data-puzzle-player="true"]')
        ?.getAttribute("data-puzzle-cell"),
    );
    const list = (value) => (value || "").split(",").filter(Boolean);
    const area = Number(
      root
        .querySelector('[data-testid="puzzle-board"]')
        ?.getAttribute("data-area-index") ?? Math.floor(player / 36),
    );
    return {
      player,
      area,
      keys: list(root.getAttribute("data-puzzle-keys")).sort(),
      visited: list(root.getAttribute("data-puzzle-visited"))
        .map(Number)
        .sort((a, b) => a - b),
      stones: [...root.querySelectorAll("[data-puzzle-stone]")]
        .map(
          (node) =>
            `${node.getAttribute("data-puzzle-stone")}:${node.getAttribute("data-puzzle-cell")}`,
        )
        .sort(),
      pushes: Number(
        root.querySelector(".rp-route-stats > span:nth-child(1) > b")
          ?.textContent,
      ),
      moves: Number(
        root.querySelector(".rp-route-stats > span:nth-child(2) > b")
          ?.textContent,
      ),
      treasure: root.querySelector(".rp-route-stats > span:nth-child(3) > b")
        ?.textContent,
    };
  });
}
function expectedBoard(state, room) {
  const area = Math.floor(state.player / 36);
  return {
    player: state.player,
    area,
    keys: [...(state.keys ?? [])].sort(),
    visited: [...(state.visitedAreas ?? [])].sort((a, b) => a - b),
    stones: state.stones
      .filter((stone) => Math.floor(stone.cell / 36) === area)
      .map((stone) => `${stone.color}:${stone.cell}`)
      .sort(),
    pushes: state.pushes,
    moves: state.moves,
    treasure: `${state.collected.length}/${room.treasures.length}`,
  };
}
async function assertBoard(page, state, room, label) {
  try {
    await expect
      .poll(() => readBoard(page), { message: label })
      .toEqual(expectedBoard(state, room));
  } catch (error) {
    console.error(
      "Input trace",
      await page.evaluate(() => window.__puzzleInputTrace ?? []),
    );
    throw error;
  }
}
async function closeDialogAndSettle(page, dialog, name) {
  await dialog.getByRole("button", { name, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await settle(page);
}
async function enterJourney(page) {
  await page.locator('.rd-game-nav a[href="/rune-delve/journey"]').click();
  await expect(page.getByTestId("puzzle-journey")).toBeVisible();
}
async function enterChapter(page, chapter) {
  await page
    .getByRole("navigation", { name: "Puzzle chapters", exact: true })
    .getByRole("button", { name: new RegExp(chapter.title) })
    .click();
}
async function actMove(page, direction, state, mode = "arrow") {
  await page.evaluate(() => {
    if (window.__puzzleInputTrace) return;
    window.__puzzleInputTrace = [];
    for (const type of [
      "pointerdown",
      "pointerup",
      "pointercancel",
      "click",
      "touchstart",
      "touchend",
    ]) {
      document.addEventListener(
        type,
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          window.__puzzleInputTrace.push({
            type,
            cell: target
              ?.closest("[data-puzzle-cell]")
              ?.getAttribute("data-puzzle-cell"),
            tag: target?.tagName,
            button: event.button,
            primary: event.isPrimary,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            disabled: target?.closest("button")?.disabled,
            dialogs: document.querySelectorAll(
              '[role="dialog"], [role="alertdialog"]',
            ).length,
            hidden: document.hidden,
          });
          if (window.__puzzleInputTrace.length > 40)
            window.__puzzleInputTrace.shift();
        },
        { capture: true, passive: true },
      );
    }
  });
  if (mode === "tap") {
    const areaOffset = Math.floor(state.player / 36) * 36;
    const local = state.player % 36;
    const [r, c] = [Math.floor(local / 6), local % 6];
    const next =
      areaOffset +
      (direction === "up"
        ? (r - 1) * 6 + c
        : direction === "down"
          ? (r + 1) * 6 + c
          : direction === "left"
            ? r * 6 + c - 1
            : r * 6 + c + 1);
    await page.locator(`[data-puzzle-cell="${next}"]`).tap();
  } else if (mode === "dpad")
    await page
      .getByRole("button", { name: `Move ${direction}`, exact: true })
      .click();
  else if (mode === "swipe") {
    const board = page.getByTestId("puzzle-board");
    await expect(
      page.locator('[role="dialog"], [role="alertdialog"]'),
    ).toHaveCount(0);
    await expect(board.locator("button:disabled")).toHaveCount(0);
    // CDP touch has no actionability wait. A closing Radix overlay must finish
    // before this real gesture, just as locator.tap waits before a tile tap.
    await board.click({ trial: true });
    const box = await board.boundingBox();
    const start = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };
    const point = {
      x:
        start.x + (direction === "right" ? 45 : direction === "left" ? -45 : 0),
      y: start.y + (direction === "down" ? 45 : direction === "up" ? -45 : 0),
    };
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...start, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...point, id: 1 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await cdp.detach();
    }
  } else
    await page.keyboard.press(
      mode === "wasd" ? wasdFor(direction) : keyFor(direction),
    );
}
async function playRoom(page, room, { modes = true, snapshot = false } = {}) {
  await expect(page.getByTestId("puzzle-play")).toHaveAttribute(
    "data-room",
    room.id,
  );
  const model = await modelPath(page, room);
  assert.equal(
    model.stars,
    3,
    `${room.id}: authored path earns all three stars`,
  );
  await assertBoard(
    page,
    model.states[0],
    room,
    `${room.id}: canonical opening`,
  );
  if (snapshot) {
    await fit(page, `${room.id}-active`);
    await shot(page, `${room.id}-active`);
  }
  const coachTexts = new Set();
  if (room.order === 1) {
    await expect(page.getByTestId("puzzle-coach")).toBeVisible();
    await expect(page.locator(".rp-tile.is-coached")).toHaveCount(1);
    coachTexts.add(await page.getByTestId("puzzle-coach").innerText());
    await shot(page, "opening-guided-first-step");
  }
  if ([7, 13, 19, 25, 31].includes(room.order)) {
    await expect(page.getByTestId("puzzle-coach")).toBeVisible();
    report.checks.push({
      label: `${room.id}-new-mechanic-introduction`,
      ok: true,
      prompt: await page.getByTestId("puzzle-coach").innerText(),
    });
  }
  const seenAreas = new Set([Math.floor(model.states[0].player / 36)]);
  for (let index = 0; index < room.solution.length; index++) {
    const mode = !modes
      ? "arrow"
      : index === 0
        ? "tap"
        : index === 1
          ? "swipe"
          : index % 7 === 4
            ? "dpad"
            : index % 2
              ? "wasd"
              : "arrow";
    await actMove(page, room.solution[index], model.states[index], mode);
    await assertBoard(
      page,
      model.states[index + 1],
      room,
      `${room.id}: input${index + 1} ${mode}`,
    );
    if (room.order === 1 && model.states[index + 1].status !== "solved")
      coachTexts.add(await page.getByTestId("puzzle-coach").innerText());
    const area = Math.floor(model.states[index + 1].player / 36);
    if (!seenAreas.has(area)) {
      seenAreas.add(area);
      await expect(page.getByTestId("puzzle-board")).toHaveAttribute(
        "data-area-index",
        String(area),
      );
      await expect(page.locator("[data-puzzle-cell]")).toHaveCount(36);
      if (snapshot) {
        await fit(page, `${room.id}-area${area + 1}`);
        await shot(page, `${room.id}-area${area + 1}`);
      }
    }
  }
  if (room.order === 1) {
    assert.ok(
      coachTexts.size >= 3,
      "The opening walk-through reacts to walking, restoring a sigil and finding treasure",
    );
    report.checks.push({
      label: "guided-opening-uses-real-walk-push-treasure-exit",
      ok: true,
      prompts: coachTexts.size,
    });
  }
  const result = page.getByRole("dialog", {
    name: /^(Chamber restored|Tutorial complete)$/,
  });
  await expect(result).toBeVisible();
  await expect(
    result.getByRole("img", {
      name: "Saved best mastery: 3 of 3 stars",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    result.getByRole("link", {
      name: /^(Enter the next (?:chamber|adventure)|Return to the journey|Continue your journey)/,
    }),
  ).toBeVisible();
  await fit(page, `${room.id}-result`, ".rp-result-dialog");
  if (snapshot) await shot(page, `${room.id}-result`);
  const row = await page.evaluate(
    (id) =>
      window.runeQa.tables.rune_puzzle_results.find(
        (result) =>
          result.user_id === window.runeQa.puzzleUserId &&
          result.room_id === id,
      ),
    room.id,
  );
  assert.ok(row, `${room.id}: authoritative fixture result exists`);
  assert.equal(row.stars, 3);
  assert.equal(row.best_pushes, model.states.at(-1).pushes);
  report.checks.push({
    label: `actual-complete-${room.id}`,
    ok: true,
    moves: model.states.at(-1).moves,
    pushes: row.best_pushes,
    areas: seenAreas.size,
    keys: model.states.at(-1).keys ?? [],
  });
  console.log(
    `PASS ${room.id}: ${row.best_pushes} pushes / ${model.states.at(-1).moves} steps`,
  );
  return result;
}
async function legacySnapshot(page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.entries(window.runeQa.tables)
        .filter(([key]) => key.startsWith("rune_delve_"))
        .map(([key, rows]) => [key, JSON.stringify(rows)]),
    ),
  );
}
async function fullJourney() {
  const { page, context } = await setup();
  try {
    await go(page, "/rune-delve");
    const { rooms, chapters } = await roomData(page),
      before = await legacySnapshot(page);
    assert.ok(
      rooms.length >= 36,
      "Expanded journey contains at least36 authored adventures",
    );
    assert.equal(
      chapters.length,
      6,
      "Six chapters introduce the expanding toolkit",
    );
    const first = await page.evaluate(
      () => window.runeQa.tables.rune_puzzle_results.length,
    );
    assert.equal(
      first,
      0,
      "Fresh puzzle track starts atroom1 without legacy progress",
    );
    const start = page
      .getByTestId("puzzle-home")
      .locator("a.rp-primary")
      .first();
    await expect(start).toBeVisible();
    await start.click();
    for (const room of rooms) {
      await routeIs(page, `/rune-delve/chamber/${room.id}`);
      const result = await playRoom(page, room, {
        snapshot: [1, 7, 13, 18, 19, 25, 31, rooms.length].includes(room.order),
      });
      await result
        .getByRole("link", {
          name: /^(Enter the next (?:chamber|adventure)|Return to the journey|Continue your journey)/,
        })
        .click();
    }
    await routeIs(page, "/rune-delve/journey");
    const records = await page.evaluate(() =>
      window.runeQa.tables.rune_puzzle_results.filter(
        (row) => row.user_id === "member",
      ),
    );
    assert.equal(records.length, rooms.length);
    assert.equal(
      records.reduce((sum, row) => sum + row.stars, 0),
      rooms.length * 3,
    );
    assert.deepEqual(
      await legacySnapshot(page),
      before,
      "New puzzle journey does not mutate legacy RPG values",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.getByTestId("puzzle-home")).toBeVisible();
    await expect(page.locator(".rp-home-progress")).toContainText(
      String(rooms.length),
    );
    await expect(page.locator(".rp-home-progress")).toContainText(
      String(rooms.length * 3),
    );
    assert.equal(
      await page.evaluate(
        () => window.runeQa.tables.rune_puzzle_results.length,
      ),
      rooms.length,
      "Records persist acrossreload",
    );
    await shot(page, "journey-complete");
    report.checks.push({
      label: `all${rooms.length}-journal-reload-legacy-preservation`,
      ok: true,
      rooms: rooms.length,
      stars: rooms.length * 3,
    });
  } catch (error) {
    await shot(page, `failure-${report.checks.length}`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
async function menuAndMobile(width, height, motion) {
  const { page, context } = await setup(width, height, motion);
  const label = `${width}x${height}-${motion}`;
  try {
    await go(page, "/rune-delve", { puzzleCompleted: "9999" });
    await fit(page, `${label}-home`);
    await fit(page, `${label}-hud`, ".rd-puzzle-hud");
    await shot(page, `${label}-home`);
    await page
      .getByRole("button", { name: "Choose delver appearance", exact: true })
      .click();
    const avatar = page.getByRole("dialog", {
      name: "Choose your delver",
      exact: true,
    });
    await fit(page, `${label}-appearance`, ".rp-avatar-dialog");
    await avatar.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(avatar).toBeHidden();
    assert.equal(
      await page.evaluate(
        () =>
          window.runeQa.tables.rune_puzzle_profiles.find(
            (row) => row.user_id === "member",
          ).avatar,
      ),
      "rogue",
    );
    await enterJourney(page);
    const { rooms, chapters } = await roomData(page);
    for (const chapter of chapters) {
      await enterChapter(page, chapter);
      await fit(page, `${label}-chapter${chapter.id}`);
      if (chapter.id === chapters.length)
        await shot(page, `${label}-chapter${chapter.id}`);
    }
    await page.getByRole("link", { name: "Guide", exact: true }).click();
    await fit(page, `${label}-guide`);
    const pager = page.getByRole("navigation", {
      name: "Puzzle guide pages",
      exact: true,
    });
    const pages = Number(await pager.getAttribute("data-page-count"));
    for (let index = 1; index < pages; index++) {
      await pager.getByRole("button", { name: /^Next / }).click();
      await fit(page, `${label}-guide${index + 1}`);
    }
    await page.locator('.rd-game-nav a[href="/rune-delve/legacy"]').click();
    await routeIs(page, "/rune-delve/legacy");
    await expect(
      page.locator('header[data-rune-edition="archive"]'),
    ).toContainText("Combat Archive");
    await expect(page.locator(".rd-mode main")).toContainText(
      /Original combat/,
    );
    await expect(page.locator(".rd-mode main")).toContainText("Expedition");
    await fit(page, `${label}-clearly-labeled-archive`);
    await shot(page, `${label}-archive`);
    await page
      .getByRole("button", { name: "Return to puzzle journey", exact: true })
      .click();
    await routeIs(page, "/rune-delve");
    await enterJourney(page);
    const representative =
      rooms.find((room) => room.mechanic === "ice" && room.guardian) ??
      rooms.find((room) => room.mechanic === "ice");
    await enterChapter(
      page,
      chapters.find((chapter) => chapter.id === representative.chapter),
    );
    await page
      .getByRole("link", {
        name: `Enter chamber ${representative.order}: ${representative.title}`,
        exact: true,
      })
      .click();
    await fit(page, `${label}-board`);
    await expect(page.locator("[data-puzzle-cell]")).toHaveCount(36);
    await shot(page, `${label}-board`);
    const before = await readBoard(page);
    await page
      .getByRole("button", { name: "Open puzzle guide", exact: true })
      .click();
    const guide = page.getByRole("dialog", {
      name: "The chamber guide",
      exact: true,
    });
    await fit(page, `${label}-in-game-guide`, ".rd-puzzle-guide-dialog");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("a");
    assert.deepEqual(
      await readBoard(page),
      before,
      "Keyboard input whileguideopennever moves delver",
    );
    await guide
      .getByRole("button", { name: "Return to the chamber", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Puzzle rules", exact: true })
      .click();
    const rules = page.getByRole("dialog", {
      name: "Read the room",
      exact: true,
    });
    await fit(page, `${label}-room-rules`, ".rp-rules-dialog");
    await rules
      .getByRole("button", { name: "Back to the chamber", exact: true })
      .click();
    const model = await modelPath(page, representative),
      prefix = Math.min(3, representative.solution.length - 1);
    for (let i = 0; i < prefix; i++) {
      await actMove(
        page,
        representative.solution[i],
        model.states[i],
        i ? "tap" : "swipe",
      );
      await assertBoard(
        page,
        model.states[i + 1],
        representative,
        `${label}: real touch input`,
      );
    }
    await page
      .getByRole("button", { name: "Undo last step", exact: true })
      .click();
    await assertBoard(
      page,
      model.states[prefix - 1],
      representative,
      `${label}: undo exactstate`,
    );
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    await assertBoard(
      page,
      model.states[0],
      representative,
      `${label}: restart canonical`,
    );
    // Leave the authored route using real input so this exercises the worker,
    // rather than the instant, preverified hint available on that route.
    const detour = await page.evaluate(async (room) => {
      const { initialPuzzleState, movePuzzle } =
        await import("/src/lib/runedelve/puzzles/engine.ts");
      const key = (state) =>
        JSON.stringify([
          state.player,
          state.stones.map((stone) => [stone.id, stone.color, stone.cell]),
          [...state.collected].sort((a, b) => a - b),
          [...(state.keys ?? [])].sort(),
        ]);
      const initial = initialPuzzleState(room);
      const canonical = new Set([key(initial)]);
      let state = initial;
      for (const direction of room.solution) {
        state = movePuzzle(room, state, direction).state;
        canonical.add(key(state));
      }
      for (const direction of ["up", "right", "down", "left"]) {
        const move = movePuzzle(room, initial, direction);
        if (
          move.moved &&
          !move.pushed &&
          move.state.status === "playing" &&
          !canonical.has(key(move.state))
        )
          return { direction, state: move.state };
      }
      throw Error(
        "Representative room needs a safe off-route step for the hint-worker check",
      );
    }, representative);
    await actMove(page, detour.direction, model.states[0], "tap");
    await assertBoard(
      page,
      detour.state,
      representative,
      `${label}: off-route hint position`,
    );
    const priorHintEvents = await page.evaluate(() => {
      window.__runeQaHintDelay = 800;
      return {
        queued: window.__runeQaWorkerQueued || 0,
        delivered: window.__runeQaWorkerDeliveries || 0,
      };
    });
    await page
      .getByRole("button", { name: "Show a hint", exact: true })
      .click();
    await page.waitForFunction(
      (prior) => (window.__runeQaWorkerQueued || 0) > prior,
      priorHintEvents.queued,
      { timeout: 20_000 },
    );
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    await page.waitForFunction(
      (prior) => (window.__runeQaWorkerDeliveries || 0) > prior,
      priorHintEvents.delivered,
      { timeout: 20_000 },
    );
    await expect(page.locator(".rp-tile.is-hinted")).toHaveCount(0);
    await assertBoard(
      page,
      model.states[0],
      representative,
      `${label}: stalehint ignored`,
    );
    await page.evaluate(() => {
      window.__runeQaHintDelay = 0;
    });
    await page
      .getByRole("button", { name: "Show a hint", exact: true })
      .click();
    await expect(page.locator(".rp-feedback")).toContainText(/Try moving /, {
      timeout: 20_000,
    });
    await expect(page.locator(".rp-tile.is-hinted")).toHaveCount(1);
    assert.deepEqual(
      await readBoard(page),
      before,
      "A hint is a suggestion, never an automatic move",
    );
    await fit(page, `${label}-hint`);
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    const result = await playRoom(page, representative, { modes: false });
    await shot(page, `${label}-result`);
    assert.equal(
      await result
        .getByRole("img", {
          name: "Saved best mastery: 3 of 3 stars",
          exact: true,
        })
        .count(),
      1,
    );
    if (motion === "reduce")
      await expect(page.locator(".rd-mode")).toHaveAttribute(
        "data-rd-motion",
        "reduced",
      );
    report.checks.push({
      label: `${label}-touch-undo-restart-hint-dialog-guard`,
      ok: true,
    });
    console.log(`PASS mobile ${label}`);
  } catch (error) {
    await shot(page, `failure-${report.checks.length}`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
async function inspectAdventureMap(page, room, state, label) {
  const before = await readBoard(page);
  await page
    .getByRole("button", { name: "Open chamber map", exact: true })
    .click();
  const map = page.getByRole("dialog", { name: "Chamber map", exact: true });
  await fit(page, `${label}-map`, '[role="dialog"]');
  const nodes = map.locator("[data-map-area]");
  await expect(nodes).toHaveCount(room.areas.length);
  for (let index = 0; index < room.areas.length; index++) {
    const node = map.locator(`[data-map-area="${index}"]`);
    const discovered = (
      state.visitedAreas ?? [Math.floor(state.player / 36)]
    ).includes(index);
    await expect(node).toHaveAttribute("data-discovered", String(discovered));
    await expect(node.locator('button,a,[role="button"]')).toHaveCount(0);
    if (discovered) await expect(node).toContainText(room.areas[index].title);
    else await expect(node).not.toContainText(room.areas[index].title);
  }
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("a");
  assert.deepEqual(
    await readBoard(page),
    before,
    "Surveying rooms never moves or teleports the delver",
  );
  await shot(page, `${label}-map`);
  await closeDialogAndSettle(page, map, "Return to exploration");
  await assertBoard(page, state, room, `${label}: map is read-only`);
}
async function adventureExploration(width, height, motion) {
  const { page, context } = await setup(width, height, motion);
  const label = `${width}x${height}-${motion}-adventure`;
  try {
    await go(page, "/rune-delve/journey", { puzzleCompleted: "9999" });
    const { rooms, chapters } = await roomData(page);
    const room = rooms.find(
      (candidate) =>
        candidate.areas?.length > 1 &&
        candidate.keys?.length &&
        candidate.doors?.length,
    );
    assert.ok(room, "The expansion has a connected key-and-lock adventure");
    const model = await modelPath(page, room);
    const transition = model.states.findIndex(
      (state, index) =>
        index > 0 &&
        Math.floor(state.player / 36) !==
          Math.floor(model.states[index - 1].player / 36),
    );
    const keyPickup = model.states.findIndex(
      (state, index) =>
        index > 0 &&
        (state.keys?.length ?? 0) > (model.states[index - 1].keys?.length ?? 0),
    );
    const prefix = Math.max(transition, keyPickup);
    assert.ok(
      transition > 0 && keyPickup > 0 && prefix < room.solution.length,
      "The authored route explores and finds a key before the final escape",
    );
    await enterChapter(
      page,
      chapters.find((chapter) => chapter.id === room.chapter),
    );
    await page
      .getByRole("link", {
        name: `Enter chamber ${room.order}: ${room.title}`,
        exact: true,
      })
      .click();
    await assertBoard(page, model.states[0], room, `${label}: initial room`);
    await fit(page, `${label}-first-room`);
    await inspectAdventureMap(
      page,
      room,
      model.states[0],
      `${label}-undiscovered`,
    );
    for (let index = 0; index < prefix; index++) {
      await actMove(
        page,
        room.solution[index],
        model.states[index],
        index % 3 === 0 ? "swipe" : "tap",
      );
      await assertBoard(
        page,
        model.states[index + 1],
        room,
        `${label}: exploratory input${index + 1}`,
      );
      if (index + 1 === transition || index + 1 === keyPickup) {
        await page
          .getByRole("button", { name: "Undo last step", exact: true })
          .click();
        await assertBoard(
          page,
          model.states[index],
          room,
          `${label}: undo restores area, keys and discovery`,
        );
        await actMove(page, room.solution[index], model.states[index], "tap");
        await assertBoard(
          page,
          model.states[index + 1],
          room,
          `${label}: repeated step restores the same state`,
        );
      }
    }
    await fit(page, `${label}-key-and-room`);
    await shot(page, `${label}-key-and-room`);
    await inspectAdventureMap(
      page,
      room,
      model.states[prefix],
      `${label}-discovered`,
    );
    const checkpoint = checkpointKey("member", room);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).actions.length,
          checkpoint,
        ),
      )
      .toBe(prefix);
    await reloadChamber(page, room);
    await assertBoard(
      page,
      model.states[prefix],
      room,
      `${label}: exploration reload restores keys and visited rooms`,
    );
    await page.evaluate(() => {
      window.runeQa.puzzleUserId = "other";
      window.dispatchEvent(new Event("rune-qa-account"));
    });
    await settle(page);
    await expect(page.getByTestId("puzzle-play")).toHaveCount(0);
    await expect(page.locator(".rd-mode main")).toContainText(
      "The way is sealed.",
    );
    assert.equal(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        checkpointKey("other", room),
      ),
      null,
      "Another account does not acquire the explored route or keys",
    );
    await page.evaluate(() => {
      window.runeQa.puzzleUserId = "member";
      window.dispatchEvent(new Event("rune-qa-account"));
    });
    await settle(page);
    await assertBoard(
      page,
      model.states[prefix],
      room,
      `${label}: account return restores only its own explored route`,
    );
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    await assertBoard(
      page,
      model.states[0],
      room,
      `${label}: restart clears inventory and returns to the entrance`,
    );
    report.checks.push({
      label: `${label}-passage-key-map-undo-reload-account-isolation`,
      ok: true,
      room: room.id,
      steps: prefix,
      areas: model.states[prefix].visitedAreas,
      keys: model.states[prefix].keys,
    });
    console.log(`PASS exploration ${label}`);
  } catch (error) {
    await shot(page, `failure-${report.checks.length}`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
async function releasedFrontierCarriesForward() {
  const { page, context } = await setup();
  try {
    await go(page, "/rune-delve/journey", { puzzleCompleted: "18" });
    const { rooms, chapters } = await roomData(page);
    const next = rooms.find((room) => room.order === 19);
    assert.ok(
      next,
      "A veteran's next adventure is appended after the released18",
    );
    const chapter = chapters.find((chapter) => chapter.id === next.chapter);
    await expect(
      page
        .getByRole("navigation", { name: "Puzzle chapters", exact: true })
        .getByRole("button", { name: new RegExp(chapter.title) }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("link", {
        name: `Enter chamber ${next.order}: ${next.title}`,
        exact: true,
      }),
    ).toBeVisible();
    const saved = await page.evaluate(() =>
      window.runeQa.tables.rune_puzzle_results.filter(
        (row) => row.user_id === "member",
      ),
    );
    assert.equal(saved.length, 18);
    assert.equal(
      saved.reduce((sum, row) => sum + row.stars, 0),
      54,
    );
    report.checks.push({
      label: "released18-records-unlock-new-frontier-without-reset",
      ok: true,
    });
    console.log("PASS released frontier continuity");
  } finally {
    await context.close();
  }
}
async function checkpointAndAccounts() {
  const { page, context } = await setup();
  try {
    await go(page, "/rune-delve/chamber/ember-01");
    const { rooms } = await roomData(page),
      room = rooms[0],
      model = await modelPath(page, room);
    const length = Math.min(2, room.solution.length - 1);
    assert.ok(length > 0, "Firstroom permits a partial checkpoint");
    for (let i = 0; i < length; i++) {
      await actMove(page, room.solution[i], model.states[i], "arrow");
      await assertBoard(
        page,
        model.states[i + 1],
        room,
        "Checkpoint partial input",
      );
    }
    const key = checkpointKey("member", room);
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).actions.length,
          key,
        ),
      )
      .toBe(length);
    await reloadChamber(page, room);
    await assertBoard(
      page,
      model.states[length],
      room,
      "Canonical route restores acrossreload",
    );
    await page.evaluate(() => {
      window.runeQa.puzzleUserId = "other";
      window.dispatchEvent(new Event("rune-qa-account"));
    });
    await settle(page);
    await assertBoard(
      page,
      model.states[0],
      room,
      "Otheraccount cannotinheritmembercheckpoint",
    );
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).actions.length,
        key,
      ),
      length,
    );
    await page.evaluate(() => {
      window.runeQa.puzzleUserId = "member";
      window.dispatchEvent(new Event("rune-qa-account"));
    });
    await settle(page);
    await assertBoard(
      page,
      model.states[length],
      room,
      "A→B→A restores onlytheoriginal account route",
    );
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    await assertBoard(page, model.states[0], room, "Reset afteraccountswitch");
    report.checks.push({
      label: "checkpoint-reload-and-account-isolation",
      ok: true,
    });
    console.log("PASS checkpoint and account isolation");
  } catch (error) {
    await shot(page, `failure-${report.checks.length}`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
async function lostReceipt() {
  const { page, context } = await setup();
  try {
    await go(page, "/rune-delve");
    const { rooms } = await roomData(page);
    const room =
      rooms.find(
        (candidate) => candidate.areas?.length > 1 && candidate.keys?.length,
      ) ?? rooms.find((candidate) => candidate.areas?.length > 1);
    assert.ok(room, "Lost-ack recovery exercises a connected adventure");
    await go(page, `/rune-delve/chamber/${room.id}`, {
      puzzleCompleted: String(room.order - 1),
    });
    const model = await modelPath(page, room);
    const baseline = await page.evaluate(() => ({
      results: window.runeQa.tables.rune_puzzle_results.length,
      receipts: window.runeQa.tables.rune_puzzle_receipts.length,
    }));
    await page.evaluate(() => {
      window.runeQa.losePuzzleReceiptOnce = true;
    });
    for (let i = 0; i < room.solution.length; i++) {
      await actMove(page, room.solution[i], model.states[i], "arrow");
      await assertBoard(page, model.states[i + 1], room, "Lostack route");
    }
    const result = page.getByRole("dialog", {
      name: "Chamber restored",
      exact: true,
    });
    await expect(
      result.getByRole("button", { name: "Retry save", exact: true }),
    ).toBeEnabled();
    const before = await page.evaluate(() => {
      const call = window.runeQa.rpcs
        .filter((item) => item.name === "rune_puzzle_complete")
        .at(-1);
      return {
        args: call.args,
        results: window.runeQa.tables.rune_puzzle_results.length,
        receipts: window.runeQa.tables.rune_puzzle_receipts.length,
      };
    });
    assert.equal(before.results, baseline.results + 1);
    assert.equal(before.receipts, baseline.receipts + 1);
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      checkpointKey("member", room),
    );
    assert.equal(
      saved.requestId,
      before.args.p_request_id,
      "Pending solvedcheckpoint keeps itsoriginalUUID",
    );
    await fit(page, "pending-save", ".rp-result-dialog");
    await shot(page, "pending-save");
    await reloadChamber(page, room);
    await expect(
      page
        .getByRole("dialog", { name: "Chamber restored", exact: true })
        .getByRole("img", {
          name: "Saved best mastery: 3 of 3 stars",
          exact: true,
        }),
    ).toBeVisible();
    const after = await page.evaluate(() => ({
      args: window.runeQa.rpcs
        .filter((item) => item.name === "rune_puzzle_complete")
        .at(-1)?.args,
      results: window.runeQa.tables.rune_puzzle_results.length,
      receipts: window.runeQa.tables.rune_puzzle_receipts.length,
    }));
    assert.deepEqual(
      after.args,
      before.args,
      "Reloadretry uses theexactsame frozencompletionrequest",
    );
    assert.equal(after.results, baseline.results + 1);
    assert.equal(after.receipts, baseline.receipts + 1);
    assert.equal(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        checkpointKey("member", room),
      ),
      null,
      "Acknowledgedresult clears onlyits checkpoint",
    );
    report.checks.push({
      label: "connected-adventure-commit-lost-ack-reload-exact-receipt-retry",
      ok: true,
      room: room.id,
      areas: room.areas.length,
      keys: model.states.at(-1).keys ?? [],
    });
    console.log("PASS immutable receipt recovery");
  } catch (error) {
    await shot(page, `failure-${report.checks.length}`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function expectTutorialPhase(page, phase, label) {
  await expect(page.getByTestId("puzzle-play")).toHaveAttribute(
    "data-tutorial-phase",
    phase,
  );
  if (phase === "none") {
    await expect(page.getByTestId("puzzle-tutorial-phase")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("puzzle-tutorial-phase")).toHaveText(
      `${label} ${{ learn: 1, practice: 2, trial: 3 }[phase]}/3`,
    );
  }
}
async function nextTutorialChamber(result) {
  await result
    .getByRole("link", {
      name: /^(Enter the next (?:chamber|adventure)|Return to the journey|Continue your journey)/,
    })
    .click();
}
async function assertStaticTutorialMarker(page, label) {
  await settle(page);
  const marker = page.locator(".rp-tile.is-coached");
  await expect(marker).toHaveCount(1);
  const style = await marker.evaluate((tile) => {
    const css = getComputedStyle(tile);
    const context = document.createElement("canvas").getContext("2d");
    const pixel = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return {
      isNeighbor: tile.classList.contains("is-neighbor"),
      border: pixel(css.borderTopColor),
      gold: pixel(`hsl(${css.getPropertyValue("--gold")})`),
      shadow: css.boxShadow,
      finiteRunning: tile
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getTiming().iterations !== Infinity,
        ).length,
    };
  });
  assert.equal(
    style.isNeighbor,
    true,
    `${label}: checks a highlighted neighboring tile`,
  );
  assert.deepEqual(
    style.border,
    style.gold,
    `${label}: the static gold marker wins over neighboring-tile styling`,
  );
  assert.match(
    style.shadow,
    /inset/,
    `${label}: static emphasis remains when the pulse ends`,
  );
  assert.equal(
    style.finiteRunning,
    0,
    `${label}: the marker stays clear without a running pulse`,
  );
  report.checks.push({ label, ok: true });
}
async function tutorialProgression() {
  const { page, context } = await setup();
  try {
    await go(page, "/rune-delve");
    const { rooms } = await roomData(page);
    const first = rooms[0],
      practice = rooms[1],
      trial = rooms[2];
    await page
      .getByTestId("puzzle-home")
      .locator("a.rp-primary")
      .first()
      .click();
    await expectTutorialPhase(page, "learn", "Learn");
    const model = await modelPath(page, first);
    const coach = page.getByTestId("puzzle-coach");
    await expect(coach).toHaveAttribute("data-coach-step", "first-step");
    await assertStaticTutorialMarker(
      page,
      "learn-static-gold-marker-after-pulse",
    );
    await actMove(page, first.solution[0], model.states[0], "tap");
    await assertBoard(page, model.states[1], first, "Learn: real first walk");
    await expect(coach).toHaveAttribute("data-coach-step", "first-push");
    await page
      .getByRole("button", { name: "Undo last step", exact: true })
      .click();
    await assertBoard(
      page,
      model.states[0],
      first,
      "Learn: undo restores the lesson",
    );
    await expect(coach).toHaveAttribute("data-coach-step", "first-step");
    for (let index = 0; index < 2; index++) {
      await actMove(
        page,
        first.solution[index],
        model.states[index],
        index ? "tap" : "swipe",
      );
      await assertBoard(
        page,
        model.states[index + 1],
        first,
        "Learn: walk and push",
      );
    }
    await reloadChamber(page, first);
    await assertBoard(
      page,
      model.states[2],
      first,
      "Learn: restored route teaches the current objective",
    );
    await expect(coach).toHaveAttribute("data-coach-step", "first-cache");
    await page
      .getByRole("button", { name: "Try on my own", exact: true })
      .click();
    await expect(page.getByTestId("puzzle-play")).toHaveAttribute(
      "data-guidance",
      "off",
    );
    await expect(coach).toHaveCount(0);
    await expect(page.locator(".rp-tile.is-coached")).toHaveCount(0);
    const soloBoard = await readBoard(page);
    await page
      .getByRole("button", { name: "Puzzle rules", exact: true })
      .click();
    const help = page.getByRole("dialog", {
      name: "Read the room",
      exact: true,
    });
    await help
      .getByRole("button", { name: "Turn guidance on", exact: true })
      .click();
    await closeDialogAndSettle(page, help, "Back to the chamber");
    assert.deepEqual(
      await readBoard(page),
      soloBoard,
      "Guidance controls never move the delver",
    );
    await expect(coach).toHaveAttribute("data-coach-step", "first-cache");
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    await nextTutorialChamber(await playRoom(page, first, { modes: false }));

    await expectTutorialPhase(page, "practice", "Practice");
    await expect(coach).toBeVisible();
    await expect(page.locator(".rp-tile.is-coached")).toHaveCount(0);
    const practiceModel = await modelPath(page, practice);
    await actMove(page, practice.solution[0], practiceModel.states[0], "tap");
    await assertBoard(
      page,
      practiceModel.states[1],
      practice,
      "Practice: real input remains unguided",
    );
    await expect(page.locator(".rp-tile.is-coached")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    await nextTutorialChamber(await playRoom(page, practice, { modes: false }));

    await expectTutorialPhase(page, "trial", "Trial");
    await expect(coach).toBeVisible();
    await expect(page.locator(".rp-tile.is-coached")).toHaveCount(0);
    const trialActions = ["up", "right"];
    const trialModel = await modelPath(page, trial, trialActions);
    const demonstrated = trialActions.length;
    assert.equal(trialModel.states[1].pushes, 0);
    assert.equal(trialModel.states[1].collected.length, 0);
    assert.equal(trialModel.states[demonstrated].pushes, 1);
    for (let index = 0; index < demonstrated; index++) {
      await actMove(
        page,
        trialActions[index],
        trialModel.states[index],
        "arrow",
      );
      await assertBoard(
        page,
        trialModel.states[index + 1],
        trial,
        "Trial: demonstrate a real push",
      );
      if (index === 0) await expect(coach).toBeVisible();
    }
    await expect(coach).toHaveCount(0);
    await page
      .getByRole("button", { name: "Undo last step", exact: true })
      .click();
    await assertBoard(
      page,
      trialModel.states[demonstrated - 1],
      trial,
      "Trial: undo restores the introduction",
    );
    await expect(coach).toBeVisible();
    await actMove(
      page,
      trialActions[demonstrated - 1],
      trialModel.states[demonstrated - 1],
      "tap",
    );
    await expect(coach).toHaveCount(0);
    await reloadChamber(page, trial);
    await assertBoard(
      page,
      trialModel.states[demonstrated],
      trial,
      "Trial: reload preserves earned independence",
    );
    await expect(coach).toHaveCount(0);
    await page
      .getByRole("button", { name: "Restart chamber", exact: true })
      .click();
    const graduation = await playRoom(page, trial, { modes: false });
    await expect(graduation).toHaveAccessibleName("Tutorial complete");
    await shot(page, "tutorial-graduation");
    await nextTutorialChamber(graduation);
    await routeIs(page, `/rune-delve/chamber/${rooms[3].id}`);
    await expectTutorialPhase(page, "none");
    await expect(coach).toHaveCount(0);
    await expect(page.locator(".rp-tile.is-coached")).toHaveCount(0);
    const records = await page.evaluate(() =>
      structuredClone(window.runeQa.tables.rune_puzzle_results),
    );
    await page
      .getByRole("button", { name: "Back to journey", exact: true })
      .click();
    await expect(page.getByTestId("puzzle-journey")).toBeVisible();
    await page.locator('.rd-game-nav a[href="/rune-delve/guide"]').click();
    await page
      .getByRole("link", { name: "Replay tutorial", exact: true })
      .click();
    for (const [index, room] of rooms.slice(0, 3).entries()) {
      await expect(page.getByTestId("puzzle-play")).toHaveAttribute(
        "data-tutorial-replay",
        "true",
      );
      await expectTutorialPhase(
        page,
        ["learn", "practice", "trial"][index],
        ["Learn", "Practice", "Trial"][index],
      );
      await nextTutorialChamber(await playRoom(page, room, { modes: false }));
    }
    assert.deepEqual(
      await page.evaluate(() => window.runeQa.tables.rune_puzzle_results),
      records,
      "Replaying the tutorial preserves all saved records and never duplicates stars",
    );
    await routeIs(page, `/rune-delve/chamber/${rooms[3].id}`);
    await expect(page.getByTestId("puzzle-play")).toHaveAttribute(
      "data-tutorial-replay",
      "false",
    );
    report.checks.push({
      label: "learn-practice-trial-graduation-solo-help-veteran-replay",
      ok: true,
    });
    console.log("PASS tutorial progression and veteran replay");
  } finally {
    await context.close();
  }
}
async function setFixtureVisibility(page, hidden) {
  // Environment simulation only: gameplay still receives normal user inputs.
  await page.evaluate((value) => {
    for (const [property, state] of [
      ["hidden", value],
      ["visibilityState", value ? "hidden" : "visible"],
    ]) {
      if (value)
        Object.defineProperty(document, property, {
          configurable: true,
          value: state,
        });
      else delete document[property];
    }
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}
async function tutorialMotionLifecycle(motion) {
  const { page, context } = await setup(390, 844, motion);
  try {
    await go(page, "/rune-delve/chamber/ember-01", {
      puzzleCompleted: motion === "reduce" ? "0" : "9999",
    });
    if (motion === "reduce")
      await assertStaticTutorialMarker(
        page,
        "reduced-motion-static-gold-tutorial-marker",
      );
    const { rooms } = await roomData(page);
    const room = rooms[0],
      model = await modelPath(page, room);
    const board = page.getByTestId("puzzle-board");
    await expect(board).toHaveAttribute("data-motion-active", "false");
    await expect(page.locator("[data-puzzle-effect]")).toHaveCount(0);
    const sequence = async () =>
      Number(await board.getAttribute("data-motion-sequence"));
    const firstSequence = await sequence();
    const tileGeometry = await board
      .locator("[data-puzzle-cell]")
      .evaluateAll((tiles) =>
        tiles.map((tile) => {
          const { x, y, width, height } = tile.getBoundingClientRect();
          return [x, y, width, height];
        }),
      );
    if (motion !== "reduce") {
      // Arm before input so the sampler catches the actual short CSS transition.
      await page.evaluate(() => {
        window.__runeQaRenderedPush = new Promise((resolve) => {
          const started = performance.now();
          const watch = () => {
            const root = document.querySelector('[data-testid="puzzle-board"]');
            const actor = root?.querySelector(".rp-motion-actor.is-stone");
            if (actor) {
              const sequence = root.getAttribute("data-motion-sequence");
              const animation = actor
                .getAnimations()
                .find((item) => item.animationName === "rp-actor-arrival");
              const snapshot = () => ({
                transform: getComputedStyle(actor).transform,
                progress:
                  animation?.effect?.getComputedTiming().progress ?? null,
              });
              const before = snapshot();
              requestAnimationFrame(() =>
                requestAnimationFrame(async () => {
                  const after = snapshot();
                  await Promise.race([
                    animation?.finished.catch(() => {}),
                    new Promise((done) => setTimeout(done, 300)),
                  ]);
                  const targetCell =
                    Number(root.getAttribute("data-area-index")) * 36 +
                    (Number(actor.style.gridRow) - 1) * 6 +
                    Number(actor.style.gridColumn) -
                    1;
                  const canonical = root.querySelector(
                    `[data-puzzle-cell="${targetCell}"] > .rp-stone`,
                  );
                  const ghost = actor.querySelector(":scope > .rp-stone");
                  const bounds = (node) => {
                    if (!node) return null;
                    const { x, y, width, height } =
                      node.getBoundingClientRect();
                    return [x, y, width, height];
                  };
                  resolve({
                    sequence,
                    sameActor:
                      actor.isConnected &&
                      root.getAttribute("data-motion-sequence") === sequence,
                    before,
                    after,
                    endpoint: {
                      targetCell,
                      ghost: bounds(ghost),
                      canonical: bounds(canonical),
                    },
                  });
                }),
              );
            } else if (performance.now() - started < 1200)
              requestAnimationFrame(watch);
            else resolve({ error: "No rendered stone transition appeared" });
          };
          requestAnimationFrame(watch);
        });
      });
    }
    for (let index = 0; index < 2; index++) {
      await page.keyboard.press(keyFor(room.solution[index]));
    }
    await assertBoard(
      page,
      model.states[2],
      room,
      "Rapid controls commit each real input once",
    );
    if (motion === "reduce") {
      await expect(board).toHaveAttribute("data-motion-paused", "true");
      await expect(board).toHaveAttribute("data-motion-active", "false");
      await expect(page.locator("[data-puzzle-effect]")).toHaveCount(0);
      await expect(page.locator(".rp-motion-actor")).toHaveCount(0);
      assert.equal(
        await board.evaluate(
          (node) =>
            node
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
        0,
        "Reduced motion runs no CSS animations",
      );
    } else {
      const renderedPush = await page.evaluate(
        () => window.__runeQaRenderedPush,
      );
      assert.equal(renderedPush.sameActor, true, JSON.stringify(renderedPush));
      assert.equal(Number(renderedPush.sequence), firstSequence + 2);
      assert.ok(
        renderedPush.before.progress !== null &&
          renderedPush.after.progress > renderedPush.before.progress,
        "The real CSS push animation advances between rendered frames",
      );
      assert.notEqual(
        renderedPush.before.transform,
        renderedPush.after.transform,
        "The stone visibly travels between rendered frames",
      );
      assert.ok(
        renderedPush.endpoint.ghost && renderedPush.endpoint.canonical,
        "The finished ghost and its authoritative target stone both have bounds",
      );
      renderedPush.endpoint.ghost.forEach((value, index) => {
        assert.ok(
          Math.abs(value - renderedPush.endpoint.canonical[index]) <= 0.5,
          `Ghost handoff matches target cell ${renderedPush.endpoint.targetCell} within half a pixel`,
        );
      });
      assert.equal(
        await sequence(),
        firstSequence + 2,
        "Each rapid move emits exactly one feedback sequence",
      );
      await expect(board).toHaveAttribute("data-motion-active", "true");
      await expect(board).toHaveAttribute("data-motion-kind", "push");
      await expect(page.locator('[data-puzzle-effect~="seal"]')).toHaveCount(1);
      assert.ok(
        (await page.locator(".rp-motion-layer > .rp-motion-actor").count()) <=
          5,
      );
      await expect(board).toHaveAttribute("data-motion-active", "false", {
        timeout: 1200,
      });
      await expect(page.locator("[data-puzzle-effect]")).toHaveCount(0);
      await expect(page.locator(".rp-motion-actor")).toHaveCount(0);
      const settledGeometry = await board
        .locator("[data-puzzle-cell]")
        .evaluateAll((tiles) =>
          tiles.map((tile) => {
            const { x, y, width, height } = tile.getBoundingClientRect();
            return [x, y, width, height];
          }),
        );
      assert.deepEqual(
        settledGeometry,
        tileGeometry,
        "Moving actors preserve the authoritative tile geometry",
      );
      assert.ok(
        settledGeometry.every(
          ([, , width, height]) => width >= 43.5 && height >= 43.5,
        ),
        "Motion preserves 44 px touch targets",
      );
      await page
        .getByRole("button", { name: "Undo last step", exact: true })
        .click();
      await assertBoard(
        page,
        model.states[1],
        room,
        "Undo changes state without replaying feedback",
      );
      await expect(board).toHaveAttribute("data-motion-active", "false");
      assert.equal(await sequence(), firstSequence + 2);
      await reloadChamber(page, room);
      await assertBoard(
        page,
        model.states[1],
        room,
        "Restoring a checkpoint does not animate old inputs",
      );
      await expect(board).toHaveAttribute("data-motion-active", "false");
      await expect(page.locator("[data-puzzle-effect]")).toHaveCount(0);
      await actMove(page, room.solution[1], model.states[1], "arrow");
      await assertBoard(
        page,
        model.states[2],
        room,
        "Visible push before lifecycle pause",
      );
      const beforeHidden = await sequence();
      await setFixtureVisibility(page, true);
      await expect(board).toHaveAttribute("data-motion-paused", "true");
      await expect(board).toHaveAttribute("data-motion-active", "false");
      await expect(page.locator("[data-puzzle-effect]")).toHaveCount(0);
      await page.keyboard.press(keyFor(room.solution[2]));
      await assertBoard(
        page,
        model.states[2],
        room,
        "Hidden page ignores gameplay input",
      );
      await setFixtureVisibility(page, false);
      await expect(board).toHaveAttribute("data-motion-paused", "false");
      await expect(board).toHaveAttribute("data-motion-active", "false");
      assert.equal(
        await sequence(),
        beforeHidden,
        "Visibility resume never replays an old effect",
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(board).toHaveAttribute("data-motion-paused", "true");
      await expect(board).toHaveAttribute("data-motion-active", "false");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page
        .getByRole("button", { name: "Restart chamber", exact: true })
        .click();
      await assertBoard(
        page,
        model.states[0],
        room,
        "Restart returns to a quiet baseline",
      );
      await expect(board).toHaveAttribute("data-motion-active", "false");
      await expect(page.locator("[data-puzzle-effect]")).toHaveCount(0);
      assert.equal(await sequence(), beforeHidden);
    }
    await settle(page);
    const finiteRunning = await board.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getTiming().iterations !== Infinity,
          ).length,
    );
    assert.equal(
      finiteRunning,
      0,
      "No finite motion remains after feedback settles",
    );
    report.checks.push({
      label: `tutorial-motion-${motion}-rapid-undo-restore-visibility`,
      ok: true,
    });
    console.log(`PASS tutorial motion lifecycle ${motion}`);
  } finally {
    await context.close();
  }
}

try {
  await start();
  if (!checksOnly) await fullJourney();
  if (!journeyOnly) {
    await tutorialProgression();
    await tutorialMotionLifecycle("no-preference");
    await tutorialMotionLifecycle("reduce");
    await releasedFrontierCarriesForward();
    for (const [width, height, motion] of [
      [320, 568, "no-preference"],
      [390, 844, "reduce"],
      [844, 390, "no-preference"],
    ]) {
      await menuAndMobile(width, height, motion);
      await adventureExploration(width, height, motion);
    }
    await checkpointAndAccounts();
    await lostReceipt();
  }
  assert.deepEqual(report.runtimeErrors, [], "No unhandled browser errors");
  console.log(
    `PASS Rune Delve spatial puzzles: ${report.checks.length} checks`,
  );
} catch (error) {
  report.errors.push(error.stack || String(error));
  console.error(error);
  if (currentPage && !currentPage.isClosed())
    await currentPage
      .screenshot({ path: join(output, "failure.png") })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("Report:", join(output, "report.json"));
  await browser?.close().catch(() => {});
  await cleanupServer();
}
