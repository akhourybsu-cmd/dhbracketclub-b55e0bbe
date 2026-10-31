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
    { timeout: 2500 },
  );
}
async function routeIs(page, path) {
  await expect(page.locator("[data-qa-route]")).toHaveAttribute(
    "data-qa-route",
    path,
  );
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
  return page.locator('[data-testid="puzzle-play"]').evaluate((root) => ({
    player: Number(
      root
        .querySelector('[data-puzzle-player="true"]')
        ?.getAttribute("data-puzzle-cell"),
    ),
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
  }));
}
function expectedBoard(state, room) {
  return {
    player: state.player,
    stones: state.stones.map((stone) => `${stone.color}:${stone.cell}`).sort(),
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
    const [r, c] = [Math.floor(state.player / 6), state.player % 6];
    const next =
      direction === "up"
        ? (r - 1) * 6 + c
        : direction === "down"
          ? (r + 1) * 6 + c
          : direction === "left"
            ? r * 6 + c - 1
            : r * 6 + c + 1;
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
  }
  const result = page.getByRole("dialog", {
    name: "Chamber restored",
    exact: true,
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
      name: /^(Enter the next chamber|Return to the journey)/,
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
    const { rooms } = await roomData(page),
      before = await legacySnapshot(page);
    assert.equal(rooms.length, 18, "First release contains18 authored rooms");
    const first = await page.evaluate(
      () => window.runeQa.tables.rune_puzzle_results.length,
    );
    assert.equal(
      first,
      0,
      "Fresh puzzle track starts atroom1 without legacy progress",
    );
    await expect(
      page.getByRole("link", { name: /^Enter the Hollow/ }),
    ).toBeVisible();
    await page.getByRole("link", { name: /^Enter the Hollow/ }).click();
    for (const room of rooms) {
      await routeIs(page, `/rune-delve/chamber/${room.id}`);
      const result = await playRoom(page, room, {
        snapshot: [1, 7, 13, 18].includes(room.order),
      });
      await result
        .getByRole("link", {
          name: /^(Enter the next chamber|Return to the journey)/,
        })
        .click();
    }
    await routeIs(page, "/rune-delve/journey");
    const records = await page.evaluate(() =>
      window.runeQa.tables.rune_puzzle_results.filter(
        (row) => row.user_id === "member",
      ),
    );
    assert.equal(records.length, 18);
    assert.equal(
      records.reduce((sum, row) => sum + row.stars, 0),
      54,
    );
    assert.deepEqual(
      await legacySnapshot(page),
      before,
      "New puzzle journey does not mutate legacy RPG values",
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.getByTestId("puzzle-home")).toBeVisible();
    await expect(page.locator(".rp-home-progress")).toContainText("18");
    await expect(page.locator(".rp-home-progress")).toContainText("54");
    assert.equal(
      await page.evaluate(
        () => window.runeQa.tables.rune_puzzle_results.length,
      ),
      18,
      "Records persist acrossreload",
    );
    await shot(page, "journey-complete");
    report.checks.push({
      label: "all18-journal-reload-legacy-preservation",
      ok: true,
      rooms: 18,
      stars: 54,
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
    await go(page, "/rune-delve", { puzzleCompleted: "18" });
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
    await page.getByRole("link", { name: /^Chambers/ }).click();
    await expect(page.getByTestId("puzzle-journey")).toBeVisible();
    const { rooms, chapters } = await roomData(page);
    for (const chapter of chapters) {
      await page
        .getByRole("button", { name: new RegExp(chapter.title) })
        .click();
      await fit(page, `${label}-chapter${chapter.id}`);
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
    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await routeIs(page, "/rune-delve/legacy");
    await expect(page.locator(".rd-mode main")).toContainText("Expedition");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await routeIs(page, "/rune-delve");
    await page.getByRole("link", { name: /^Chambers/ }).click();
    const representative =
      rooms.find((room) => room.mechanic === "ice" && room.guardian) ??
      rooms.find((room) => room.mechanic === "ice");
    await page
      .getByRole("button", {
        name: new RegExp(
          chapters.find((chapter) => chapter.id === representative.chapter)
            .title,
        ),
      })
      .click();
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
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
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
    await go(page, "/rune-delve/chamber/ember-01");
    const { rooms } = await roomData(page),
      room = rooms[0],
      model = await modelPath(page, room);
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
    assert.equal(before.results, 1);
    assert.equal(before.receipts, 1);
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
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page);
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
    assert.equal(after.results, 1);
    assert.equal(after.receipts, 1);
    assert.equal(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        checkpointKey("member", room),
      ),
      null,
      "Acknowledgedresult clears onlyits checkpoint",
    );
    report.checks.push({
      label: "commit-lost-ack-reload-exact-receipt-retry",
      ok: true,
    });
    console.log("PASS immutable receipt recovery");
  } catch (error) {
    await shot(page, `failure-${report.checks.length}`).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

try {
  await start();
  if (!checksOnly) await fullJourney();
  if (!journeyOnly) {
    for (const [width, height, motion] of [
      [320, 568, "no-preference"],
      [390, 844, "reduce"],
      [844, 390, "no-preference"],
    ])
      await menuAndMobile(width, height, motion);
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
