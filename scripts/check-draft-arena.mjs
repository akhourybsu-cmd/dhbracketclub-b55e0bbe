// Production Draft Arena screens with isolated browser-local transport.
// Starts8098 and cleans up. No live account/network writes.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.DRAFT_QA_OUTPUT || await mkdtemp(join(tmpdir(), "draft-arena-"));
await mkdir(output, { recursive: true });
const base = process.env.DRAFT_QA_URL || "http://127.0.0.1:8098";
const report = { checks: [], errors: [], runtimeErrors: [], artifacts: output,
  fixtures: "Production pages/hooks/rules; browser-local identity, Supabase and image transport. No live writes." };
let server, browser, currentPage, serverLog;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
console.log("Draft Arena artifacts:", output);

async function cleanup() {
  await browser?.close().catch(() => {});
  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(1000)]);
    if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
  }
  serverLog?.end();
}
process.once("SIGINT", () => { void cleanup().then(() => process.exit(130)); });
process.once("SIGTERM", () => { void cleanup().then(() => process.exit(143)); });

async function start() {
  if (!process.env.DRAFT_QA_URL) {
    serverLog = createWriteStream(join(output, "vite.log"));
    server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "8098", "--strictPort"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) throw Error("Preview exited; inspect vite.log");
    try { if ((await fetch(`${base}/scripts/fixtures/draft-arena.html`)).ok) break; } catch { /* Bounded startup. */ }
    if (attempt === 99) throw Error("Preview did not start within20seconds");
    await delay(200);
  }
  browser = await chromium.launch({ executablePath: process.env.DRAFT_QA_CHROMIUM || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
}

async function setup(width = 390, height = 844, theme = "dark", motion = "no-preference") {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, reducedMotion: motion });
  const page = await context.newPage(); currentPage = page;
  page.setDefaultTimeout(12_000);
  page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const stub = (path, body) => page.route(`**/${path}*`, (route) => route.fulfill({ contentType: "text/javascript", body }));
  await stub("src/integrations/supabase/client.ts", "export {supabase} from '/scripts/fixtures/draft-arena-backend.ts';");
  await stub("src/contexts/AuthContext.tsx", "const id=new URLSearchParams(location.search).get('user')||'u1';const user={id,user_metadata:{display_name:id==='u1'?'Alex':id==='u2'?'Blair':'Casey'}};export const useAuth=()=>({user,loading:false,signOut:async()=>{}});");
  await stub("src/contexts/ClubContext.tsx", "const club={id:'club',name:'Dry My Horse',slug:'dh'};export const useClub=()=>({club,loading:false,isClubAdmin:false,isPrivateSession:false});");
  await page.route("**/images/qa-draft-poster.svg*", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#1f4053"/><stop offset="1" stop-color="#11151d"/></linearGradient></defs><path fill="url(#a)" d="M0 0h400v600H0z"/><circle fill="none" stroke="#d7b674" stroke-width="4" cx="200" cy="265" r="106"/><path fill="#d7b674" d="m180 216 70 49-70 49z"/><text fill="#ece4cf" x="200" y="460" font-family="serif" font-size="24" text-anchor="middle">CINEMA COLLECTION</text></svg>' }));
  await page.route("**/images/qa-draft-missing.jpg*", (route) => route.fulfill({ status: 404, body: "Expected missing fixture image" }));
  await page.addInitScript(() => {
    sessionStorage.setItem("da_boot_played_v1", "1");
    localStorage.setItem("dh-club-sound-enabled", "false");
  });
  return { page, context, theme };
}

async function go(page, route, { theme = "dark", user = "u1", role = "member" } = {}) {
  const params = new URLSearchParams({ route, theme, user, role });
  await page.goto(`${base}/scripts/fixtures/draft-arena.html?${params}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.daQa?.ready && window.daQueryClient);
  await expect(page.locator(".da-shell main")).toBeVisible();
  await settle(page);
}
async function settle(page) {
  await page.waitForFunction(() => window.daQueryClient?.isFetching() === 0 && window.daQueryClient?.isMutating() === 0);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.waitForFunction(() => [...document.querySelectorAll(".da-shell,[role=dialog]")].every((root) => root.getAnimations({ subtree: true }).every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity)), undefined, { timeout: 5000 });
}
async function shot(page, label) { await page.screenshot({ path: join(output, `${label}.png`) }); }
async function captureFailure(page, label) {
  await shot(page, `${label}-failure`).catch(() => {});
  const state = await page.evaluate(() => ({
    route: document.querySelector('[data-qa-route]')?.getAttribute('data-qa-route'),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map((node) => ({ html: node.outerHTML.slice(0, 1800), label: node.getAttribute('aria-label'), labelledBy: node.getAttribute('aria-labelledby') })),
    buttons: [...document.querySelectorAll('button')].filter((node) => /Make selection/i.test(node.getAttribute('aria-label') || node.textContent || '')).map((node) => node.outerHTML),
    text: document.body.innerText.slice(0, 7000),
    draft: window.daQa?.tables.drafts.find((draft) => draft.id === 'active'),
    picks: window.daQa?.tables.draft_picks.filter((pick) => pick.draft_id === 'active'),
    calls: window.daQa?.calls.slice(-35),
  })).catch((error) => ({ captureError: String(error) }));
  await writeFile(join(output, `${label}-diagnostics.json`), JSON.stringify(state, null, 2));
}
async function fit(page, label, selector = ".da-shell") {
  await settle(page);
  const issues = await page.locator(selector).evaluate((root) => {
    const failures = [];
    if (document.documentElement.scrollWidth > innerWidth + 2) failures.push("Document overflows horizontally");
    if (document.documentElement.scrollHeight > innerHeight + 2) failures.push("Document scrolls instead of arena content");
    const rect = root.getBoundingClientRect();
    if (rect.left < -2 || rect.right > innerWidth + 2) failures.push("Arena escapes viewport width");
    const controls = root.querySelectorAll(".da-hud-action,.da-hud-chip,.da-room-tabs [role=tab],.da-cta,.dl-cta,.da-room-command");
    for (const node of controls) {
      if (!(node instanceof HTMLElement) || node.closest('[aria-hidden="true"],[hidden]')) continue;
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || bounds.width === 0 || bounds.height === 0) continue;
      if (bounds.height < 43.5 || bounds.width < 43.5) failures.push(`Small main target: ${node.getAttribute("aria-label") || node.textContent?.trim().slice(0, 40)} ${bounds.width.toFixed(1)}×${bounds.height.toFixed(1)}`);
    }
    return [...new Set(failures)];
  });
  report.checks.push({ label, ok: issues.length === 0, issues });
  assert.deepEqual(issues, [], label);
}
async function fullyVisibleControl(control, label) {
  const issues = await control.evaluate((node) => {
    const failures = [];
    const box = node.getBoundingClientRect();
    if (box.top < -1 || box.bottom > innerHeight + 1 || box.left < -1 || box.right > innerWidth + 1)
      failures.push("Input escapes the visible viewport");
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1))
        failures.push(`Input clipped vertically by ${parent.className}`);
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (box.left < bounds.left - 1 || box.right > bounds.right + 1))
        failures.push(`Input clipped horizontally by ${parent.className}`);
    }
    return failures;
  });
  report.checks.push({ label, ok: issues.length === 0, issues });
  assert.deepEqual(issues, [], label);
}

async function createWizard(page, label) {
  const topicValue = "Arcade legends";
  const descriptionValue = "A balanced roster of unforgettable games.";
  const judgingValue = "Include console, PC and arcade games. Evaluate every pick on its own merit.";
  const topic = page.getByPlaceholder("e.g. Best Fast Food Items", { exact: true });
  const description = page.getByPlaceholder("What are we drafting?", { exact: true });
  await expect(topic).toBeVisible();
  await fullyVisibleControl(topic, `${label}-create-topic-initial-visibility`);
  await topic.focus();
  await expect(topic).toBeFocused();
  await fullyVisibleControl(topic, `${label}-create-focused-topic-visibility`);
  await topic.fill(topicValue);
  await description.scrollIntoViewIfNeeded();
  await description.fill(descriptionValue);
  const stage = page.locator(".da-create-stage");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(stage).toHaveAttribute("aria-label", "Judging setup");
  await settle(page);
  const judging = stage.locator("textarea");
  await judging.scrollIntoViewIfNeeded();
  await judging.focus();
  await judging.fill(judgingValue);
  await fullyVisibleControl(judging, `${label}-create-judging-reachable-in-stage`);
  await fit(page, `${label}-create-judging`);
  await shot(page, `${label}-create-judging`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(stage).toHaveAttribute("aria-label", "Format setup");
  await expect(stage).toContainText("5 picks each");
  await fit(page, `${label}-create-format`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(stage).toHaveAttribute("aria-label", "Review setup");
  await expect(stage).toContainText(topicValue);
  await expect(stage).toContainText(descriptionValue);
  await expect(stage).toContainText("5 picks each");
  await expect(stage).toContainText("Added");
  await fit(page, `${label}-create-review`);
  await shot(page, `${label}-create-review`);
  for (const step of ["Format setup", "Judging setup", "Basics setup"]) {
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(stage).toHaveAttribute("aria-label", step);
    await settle(page);
    if (step === "Judging setup") await expect(stage.locator("textarea")).toHaveValue(judgingValue);
  }
  await expect(topic).toHaveValue(topicValue);
  await expect(description).toHaveValue(descriptionValue);
  const draftWrites = await page.evaluate(() => window.daQa.operations.filter((operation) => operation.table === "drafts" && operation.mode === "insert").length);
  assert.equal(draftWrites, 0, "Review/back does not prematurely create a draft");
  report.checks.push({ label: `${label}-create-four-stage-rounds-default-and-back-state`, ok: true });
}
async function tab(page, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const option = page.getByRole("tab", { name: new RegExp(`^${escaped}(?:\\s*\\d+)?$`, "i") });
  await option.click(); await expect(option).toHaveAttribute("aria-selected", "true"); await settle(page);
}
async function drawer(page) {
  await page.getByRole("button", { name: "Draft Arena menu", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Draft Arena menu", exact: true });
  await expect(panel).toBeVisible(); return panel;
}

async function viewportJourney(width, height, theme, motion) {
  const { page, context } = await setup(width, height, theme, motion);
  const label = `${width}x${height}-${theme}-${motion}`;
  try {
    await go(page, "/drafts", { theme });
    await expect(page.locator("main")).toContainText("Greatest movie night");
    await fit(page, `${label}-lobby`); await shot(page, `${label}-lobby`);
    for (const label of ["Season", "Stats", "Rooms"]) {
      const tabs = page.getByRole("tab", { name: new RegExp(`^${label}(?:\\s*\\d+)?$`, "i") });
      if (await tabs.count()) { await tabs.first().click(); await settle(page); }
    }
    const menu = await drawer(page);
    await fit(page, `${label}-drawer`, '[role="dialog"]'); await shot(page, `${label}-drawer`);
    const display = menu.getByRole("tab", { name: "Display", exact: true });
    if (await display.count()) { await display.click(); await fit(page, `${label}-display`, '[role="dialog"]'); }
    await page.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Draft Arena menu", exact: true })).toBeFocused();
    await go(page, "/drafts/active", { theme });
    await expect(page.locator("main")).toContainText("Greatest movie night");
    await fit(page, `${label}-active`); await shot(page, `${label}-active`);
    for (const name of ["Pick log", "My desk", "Briefing", "Board"]) { await tab(page, name); await fit(page, `${label}-${name.toLowerCase().replaceAll(" ", "-")}`); }
    assert.equal(await page.locator(".draft-pick-fresh").count(), 0, "Mounting a saved room does not announce existing picks as new");
    await go(page, "/drafts/complete", { theme });
    await expect(page.locator("main")).toContainText("All-time movie icons");
    for (const name of ["Results", "Teams", "Briefing"]) { await tab(page, name); await fit(page, `${label}-complete-${name.toLowerCase()}`); }
    await shot(page, `${label}-complete`);
    const calls = await page.evaluate(() => window.daQa.calls);
    assert.equal(calls.some((call) => call.function === "rate-draft"), false, "Complete report renders persisted results without calling the judge");
    await go(page, "/drafts/waiting", { theme, user: "u3" });
    await expect(page.locator("main")).toContainText("Ultimate road trip");
    await fit(page, `${label}-waiting`); await shot(page, `${label}-waiting`);
    await expect(page.getByRole("button", { name: /Join Draft/i })).toBeVisible();
    await go(page, "/drafts/create", { theme });
    await expect(page.locator("main")).toContainText(/Create|New Draft|Forge/i);
    await fit(page, `${label}-create`); await shot(page, `${label}-create`);
    await createWizard(page, label);
    if (motion === "reduce") {
      const running = await page.locator(".da-shell").evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity).length);
      assert.equal(running, 0, "Reduced motion has no running finite transitions at rest");
    }
    console.log(`PASS arena ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function submitPick() {
  const { page, context } = await setup();
  try {
    await go(page, "/drafts");
    await shot(page, "initial-lobby");
    await go(page, "/drafts/active");
    await shot(page, "initial-active-room");
    const before = await page.evaluate(() => structuredClone(window.daQa.tables.draft_picks.filter((pick) => pick.draft_id === "active")));
    assert.equal(before.length, 6);
    const make = page.getByRole("button", { name: /^Make [Ss]election$/ });
    await writeFile(join(output, "make-selection-control.json"), JSON.stringify({ html: await make.first().evaluate((node) => node.outerHTML) }, null, 2));
    await make.first().click();
    await shot(page, "pick-after-make-selection");
    const composer = page.locator('.da-pick-dialog[role="dialog"]');
    await expect(composer).toContainText("Round 3 · Pick #7");
    await expect(composer).toBeVisible(); await fit(page, "pick-composer", '[role="dialog"]');
    const input = composer.getByPlaceholder("Enter your pick…");
    await input.fill("Arrival");
    await expect(composer).toContainText("Already on the board");
    await input.fill("Interstellar");
    await input.press("Enter");
    await expect.poll(() => page.evaluate(() => window.daQa.tables.draft_picks.filter((pick) => pick.draft_id === "active").length)).toBe(7);
    const result = await page.evaluate(() => ({ picks: window.daQa.tables.draft_picks.filter((pick) => pick.draft_id === "active"), draft: window.daQa.tables.drafts.find((draft) => draft.id === "active"), writes: window.daQa.operations.filter((write) => write.table === "draft_picks" && write.mode === "insert") }));
    assert.deepEqual(result.picks.slice(0, 6), before, "Existing picks stay unchanged");
    assert.equal(result.writes.length, 1, "One submit creates one canonical pick");
    assert.equal(result.picks[6].user_id, "u1"); assert.equal(result.picks[6].pick_text, "Interstellar");
    assert.equal(result.picks[6].pick_number, 7); assert.equal(result.picks[6].round, 3);
    assert.equal(result.draft.current_pick_user_id, "u2"); assert.equal(result.draft.current_pick_number, 8);
    await expect(composer).toHaveCount(0); await settle(page); await shot(page, "pick-confirmed");
    report.checks.push({ label: "actual-pick-duplicate-block-submit-once-snake-turn", ok: true });
    console.log("PASS actual pick submission and snake turn");
  } catch (error) { await captureFailure(page, "submit-pick"); throw error; }
  finally { await context.close(); }
}

async function artworkSelection() {
  const { page, context } = await setup();
  try {
    await go(page, "/drafts/active");
    await tab(page, "Pick log");
    await page.getByRole("button", { name: "Choose artwork for Arrival", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Arrival", exact: true });
    await expect(picker).toBeVisible();
    await fit(page, "artwork-picker", '[role="dialog"]');
    const alternative = picker.getByRole("button", { name: /Alternative poster/i });
    await alternative.click();
    await expect(alternative).toHaveAttribute("aria-pressed", "true");
    await expect(picker.locator('.da-image-preview [data-art-state]')).toHaveAttribute("data-art-state", "ready");
    await expect(picker.getByRole("img", { name: "Artwork unavailable for Unavailable poster", exact: true })).toBeVisible();
    await shot(page, "artwork-picker");
    await picker.getByRole("button", { name: "Use selected artwork", exact: true }).click();
    await expect(picker).toHaveCount(0);
    const result = await page.evaluate(() => ({ image: window.daQa.tables.item_enrichments.find((image) => image.id === "image-active-pick-1"), writes: window.daQa.operations.filter((write) => write.table === "item_enrichments" && write.mode === "update") }));
    assert.equal(result.writes.length, 1);
    assert.ok(result.image.image_url.endsWith("?alternative=1"));
    assert.equal(result.image.matched_name, "Arrival");
    assert.equal(result.image.confidence, 0.99);
    assert.equal(result.image.status, "matched");
    report.checks.push({ label: "artwork-selection-broken-fallback-preserves-metadata", ok: true });
    console.log("PASS artwork selection and fallback");
  } catch (error) { await captureFailure(page, "artwork-selection"); throw error; }
  finally { await context.close(); }
}

async function liveWorkspace(width, height, motion = "no-preference") {
  const { page, context } = await setup(width, height, "dark", motion);
  const label = `live-${width}x${height}-${motion}`;
  try {
    await go(page, "/drafts/__qa/live");
    const kiosk = page.getByRole("dialog", { name: "My live draft kiosk", exact: true });
    await expect(kiosk).toBeVisible();
    await expect(kiosk).toContainText("Clock paused");
    await fit(page, `${label}-board`, ".da-pk");
    for (const name of ["My team", "Draft desk", "Live feed", "Host", "Board"]) {
      await kiosk.getByRole("tab", { name, exact: true }).click();
      await expect(kiosk.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
      await fit(page, `${label}-${name.toLowerCase().replaceAll(" ", "-")}`, ".da-pk");
      await expect(kiosk.getByRole("button", { name: "Make my pick", exact: true })).toBeVisible();
    }
    await shot(page, `${label}-workspace`);
    await kiosk.getByRole("button", { name: "Make my pick", exact: true }).click();
    const composer = page.locator('.da-pick-dialog[role="dialog"]');
    await expect(composer).toContainText("Round 3 · Pick #7");
    await expect(composer).toBeVisible();
    await fit(page, `${label}-composer`, '[role="dialog"][aria-labelledby]:not(.da-pk)');
    const input = composer.getByRole("textbox", { name: "Your draft pick", exact: true });
    await expect(input).toBeFocused();
    const topmost = await input.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const above = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return above === node || node.contains(above);
    });
    assert.equal(topmost, true, "Composer stays above the live kiosk");
    await page.keyboard.press("Escape");
    await expect(composer).toHaveCount(0);
    await expect(kiosk).toBeVisible();
    await kiosk.getByRole("button", { name: "Close my kiosk", exact: true }).click();
    await expect(kiosk).toHaveCount(0);
    await page.getByRole("button", { name: "Open my live kiosk", exact: true }).click();
    await expect(kiosk).toBeVisible();
    assert.equal(await page.locator(".da-kiosk-reveal").count(), 0, "Saved picks do not replay a cinematic on kiosk mount");
    report.checks.push({ label: `${label}-clock-tabs-composer-layer-and-reopen`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

try {
  await start();
  await submitPick();
  await artworkSelection();
  for (const args of [[320,568,"no-preference"],[390,844,"reduce"],[844,390,"no-preference"]]) await liveWorkspace(...args);
  for (const args of [[320,568,"dark","no-preference"],[390,844,"light","no-preference"],[390,844,"dark","reduce"],[844,390,"dark","no-preference"],[1440,900,"light","no-preference"]]) await viewportJourney(...args);
  assert.deepEqual(report.runtimeErrors, [], "No unhandled browser errors");
  console.log(`PASS Draft Arena: ${report.checks.length} checks`);
} catch (error) {
  report.errors.push(error.stack || String(error)); console.error(error);
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: join(output, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log("Report:", join(output, "report.json")); await cleanup();
}
