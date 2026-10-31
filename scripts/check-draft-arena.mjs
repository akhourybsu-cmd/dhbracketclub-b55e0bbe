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
  const page = await context.newPage();
  await installFixturePage(page);
  return { page, context, theme };
}
async function installFixturePage(page) {
  currentPage = page;
  page.setDefaultTimeout(12_000);
  page.on("pageerror", (error) => report.runtimeErrors.push(error.message));
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const stub = (path, body) => page.route(`**/${path}*`, (route) => route.fulfill({ contentType: "text/javascript", body }));
  await stub("src/integrations/supabase/client.ts", "export {supabase} from '/scripts/fixtures/draft-arena-backend.ts';");
  await stub("src/contexts/AuthContext.tsx", "const id=new URLSearchParams(location.search).get('user')||'u1';const user={id,user_metadata:{display_name:id==='u1'?'Alex':id==='u2'?'Blair':'Casey'}};export const useAuth=()=>({user,loading:false,signOut:async()=>{}});");
  await stub("src/contexts/ClubContext.tsx", "const club={id:'club',name:'Dry My Horse',slug:'dh'};export const useClub=()=>({club,loading:false,isClubAdmin:false,isPrivateSession:false});");
  await page.route("**/images/qa-draft-poster.svg*", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#1f4053"/><stop offset="1" stop-color="#11151d"/></linearGradient></defs><path fill="url(#a)" d="M0 0h400v600H0z"/><circle fill="none" stroke="#d7b674" stroke-width="4" cx="200" cy="265" r="106"/><path fill="#d7b674" d="m180 216 70 49-70 49z"/><text fill="#ece4cf" x="200" y="460" font-family="serif" font-size="24" text-anchor="middle">CINEMA COLLECTION</text></svg>' }));
  await page.route("**/images/qa-draft-missing.jpg*", (route) => route.fulfill({ status: 404, body: "Expected missing fixture image" }));
  await page.route("**/images/qa-draft-art/*.svg*", async (route) => {
    const kind = new URL(route.request().url()).pathname.split("/").pop().split(".")[0];
    if (kind === "slow") await delay(550);
    const [width, height] = kind === "portrait" ? [300, 600] : kind === "wide" ? [720, 280] : [360, 360];
    await route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${kind === "wide" ? "#234541" : kind === "square" ? "#392952" : "#173b55"}"/><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/3}" fill="none" stroke="#d7b674" stroke-width="5"/><text x="50%" y="55%" fill="#f7efdd" text-anchor="middle" font-family="serif" font-size="24">${kind.toUpperCase()} ART</text></svg>` }).catch(() => {});
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("da_boot_played_v1", "1");
    localStorage.setItem("dh-club-sound-enabled", "false");
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text) => { window.daClipboard = String(text); },
      readText: async () => window.daClipboard || '',
    } });
  });
}

async function go(page, route, { theme = "dark", user = "u1", role = "member", stress = "", art = "", shared = "" } = {}) {
  const params = new URLSearchParams({ route, theme, user, role, stress, art, shared });
  const projector = route.endsWith('/kiosk');
  await page.goto(`${base}/scripts/fixtures/draft-arena${projector ? '-projector' : ''}.html?${params}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.daQa?.ready && window.daQueryClient);
  await expect(page.locator(projector ? '.da-kiosk' : '.da-shell main')).toBeVisible();
  await settle(page);
}
async function settle(page) {
  await page.waitForFunction(() => window.daQueryClient?.isFetching() === 0 && window.daQueryClient?.isMutating() === 0);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.waitForFunction(() => [...document.querySelectorAll(".da-shell,.da-kiosk,[role=dialog]")].every((root) => root.getAnimations({ subtree: true }).every((animation) => {
    if (animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity) return true;
    // A running canonical countdown continuously advances its decorative ring.
    // Layout, dialog and feedback transitions must still finish normally.
    return animation instanceof CSSTransition && animation.transitionProperty === 'stroke-dasharray'
      && animation.effect?.target instanceof Element && animation.effect.target.matches('[role="timer"] circle');
  })), undefined, { timeout: 5000 }).catch(async (error) => {
    const animations = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').map((animation) => ({
      type: animation.constructor.name, property: animation instanceof CSSTransition ? animation.transitionProperty : null,
      iterations: animation.effect?.getTiming().iterations, target: animation.effect?.target?.outerHTML?.slice(0, 500),
    })));
    throw new Error(`${error.message}\nRunning animation diagnostics: ${JSON.stringify(animations)}`, { cause: error });
  });
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
async function fit(page, label, selector = ".da-shell", { allowDocumentScroll = false } = {}) {
  await settle(page);
  const issues = await page.locator(selector).evaluate((root, options) => {
    const failures = [];
    if (document.documentElement.scrollWidth > innerWidth + 2) failures.push("Document overflows horizontally");
    if (!options.allowDocumentScroll && document.documentElement.scrollHeight > innerHeight + 2) failures.push("Document scrolls instead of arena content");
    const rect = root.getBoundingClientRect();
    if (rect.left < -2 || rect.right > innerWidth + 2) failures.push("Arena escapes viewport width");
    const controls = root.querySelectorAll(".da-hud-action,.da-hud-chip,.da-room-tabs [role=tab],.da-cta,.dl-cta,.da-room-command,.da-kiosk-btn");
    for (const node of controls) {
      if (!(node instanceof HTMLElement) || node.closest('[aria-hidden="true"],[hidden]')) continue;
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || bounds.width === 0 || bounds.height === 0) continue;
      if (bounds.height < 43.5 || bounds.width < 43.5) failures.push(`Small main target: ${node.getAttribute("aria-label") || node.textContent?.trim().slice(0, 40)} ${bounds.width.toFixed(1)}×${bounds.height.toFixed(1)}`);
    }
    return [...new Set(failures)];
  }, { allowDocumentScroll });
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

async function interactiveAudit(page, label, selector = ".da-shell") {
  await settle(page);
  const audit = await page.locator(selector).evaluate((root) => {
    const issues = [];
    let examined = 0, offscreen = 0;
    for (const node of root.querySelectorAll('a[href],button,input,textarea,select,[role="tab"],[role="radio"]')) {
      if (!(node instanceof HTMLElement) || node.closest('[hidden],[aria-hidden="true"],[inert]') || node.matches(':disabled,[aria-disabled="true"]')) continue;
      const style = getComputedStyle(node), box = node.getBoundingClientRect();
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0 || box.width < 8 || box.height < 8) continue;
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const clipping = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(clipping.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
        if (/(auto|scroll|hidden|clip)/.test(clipping.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
      }
      const complete = box.left >= left - 1 && box.right <= right + 1 && box.top >= top - 1 && box.bottom <= bottom + 1;
      const anchored = node.closest('.da-hud,.da-kiosk-bar,.da-room-topbar,.da-room-tabs,.da-lobby-nav [role="tablist"],.da-pk-top,.da-pk-clock,.da-create-actions,.da-create-steps');
      const intersects = box.right > left + 1 && box.left < right - 1 && box.bottom > top + 1 && box.top < bottom - 1;
      const name = node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 60) || node.tagName;
      if (!complete) {
        offscreen++;
        // Scrolling lists deliberately contain more items than are visible.
        // Only anchored commands are required to fit without scrolling.
        if (anchored && intersects && !node.closest('.da-room-tabs,.da-pk-view-tabs')) issues.push(`Anchored control clipped: ${name}`);
        continue;
      }
      examined++;
      const above = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (above !== node && !node.contains(above)) issues.push(`Control center covered: ${name} by ${above?.className || above?.tagName}`);
    }
    return { issues: [...new Set(issues)], examined, legitimateOffscreen: offscreen };
  });
  report.checks.push({ label, ok: audit.issues.length === 0, ...audit });
  assert.deepEqual(audit.issues, [], label);
}

async function visibleAssets(page, label, selector = ".da-shell") {
  await expect.poll(() => page.locator(selector).evaluate((root) => [...root.querySelectorAll('img')].filter((image) => {
    const box = image.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0 && getComputedStyle(image).visibility !== 'hidden';
  }).filter((image) => !image.complete).length), { timeout: 5000 }).toBe(0);
  const result = await page.locator(selector).evaluate(async (root) => {
    const failures = [], images = [...root.querySelectorAll('img')].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0 && box.left < innerWidth && box.right > 0 && getComputedStyle(image).visibility !== 'hidden' && !image.closest('[hidden],[aria-hidden="true"]');
    });
    for (const image of images) {
      try { await image.decode(); } catch { failures.push(`Undecodable visible asset: ${image.alt || image.currentSrc}`); }
      if (image.naturalWidth === 0) failures.push(`Broken visible asset: ${image.alt || image.currentSrc}`);
    }
    for (const decoration of root.querySelectorAll('.da-arena-architecture,.da-arena-boot-grid,.da-room-watermark'))
      if (getComputedStyle(decoration).pointerEvents !== 'none') failures.push(`Decorative layer intercepts input: ${decoration.className}`);
    return { images: images.length, issues: failures };
  });
  report.checks.push({ label, ok: result.issues.length === 0, ...result });
  assert.deepEqual(result.issues, [], label);
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
    await tab(page, 'My desk');
    const deskHeading = page.locator('.da-room-panel .da-room-desk .da-desk-heading');
    if (await deskHeading.getAttribute('aria-expanded') === 'false') await deskHeading.click();
    await page.locator('.da-room-panel .da-desk-item').filter({ hasText: 'Interstellar' }).getByRole('button', { name: 'Choose', exact: true }).click();
    const deskComposer = page.locator('.da-pick-dialog[role="dialog"]');
    await expect(deskComposer.getByRole('textbox', { name: 'Your draft pick', exact: true })).toHaveValue('Interstellar');
    await settle(page); await expect(deskComposer).toBeVisible();
    await shot(page, 'desk-choice-keeps-composer-open'); await page.keyboard.press('Escape');
    await expect(deskComposer).toHaveCount(0);
    report.checks.push({ label: 'existing-saved-picks-do-not-close-composer-opened-from-desk', ok: true });
    await tab(page, 'Board');
    const make = page.getByRole("button", { name: /^Make [Ss]election$/ });
    await writeFile(join(output, "make-selection-control.json"), JSON.stringify({ html: await make.first().evaluate((node) => node.outerHTML) }, null, 2));
    await make.first().click();
    await shot(page, "pick-after-make-selection");
    const composer = page.locator('.da-pick-dialog[role="dialog"]');
    await expect(composer).toContainText("Round 3 · Pick #7");
    await expect(composer).toBeVisible(); await fit(page, "pick-composer", '[role="dialog"]');
    const input = composer.getByPlaceholder("Enter your pick…");
    await input.fill('千と千尋の神隠し');
    await input.dispatchEvent('compositionstart', { data: '千と千尋の神隠し' });
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: true });
    await input.dispatchEvent('compositionend', { data: '千と千尋の神隠し' });
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, which: 229, isComposing: false });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(composer).toBeVisible(); await expect(input).toHaveValue('千と千尋の神隠し');
    assert.equal(await page.evaluate(() => window.daQa.operations.filter((operation) => operation.table === 'draft_picks' && operation.mode === 'insert').length), 0, 'IME confirmation and keyCode 229 never submit a draft pick');
    report.checks.push({ label: 'pick-composer-ime-enter-never-submits', ok: true });
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
    await picker.getByRole("button", { name: /Unavailable poster/i }).click();
    await expect(picker.locator('.da-image-preview [data-art-state]')).toHaveAttribute("data-art-state", "unavailable");
    await expect(picker.getByRole("button", { name: "Use selected artwork", exact: true })).toBeDisabled();
    assert.equal(await page.evaluate(() => window.daQa.operations.filter((operation) => operation.table === "item_enrichments").length), 0, "A failed preview cannot save artwork");
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
    await go(page, "/drafts/active/__qa/live");
    const enter = page.getByRole('button', { name: 'Enter live draft', exact: true });
    const kiosk = page.getByRole("dialog", { name: "Draft Arena player screen", exact: true });
    await expect(kiosk).toHaveCount(0);
    await enter.click();
    await expect(kiosk).toBeVisible();
    await expect(kiosk.getByRole('button', { name: 'Player sound', exact: true })).toHaveAttribute('aria-pressed', 'false');
    assert.equal(await page.evaluate(() => document.fullscreenElement === null), true, 'Entering the player screen does not request native fullscreen');
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
    await kiosk.getByRole("button", { name: "Back to event", exact: true }).click();
    await expect(kiosk).toHaveCount(0);
    await expect(enter).toBeFocused();
    await enter.click();
    await expect(kiosk).toBeVisible();
    assert.equal(await page.locator(".da-kiosk-reveal").count(), 0, "Saved picks do not replay a cinematic on kiosk mount");
    report.checks.push({ label: `${label}-clock-tabs-composer-layer-and-reopen`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function scrollGesture(page, pane, horizontal = false, direction = 1, distance = 850) {
  const box = await pane.boundingBox();
  assert.ok(box, "The intended scrolling pane exists");
  const x = Math.max(15, Math.min(page.viewportSize().width - 15, box.x + box.width / 2));
  const visibleTop = Math.max(70, box.y), visibleBottom = Math.min(page.viewportSize().height - 12, box.y + box.height);
  const y = direction > 0 ? visibleBottom - 12 : visibleTop + 12;
  if (page.viewportSize().width < 768 && !horizontal && distance > 80) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      const travel = Math.max(12, Math.min(distance, 280, visibleBottom - visibleTop - 30));
      for (let step = 1; step <= 5; step++) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - direction * travel * step / 5, id: 1 }] });
        await delay(18);
      }
      // A user can hold at the end of a drag to avoid inertial overshoot.
      await delay(100);
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally { await session.detach(); }
  } else {
    await page.mouse.move(x, Math.max(visibleTop + 4, Math.min(visibleBottom - 4, (visibleTop + visibleBottom) / 2)));
    await page.mouse.wheel(horizontal ? direction * distance : 0, horizontal ? 0 : direction * distance);
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function reachByScrolling(page, target, pane, label, horizontal = false) {
  const attempts = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const geometry = await target.evaluate((node) => {
      const box = node.getBoundingClientRect();
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
      const ancestors = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
        if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) ancestors.push({ tag: parent.tagName, className: parent.className, rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, scrollTop: parent.scrollTop, scrollLeft: parent.scrollLeft, scrollHeight: parent.scrollHeight, scrollWidth: parent.scrollWidth, clientHeight: parent.clientHeight, clientWidth: parent.clientWidth, overflowX: style.overflowX, overflowY: style.overflowY });
      }
      return { visible: box.width > 0 && box.height > 0 && box.top >= top - 1 && box.bottom <= bottom + 1 && box.left >= left - 1 && box.right <= right + 1, target: { x: box.x, y: box.y, width: box.width, height: box.height }, clip: { left, top, right, bottom }, xDelta: box.left < left - 1 ? box.left - left : box.right > right + 1 ? box.right - right : 0, yDelta: box.top < top - 1 ? box.top - top : box.bottom > bottom + 1 ? box.bottom - bottom : 0, ancestors };
    });
    attempts.push({ attempt, ...geometry });
    if (geometry.visible) break;
    const useHorizontal = geometry.xDelta !== 0 && (horizontal || geometry.yDelta === 0);
    const delta = useHorizontal ? geometry.xDelta : geometry.yDelta;
    const available = useHorizontal ? geometry.clip.right - geometry.clip.left - geometry.target.width : geometry.clip.bottom - geometry.clip.top - geometry.target.height;
    const distance = Math.max(1, Math.min(useHorizontal ? 2000 : 850, Math.abs(delta) + (available > 4 ? 2 : 0)));
    await scrollGesture(page, pane, useHorizontal, delta < 0 ? -1 : 1, distance);
    if (attempt === 1 && !useHorizontal && delta > 0 && await pane.getAttribute('tabindex') !== null) {
      await pane.focus();
      await page.keyboard.press('End');
    }
  }
  const final = await target.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const ancestors = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) ancestors.push({ className: parent.className, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, scrollTop: parent.scrollTop, scrollLeft: parent.scrollLeft, scrollHeight: parent.scrollHeight, scrollWidth: parent.scrollWidth, clientHeight: parent.clientHeight, clientWidth: parent.clientWidth });
    }
    return { target: { x: box.x, y: box.y, width: box.width, height: box.height }, ancestors };
  });
  await writeFile(join(output, `${label}-scroll-geometry.json`), JSON.stringify({ attempts, final }, null, 2));
  await fullyVisibleControl(target, label);
}

async function largeBoardStress(width, height, theme) {
  const { page, context } = await setup(width, height, theme);
  const label = `stress-${width}x${height}-${theme}`;
  try {
    await go(page, "/drafts/stress", { theme, stress: "large" });
    await expect(page.locator('.da-room')).toContainText("200");
    await fit(page, `${label}-large-board`);
    await interactiveAudit(page, `${label}-board-commands`);
    await visibleAssets(page, `${label}-initial-artwork`);
    if (width === 1440) {
      await page.setViewportSize({ width: 390, height: 844 });
      await settle(page);
      const current = page.getByRole('tab', { name: 'View round 7, current round', exact: true });
      await expect(current).toHaveAttribute('aria-selected', 'true');
      await fullyVisibleControl(current, 'rotation-desktop-to-phone-current-round-visible');
      await current.focus(); await page.keyboard.press('End');
      const lastRound = page.getByRole('tab', { name: 'View round 10', exact: true });
      await expect(lastRound).toHaveAttribute('aria-selected', 'true');
      await fullyVisibleControl(lastRound, 'rotation-phone-keyboard-end-round-visible');
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.getByRole('region', { name: 'Full draft board', exact: true })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await settle(page);
      await expect(lastRound).toHaveAttribute('aria-selected', 'true');
      await fullyVisibleControl(lastRound, 'rotation-landscape-to-phone-retains-chosen-round');
      await shot(page, 'rotation-round-ten-retained');
      await page.setViewportSize({ width, height }); await settle(page);
      report.checks.push({ label: 'desktop-phone-landscape-phone-round-selection-and-keyboard', ok: true });
    }
    await shot(page, `${label}-large-board`);
    const pane = page.locator('.da-room-panel');
    if (width < 768) {
      const round = page.getByRole('tab', { name: 'View round 10', exact: true });
      await round.click();
      await expect(round).toHaveAttribute('aria-selected', 'true');
      await reachByScrolling(page, page.locator('[data-round="10"] .dl-cell').last(), pane, `${label}-last-round-last-player`);
    } else {
      const board = page.getByRole('region', { name: 'Full draft board', exact: true });
      await reachByScrolling(page, board.locator('.dl-board-cell').last(), board, `${label}-last-round-last-player`, true);
    }
    const pick = page.getByRole('button', { name: 'Make selection', exact: true });
    await fullyVisibleControl(pick, `${label}-pick-still-reachable`);
    await pick.click();
    await expect(page.locator('.da-pick-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await tab(page, 'Pick log');
    const lastArt = page.getByRole('button', { name: /^Choose artwork for 120·/ });
    await reachByScrolling(page, lastArt, pane, `${label}-last-pick-log-artwork`);
    await interactiveAudit(page, `${label}-scrolled-log-controls`);
    await fit(page, `${label}-scrolled-log`);
    await shot(page, `${label}-last-log-pick`);
    assert.equal(await page.evaluate(() => window.daQa.operations.filter((row) => row.table === 'draft_picks' && row.mode === 'insert').length), 0);
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function artworkStress(width = 390, height = 844, theme = 'light') {
  const { page, context } = await setup(width, height, theme);
  const label = `stress-artwork-${width}x${height}-${theme}`;
  try {
    await go(page, '/drafts/active', { theme, art: 'varied' });
    await tab(page, 'Pick log');
    await page.getByRole('button', { name: 'Choose artwork for Arrival', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Arrival', exact: true });
    await expect(picker).toBeVisible();
    const preview = picker.locator('.da-image-preview');
    await expect(preview.locator('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
    await settle(page);
    const geometry = await preview.boundingBox();
    const measurements = [];
    for (const candidate of [2, 3, 4]) {
      await picker.getByRole('button', { name: new RegExp(`^Catalog alternative ${candidate},`) }).click();
      if (candidate === 4) {
        await expect(preview.locator('[data-art-state]')).toHaveAttribute('data-art-state', 'loading');
        await expect(picker.getByRole('button', { name: 'Use selected artwork', exact: true })).toBeDisabled();
      }
      await expect(preview.locator('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
      const after = await preview.boundingBox();
      measurements.push({ candidate, baseline: geometry, after });
      await writeFile(join(output, `${label}-geometry.json`), JSON.stringify(measurements, null, 2));
      for (const key of ['width','height']) assert.ok(Math.abs(after[key] - geometry[key]) <= 0.5, `Artwork ${candidate} reserves its preview ${key}: ${JSON.stringify({ baseline: geometry, after })}`);
      await visibleAssets(page, `${label}-candidate-${candidate}`, '.da-image-dialog');
    }
    await picker.getByRole('button', { name: 'Next artwork page', exact: true }).click();
    const last = picker.getByRole('button', { name: /^Catalog alternative 9,/ });
    await expect(last).toBeVisible(); await last.click();
    await expect(preview.locator('[data-art-state]')).toHaveAttribute('data-art-state', 'ready');
    await fit(page, `${label}-last-page`, '[role=dialog]');
    await fullyVisibleControl(picker.getByRole('button', { name: 'Use selected artwork', exact: true }), `${label}-confirm-always-visible`);
    await fullyVisibleControl(picker.getByRole('button', { name: 'Previous artwork page', exact: true }), `${label}-pager-always-visible`);
    await interactiveAudit(page, `${label}-last-page-controls`, '.da-image-dialog');
    await shot(page, label);
    await picker.getByRole('button', { name: 'Use selected artwork', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const saved = await page.evaluate(() => window.daQa.tables.item_enrichments.find((row) => row.item_id === 'active-pick-1'));
    assert.ok(saved.image_url.endsWith('candidate=9'));
    const missing = page.getByRole('button', { name: 'Choose artwork for The Matrix', exact: true });
    await missing.scrollIntoViewIfNeeded();
    await expect(missing.getByRole('img', { name: 'Artwork unavailable for The Matrix', exact: true })).toBeVisible();
    report.checks.push({ label: `${label}-slow-reserved-paging-and-missing`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function palettesAndAccessibility() {
  const { page, context } = await setup(390, 844);
  const label = 'stress-palettes-theme-text-short';
  try {
    await go(page, '/drafts');
    const menu = await drawer(page);
    await menu.getByRole('tab', { name: 'Display', exact: true }).click();
    for (const [name, id] of [['Heritage Bronze','heritage'],['Broadcast Blue','broadcast'],['Club Emerald','club'],['Signal Red','signal']]) {
      const radio = menu.getByRole('radio', { name, exact: true });
      await radio.click(); await expect(radio).toHaveAttribute('aria-checked','true');
      await expect(page.locator('.da-shell')).toHaveAttribute('data-da-palette', id);
      await interactiveAudit(page, `palette-${id}-drawer`, '.da-arena-drawer');
    }
    await menu.getByRole('button', { name: 'Toggle theme', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await fit(page, 'palette-signal-light', '[role=dialog]');
    await menu.getByRole('button', { name: 'Toggle theme', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await fit(page, 'root-text-scale-200-lobby');
    await interactiveAudit(page, 'root-text-scale-200-lobby-controls');
    const setupCard = page.locator('.da-room-card[data-room-status="setup"]').first();
    await reachByScrolling(page, setupCard, page.locator('.da-lobby-scroll:visible').first(), 'root-text-scale-200-setup-card-reachable');
    await interactiveAudit(page, 'root-text-scale-200-scrolled-list-card-centers');
    await shot(page, 'root-text-scale-200-lobby');
    await go(page, '/drafts/create');
    await page.setViewportSize({ width: 390, height: 320 });
    await page.getByPlaceholder('e.g. Best Fast Food Items').focus();
    await page.getByPlaceholder('e.g. Best Fast Food Items').scrollIntoViewIfNeeded();
    await fullyVisibleControl(page.getByPlaceholder('e.g. Best Fast Food Items'), 'keyboard-short-topic-reachable');
    await fit(page, 'keyboard-short-create');
    await shot(page, 'keyboard-short-create');
    report.checks.push({ label, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function secondaryJourney(width, height, theme) {
  const { page, context } = await setup(width, height, theme);
  const label = `secondary-${width}x${height}-${theme}`;
  try {
    await go(page, '/drafts/seasons', { theme, stress: 'secondary' });
    await expect(page.locator('main')).toContainText('Season 3');
    await fit(page, `${label}-archive`); await interactiveAudit(page, `${label}-archive-controls`);
    await page.locator('a[href="/drafts/seasons/season-3"]').click();
    await expect(page.locator('main')).toContainText('Season 3');
    await expect(page.locator('.da-season-recap')).toBeVisible();
    await fit(page, `${label}-season-recap`); await visibleAssets(page, `${label}-podium-fallback`);
    await shot(page, `${label}-recap`);
    const archived = page.locator('a[href="/drafts/archived"]').first();
    await reachByScrolling(page, archived, page.locator('.da-arena-main'), `${label}-archived-draft-link`);
    await archived.click();
    await expect(page.locator('.da-room')).toContainText('The champions’ collection');
    const menu = await drawer(page);
    await menu.getByRole('link', { name: 'Magazine', exact: true }).click();
    await expect(page.locator('.da-magazine')).toBeVisible();
    await fit(page, `${label}-magazine`); await visibleAssets(page, `${label}-magazine-art`);
    await reachByScrolling(page, page.locator('.da-magazine-timeline article').last(), page.locator('.da-arena-main'), `${label}-last-timeline-entry`);
    await interactiveAudit(page, `${label}-magazine-bottom-controls`);
    await shot(page, `${label}-magazine-last-entry`);
    await go(page, '/drafts?tab=stats', { theme, stress: 'secondary' });
    await expect(page.locator('.da-career-stats')).toBeVisible();
    await fit(page, `${label}-career`); await interactiveAudit(page, `${label}-career-controls`);
    const ids = await page.locator('[data-testid="draft-career-pulse"] [id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, ids.length, 'Chart paint-server IDs are unique');
    await shot(page, `${label}-career`);
    assert.equal(await page.evaluate(() => window.daQa.calls.some((call) => call.function === 'rate-draft')), false, 'Secondary views use saved results');
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function projectorSmoke(width, height) {
  const { page, context } = await setup(width, height, 'dark');
  const label = `projector-${width}x${height}`;
  try {
    await go(page, '/drafts/active/kiosk', { stress: 'projector' });
    await expect(page.locator('.da-kiosk-title')).toHaveText('Greatest movie night');
    await expect(page.locator('.da-kiosk-bar')).toContainText('DH5ZX');
    await fit(page, `${label}-live`, '.da-kiosk', { allowDocumentScroll: true });
    await interactiveAudit(page, `${label}-header-controls`, '.da-kiosk');
    await visibleAssets(page, `${label}-live-assets`, '.da-kiosk');
    assert.equal(await page.locator('.da-kiosk-reveal').count(), 0, 'A projector establishes a quiet baseline from saved picks');
    await shot(page, `${label}-live`);
    await go(page, '/drafts/complete/kiosk', { stress: 'projector' });
    await expect(page.getByRole('region', { name: 'Final draft report', exact: true })).toBeVisible();
    await expect(page.locator('.da-kiosk-report')).toContainText('All-time movie icons');
    await fit(page, `${label}-saved-report`, '.da-kiosk', { allowDocumentScroll: true });
    await interactiveAudit(page, `${label}-report-controls`, '.da-kiosk');
    await shot(page, `${label}-saved-report`);
    assert.equal(await page.evaluate(() => window.daQa.calls.some((call) => call.function === 'rate-draft')), false, 'The projector reads persisted results instead of generating scores');
    assert.equal(await page.evaluate(() => window.daQa.operations.length), 0, 'Projector smoke checks make no source writes');
    report.checks.push({ label: `${label}-actual-standalone-live-and-complete`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function recoveryStates() {
  const { page, context } = await setup(320, 568);
  const label = 'loading-empty-search-missing-route-isolation';
  try {
    await go(page, '/drafts', { stress: 'empty' });
    await expect(page.locator('main')).toContainText('No drafts yet');
    await fit(page, 'empty-lobby'); await interactiveAudit(page, 'empty-lobby-actions');
    await shot(page, 'empty-lobby');
    await go(page, '/drafts');
    const search = page.getByRole('textbox', { name: 'Search drafts', exact: true });
    await search.fill('No matching rooms 🚀');
    await expect(page.locator('main')).toContainText('No rooms match.');
    await fit(page, 'empty-search-results'); await shot(page, 'empty-search-results');
    await search.fill('');
    await expect(page.locator('.da-room-card[href="/drafts/active"]')).toBeVisible();
    await go(page, '/drafts/active', { stress: 'delayed-room' });
    await expect(page.locator('.da-arena-loading')).toBeVisible();
    await fit(page, 'room-loading'); await shot(page, 'room-loading');
    // Route changes are fixture navigation; the held transport response remains real asynchronous I/O.
    await page.evaluate(() => window.daNavigate('/drafts/missing'));
    const back = page.getByRole('link', { name: 'Back to rooms', exact: true });
    await expect(back).toBeVisible();
    await page.evaluate(() => window.daQa.releaseActiveReads());
    await settle(page);
    await expect(back).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Greatest movie night');
    await expect(page.locator('.da-pick-dialog')).toHaveCount(0);
    await fit(page, 'missing-room-late-response'); await shot(page, 'missing-room');
    await back.click();
    await page.locator('.da-room-card[href="/drafts/active"]').click();
    await expect(page.getByRole('button', { name: 'Make selection', exact: true })).toBeVisible();
    const turn = page.locator('.da-turn-copy > p').first();
    await expect(turn).toHaveText('Your turn');
    assert.equal(await turn.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true, 'The concise turn label fits 320px without ellipsis');
    await fullyVisibleControl(turn, 'small-phone-turn-label');
    await page.getByRole('button', { name: 'Make selection', exact: true }).click();
    await page.getByRole('textbox', { name: 'Your draft pick', exact: true }).fill('Keep this only in draft A');
    await page.evaluate(() => window.daNavigate('/drafts/missing'));
    await expect(back).toBeVisible();
    await expect(page.locator('.da-pick-dialog')).toHaveCount(0);
    await back.click();
    await page.locator('.da-room-card[href="/drafts/active"]').click();
    await expect(page.getByRole('button', { name: 'Make selection', exact: true })).toBeVisible();
    await expect(page.locator('.da-pick-dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Make selection', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Your draft pick', exact: true })).toHaveValue('');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.daQa.operations.filter((operation) => operation.table === 'draft_picks').length), 0, 'Draft navigation discards a composer without submitting a pick');
    report.checks.push({ label, ok: true }); console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function hostSettingsDialog() {
  const { page, context } = await setup(390, 844);
  const label = 'actual-live-host-settings-focus-and-cancel';
  try {
    await go(page, '/drafts/active', { stress: 'live-host', role: 'commissioner' });
    await expect(page.getByRole('button', { name: 'Enter live draft', exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Draft Arena player screen', exact: true })).toHaveCount(0);
    await tab(page, 'Host controls');
    const original = await page.evaluate(() => structuredClone(window.daQa.tables.drafts.find((draft) => draft.id === 'active').live_settings));
    const trigger = page.getByRole('button', { name: 'Live draft settings', exact: true });
    await trigger.click();
    const settings = page.getByRole('dialog', { name: 'Room Settings', exact: true });
    await expect(settings).toBeVisible(); await settle(page);
    await fit(page, 'host-settings-dialog', '.da-live-settings-dialog');
    const controls = settings.locator('button:not([disabled]),input:not([disabled])');
    await controls.last().focus(); await page.keyboard.press('Tab');
    assert.equal(await settings.evaluate((node) => node.contains(document.activeElement)), true, 'Tab wraps inside settings');
    await controls.first().focus(); await page.keyboard.press('Shift+Tab');
    assert.equal(await settings.evaluate((node) => node.contains(document.activeElement)), true, 'Shift+Tab wraps inside settings');
    await settings.getByRole('button', { name: '2m', exact: true }).click();
    const callsBeforeRefresh = await page.evaluate(() => window.daQa.calls.filter((call) => call.table === 'drafts' && call.mode === 'select').length);
    await page.evaluate(() => window.daQa.refreshRow('drafts', 'active'));
    await expect.poll(() => page.evaluate(() => window.daQa.calls.filter((call) => call.table === 'drafts' && call.mode === 'select').length)).toBeGreaterThan(callsBeforeRefresh);
    await settle(page);
    await expect(settings.getByRole('button', { name: '2m', exact: true })).toHaveAttribute('aria-pressed', 'true');
    assert.deepEqual(await page.evaluate(() => window.daQa.tables.drafts.find((draft) => draft.id === 'active').live_settings), original, 'A realtime refresh does not persist unsaved settings');
    report.checks.push({ label: 'live-settings-unsaved-choice-survives-realtime-refresh', ok: true });
    await settings.getByRole('button', { name: '3m', exact: true }).click();
    await shot(page, 'host-settings-dialog');
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0); await expect(trigger).toBeFocused();
    assert.deepEqual(await page.evaluate(() => window.daQa.tables.drafts.find((draft) => draft.id === 'active').live_settings), original, 'Cancel leaves persisted live settings unchanged');
    report.checks.push({ label, ok: true }); console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

const livePresentationLabels = ['Announce each pick on the big screen', 'Ticker tape of recent picks', 'Projector sound effects', 'Pre-draft order ceremony', 'Broadcast moments and milestones'];
async function prepareLiveEvent(page, label) {
  const topic = page.getByRole('textbox', { name: 'Topic', exact: true });
  await expect(topic).toBeVisible();
  await fullyVisibleControl(topic, `${label}-topic-visible`);
  await topic.fill('Friday night cinema');
  const description = page.getByRole('textbox', { name: 'Description (optional)', exact: true });
  await description.scrollIntoViewIfNeeded();
  await description.fill('A live cinema draft for the club.');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const stage = page.locator('.da-create-stage');
  await next.click(); await expect(stage).toHaveAttribute('aria-label', 'Rules setup');
  await expect(page.getByRole('group', { name: 'Rounds', exact: true }).getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Rounds', exact: true }).getByRole('button', { name: '3', exact: true }).click();
  const context = page.getByRole('textbox', { name: 'AI Judging Context', exact: true });
  await context.scrollIntoViewIfNeeded(); await context.fill('Evaluate films from every country and decade.');
  await fit(page, `${label}-rules`);
  await next.click(); await expect(stage).toHaveAttribute('aria-label', 'Stage setup');
  const clock = page.getByRole('tab', { name: 'Clock', exact: true });
  const presentation = page.getByRole('tab', { name: 'Presentation', exact: true });
  await expect(clock).toHaveAttribute('aria-selected', 'true');
  await expect(stage.getByRole('button', { name: '90s', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await stage.getByRole('button', { name: '2m', exact: true }).click();
  await expect(stage.getByRole('button', { name: 'Alert only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await fit(page, `${label}-clock`); await interactiveAudit(page, `${label}-clock-controls`);
  await shot(page, `${label}-clock`);
  await presentation.click();
  for (const name of livePresentationLabels) {
    const toggle = stage.getByRole('button', { name, exact: true });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.scrollIntoViewIfNeeded();
    await fullyVisibleControl(toggle, `${label}-${name.toLowerCase().replaceAll(' ', '-')}`);
  }
  await fit(page, `${label}-presentation`); await shot(page, `${label}-presentation`);
  await next.click(); await expect(stage).toHaveAttribute('aria-label', 'Review setup');
  await expect(stage).toContainText('Friday night cinema');
  await expect(stage).toContainText('3 picks each');
  await expect(page.getByRole('button', { name: 'Create live event', exact: true })).toBeEnabled();
  await fit(page, `${label}-review`); await shot(page, `${label}-review`);
  assert.equal(await page.evaluate(() => window.daQa.operations.filter((operation) => operation.table === 'drafts' && operation.mode === 'insert').length), 0, 'LIVE wizard review does not create or start an event');
}

async function liveCreationLayout(width, height, theme) {
  const { page, context } = await setup(width, height, theme, 'reduce');
  const label = `live-create-${width}x${height}-${theme}`;
  try {
    await go(page, '/drafts/live/waiting', { stress: 'live-flow', theme });
    await expect(page.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/waiting');
    await expect(page.locator('.da-live-arena')).toHaveCount(0);
    report.checks.push({ label: `${label}-normal-room-uses-normal-route`, ok: true });
    await go(page, '/drafts/live/create', { stress: 'live-flow', theme });
    await prepareLiveEvent(page, label);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Presentation', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Clock', exact: true }).click();
    await expect(page.getByRole('button', { name: '2m', exact: true })).toHaveAttribute('aria-pressed', 'true');
    report.checks.push({ label: `${label}-back-retains-live-settings`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function liveEventLifecycle() {
  const { page: host, context } = await setup(390, 844);
  const label = 'live-event-two-player-lifecycle';
  const shared = `live-${Date.now()}`;
  let player;
  try {
    await go(host, '/drafts/live', { stress: 'live-flow', role: 'commissioner', shared });
    await expect(host.getByRole('link', { name: 'Host live event', exact: true })).toBeVisible();
    await fit(host, 'live-hub-empty'); await shot(host, 'live-hub-entrance'); await interactiveAudit(host, 'live-hub-empty-controls');
    await host.getByRole('link', { name: 'Host live event', exact: true }).click();
    await expect(host.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/live/create');
    await prepareLiveEvent(host, label);
    await host.getByRole('button', { name: 'Create live event', exact: true }).click();
    await expect(host.locator('.da-greenroom')).toBeVisible();
    const created = await host.evaluate(() => {
      const writes = window.daQa.operations.filter((operation) => operation.table === 'drafts' && operation.mode === 'insert');
      const draft = writes[0]?.rows[0];
      return { draft, writes, participants: window.daQa.tables.draft_participants.filter((row) => row.draft_id === draft?.id), seasons: window.daQa.tables.draft_season_entries.filter((row) => row.draft_id === draft?.id) };
    });
    assert.equal(created.writes.length, 1); assert.equal(created.draft.status, 'setup'); assert.equal(created.draft.is_live, true);
    assert.equal(created.draft.club_id, 'club'); assert.equal(created.draft.topic, 'Friday night cinema');
    assert.equal(created.draft.num_rounds, 3); assert.equal(created.draft.timer_seconds, 120);
    assert.equal(created.draft.ai_context, 'Evaluate films from every country and decade.');
    assert.deepEqual(created.draft.live_settings, { pickSeconds: 120, timeoutBehavior: 'alert', sound: true, ticker: true, autoStartClock: true, announce: true, ceremony: true, broadcast: true, reportBroadcast: true });
    assert.match(created.draft.kiosk_code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    assert.deepEqual(created.participants.map(({ user_id, pick_order }) => ({ user_id, pick_order })), [{ user_id: 'u1', pick_order: 1 }]);
    assert.equal(created.seasons.length, 0, 'LIVE events do not enter a season ledger');
    const id = created.draft.id;
    await expect(host.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', `/drafts/live/${id}`);
    const start = host.getByRole('button', { name: 'Start order reveal', exact: true });
    await expect(start).toBeDisabled();
    await expect(host.getByRole('region', { name: 'Players in the room', exact: true })).toContainText('Alex');
    await fit(host, 'live-greenroom-host-alone'); await shot(host, 'live-greenroom-host-alone');
    const greenBody = host.locator('.da-greenroom-body');
    for (const [name, path] of [['Copy player invite', `/drafts/live/${id}`], ['Copy projector link', `/drafts/${id}/kiosk`]]) {
      const button = host.getByRole('button', { name, exact: true });
      await reachByScrolling(host, button, greenBody, `live-${name.toLowerCase().replaceAll(' ', '-')}-reachable`);
      await button.click();
      assert.equal(new URL(await host.evaluate(() => window.daClipboard)).pathname, path);
    }
    await expect(host.getByRole('link', { name: 'Open projector', exact: true })).toHaveAttribute('href', `/drafts/${id}/kiosk`);
    await host.getByRole('button', { name: 'Configure live draft', exact: true }).click();
    const settings = host.getByRole('dialog', { name: 'Room Settings', exact: true });
    await expect(settings).toBeVisible();
    await settings.getByRole('button', { name: '3m', exact: true }).click();
    const ceremonyToggle = settings.getByRole('switch', { name: 'Dramatic pick-order reveal on projector', exact: true });
    await expect(ceremonyToggle).toHaveAttribute('aria-checked', 'true');
    await ceremonyToggle.scrollIntoViewIfNeeded(); await ceremonyToggle.click();
    await settings.getByRole('button', { name: 'Save Settings', exact: true }).click();
    await expect(settings).toHaveCount(0);
    await expect.poll(() => host.evaluate((draftId) => window.daQa.tables.drafts.find((row) => row.id === draftId).live_settings.pickSeconds, id)).toBe(180);
    assert.equal(await host.evaluate((draftId) => window.daQa.tables.drafts.find((row) => row.id === draftId).status, id), 'setup');
    await expect.poll(() => host.evaluate((draftId) => {
      const draft = window.daQa.tables.drafts.find((row) => row.id === draftId);
      return [draft.live_settings.ceremony, draft.ceremony_enabled];
    }, id)).toEqual([false, false]);
    await expect(host.getByRole('button', { name: 'Begin live draft', exact: true })).toBeDisabled();
    await host.getByRole('button', { name: 'Configure live draft', exact: true }).click();
    await expect(ceremonyToggle).toHaveAttribute('aria-checked', 'false');
    await ceremonyToggle.scrollIntoViewIfNeeded(); await ceremonyToggle.click();
    await settings.getByRole('button', { name: 'Save Settings', exact: true }).click();
    await expect(settings).toHaveCount(0);
    await expect.poll(() => host.evaluate((draftId) => {
      const draft = window.daQa.tables.drafts.find((row) => row.id === draftId);
      return [draft.live_settings.ceremony, draft.ceremony_enabled];
    }, id)).toEqual([true, true]);
    await expect(start).toBeDisabled();
    report.checks.push({ label: 'live-lobby-ceremony-toggle-saves-both-fields-and-start-label', ok: true });
    await host.evaluate(() => window.daQa.setConnection('CHANNEL_ERROR'));
    await expect(host.locator('.da-greenroom-connection')).toHaveAttribute('data-connection', 'error');
    await host.evaluate(() => window.daQa.setConnection('SUBSCRIBED'));
    await expect(host.locator('.da-greenroom-connection')).toHaveAttribute('data-connection', 'connected');
    report.checks.push({ label: 'live-create-payload-invites-settings-and-actual-connection', ok: true });

    player = await context.newPage(); await player.setViewportSize({ width: 320, height: 568 }); await installFixturePage(player);
    await go(player, '/drafts/live', { stress: 'live-flow', shared, user: 'u2' });
    const code = player.getByRole('textbox', { name: 'Room code', exact: true });
    await code.fill(created.draft.kiosk_code.toLowerCase());
    await player.getByRole('button', { name: 'Find live room', exact: true }).click();
    await expect(player.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', `/drafts/live/${id}`);
    await expect(player.locator('.da-greenroom')).toBeVisible();
    assert.equal(await player.evaluate((draftId) => window.daQa.tables.draft_participants.filter((row) => row.draft_id === draftId).length, id), 1, 'Resolving a code does not join a player');
    await expect(player.getByRole('button', { name: 'Configure live draft', exact: true })).toHaveCount(0);
    await expect(player.getByRole('button', { name: 'Start order reveal', exact: true })).toHaveCount(0);
    const join = player.getByRole('button', { name: 'Join Draft', exact: true });
    await fullyVisibleControl(join, 'live-small-phone-join-visible');
    await fit(player, 'live-greenroom-player-before-join'); await shot(player, 'live-greenroom-player-before-join');
    await join.click();
    await expect(host.getByRole('region', { name: 'Players in the room', exact: true })).toContainText('Blair');
    await expect(start).toBeEnabled(); await fullyVisibleControl(start, 'live-host-start-visible');
    await start.click();
    await expect(host.getByRole('region', { name: 'Draft order ceremony', exact: true })).toBeVisible();
    await expect(player.getByRole('region', { name: 'Draft order ceremony', exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Reveal pick 1', exact: true })).toHaveCount(0);
    await host.getByRole('button', { name: 'Reveal pick 1', exact: true }).click();
    await host.getByRole('button', { name: 'Reveal pick 2', exact: true }).click();
    assert.equal(await host.evaluate((draftId) => window.daQa.tables.draft_picks.filter((row) => row.draft_id === draftId).length, id), 0, 'Order reveal never submits a selection');
    await shot(host, 'live-order-ceremony');
    await host.getByRole('button', { name: 'Begin Draft', exact: true }).click();
    for (const page of [host, player]) {
      await expect(page.getByRole('button', { name: 'Enter live draft', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Draft Arena player screen', exact: true })).toHaveCount(0);
    }
    const started = await host.evaluate((draftId) => ({ draft: window.daQa.tables.drafts.find((row) => row.id === draftId), participants: window.daQa.tables.draft_participants.filter((row) => row.draft_id === draftId).sort((a, b) => a.pick_order - b.pick_order) }), id);
    assert.equal(started.draft.status, 'in_progress'); assert.equal(started.draft.current_pick_number, 1); assert.equal(started.draft.current_round, 1);
    assert.equal(started.draft.current_pick_user_id, started.participants[0].user_id);
    assert.ok(started.draft.clock_started_at && started.draft.pick_deadline_at);
    assert.equal(Math.round((Date.parse(started.draft.pick_deadline_at) - Date.parse(started.draft.clock_started_at)) / 1000), 180);
    for (const [page, role] of [[host, 'host'], [player, 'player']]) {
      await page.getByRole('button', { name: 'Enter live draft', exact: true }).click();
      const screen = page.getByRole('dialog', { name: 'Draft Arena player screen', exact: true });
      await expect(screen).toBeVisible();
      await expect(screen.getByRole('button', { name: 'Player sound', exact: true })).toHaveAttribute('aria-pressed', 'false');
      if (role === 'host') await expect(screen.getByRole('tab', { name: 'Host', exact: true })).toHaveAttribute('aria-selected', 'true');
      else { await expect(screen.getByRole('tab', { name: 'Board', exact: true })).toHaveAttribute('aria-selected', 'true'); await expect(screen.getByRole('tab', { name: 'Host', exact: true })).toHaveCount(0); }
      assert.equal(await page.evaluate(() => document.fullscreenElement === null), true, 'Player entry alone does not request native fullscreen');
      await fit(page, `live-${role}-explicit-player-screen`, '.da-pk'); await shot(page, `live-${role}-explicit-player-screen`);
    }
    const picker = started.draft.current_pick_user_id === 'u1' ? host : player;
    const observer = picker === host ? player : host;
    const hostScreen = host.getByRole('dialog', { name: 'Draft Arena player screen', exact: true });
    const hostPanel = hostScreen.locator('.da-live-host-panel');
    const beforeCancel = await host.evaluate((draftId) => ({ draft: structuredClone(window.daQa.tables.drafts.find((row) => row.id === draftId)), operations: window.daQa.operations.length }), id);
    await hostPanel.getByRole('button', { name: 'Pass this pick', exact: true }).click();
    await expect(hostPanel.getByRole('button', { name: /^Confirm — pass / })).toBeVisible();
    await hostPanel.getByRole('button', { name: 'Cancel pass', exact: true }).click();
    await expect(hostPanel.getByRole('button', { name: 'Pass this pick', exact: true })).toBeVisible();
    assert.deepEqual(await host.evaluate((draftId) => ({ draft: structuredClone(window.daQa.tables.drafts.find((row) => row.id === draftId)), operations: window.daQa.operations.length }), id), beforeCancel, 'Cancelling a host pass changes no persisted row, deadline or turn');
    await hostPanel.getByRole('button', { name: 'Pass this pick', exact: true }).click();
    await expect(hostPanel.getByRole('button', { name: /^Confirm — pass / })).toBeVisible();
    await picker.getByRole('dialog', { name: 'Draft Arena player screen', exact: true }).getByRole('button', { name: 'Make my pick', exact: true }).click();
    const composer = picker.locator('.da-pick-dialog[role="dialog"]');
    await expect(composer).toContainText('Round 1 · Pick #1');
    const input = composer.getByRole('textbox', { name: 'Your draft pick', exact: true });
    await expect(input).toBeFocused(); await input.fill('Interstellar'); await input.press('Enter');
    await expect(composer).toHaveCount(0);
    await expect.poll(() => observer.evaluate((draftId) => window.daQa.tables.draft_picks.filter((row) => row.draft_id === draftId).length, id)).toBe(1);
    await expect.poll(() => host.evaluate((draftId) => window.daQa.tables.drafts.find((row) => row.id === draftId).current_pick_number, id)).toBe(2);
    const state = await host.evaluate((draftId) => ({ draft: window.daQa.tables.drafts.find((row) => row.id === draftId), picks: window.daQa.tables.draft_picks.filter((row) => row.draft_id === draftId) }), id);
    assert.deepEqual(state.picks.map(({ pick_text, user_id, round, pick_number }) => ({ pick_text, user_id, round, pick_number })), [{ pick_text: 'Interstellar', user_id: started.participants[0].user_id, round: 1, pick_number: 1 }]);
    assert.equal(state.draft.current_pick_number, 2); assert.equal(state.draft.current_pick_user_id, started.participants[1].user_id);
    await expect(hostPanel.getByRole('button', { name: /^Confirm — pass / })).toHaveCount(0);
    await expect(hostPanel.getByRole('button', { name: 'Pass this pick', exact: true })).toBeVisible();
    assert.equal(await host.evaluate((draftId) => window.daQa.tables.draft_skips.filter((row) => row.draft_id === draftId).length, id), 0, 'A pending old-turn pass cannot follow a real selection into the next turn');
    report.checks.push({ label: 'live-host-pass-cancel-and-confirmation-reset-on-real-pick', ok: true });
    const writes = await Promise.all([host, player].map((page) => page.evaluate((draftId) => window.daQa.operations.filter((operation) => operation.table === 'draft_picks' && operation.mode === 'insert' && operation.rows.some((row) => row.draft_id === draftId)).length, id)));
    assert.equal(writes.reduce((sum, count) => sum + count, 0), 1, 'Both actors observe one canonical pick without a duplicate write');
    const observerScreen = observer.getByRole('dialog', { name: 'Draft Arena player screen', exact: true });
    await observerScreen.getByRole('tab', { name: 'Live feed', exact: true }).click();
    await expect(observerScreen.getByRole('tabpanel')).toContainText('Interstellar');
    await shot(observer, 'live-other-player-receives-first-pick');
    report.checks.push({ label: 'live-code-explicit-join-two-actor-ceremony-and-canonical-pick', ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(host, `${label}-host`); if (player) await captureFailure(player, `${label}-player`); throw error; }
  finally { await context.close(); }
}

async function liveHubRecoveryAndFinale(width, height, theme) {
  const { page, context } = await setup(width, height, theme, 'reduce');
  const label = `live-hub-recovery-finale-${width}x${height}-${theme}`;
  try {
    await go(page, '/drafts/live', { stress: 'projector', theme });
    const roomCode = page.getByRole('textbox', { name: 'Room code', exact: true });
    await roomCode.fill('DH5ZX');
    assert.equal(await roomCode.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true, 'All five room-code characters fit without horizontal input scrolling');
    report.checks.push({ label: `${label}-five-character-code-readable`, ok: true });
    await roomCode.fill('');
    const active = page.getByRole('link', { name: 'Open live room: Greatest movie night', exact: true });
    const final = page.getByRole('link', { name: 'View final: All-time movie icons', exact: true });
    await expect(active).toBeVisible(); await expect(final).toBeVisible();
    await tab(page, 'Live now');
    await expect(active).toBeVisible(); await expect(final).toHaveCount(0);
    await page.evaluate(() => window.daQa.failNextRead('drafts'));
    await page.getByRole('button', { name: 'Refresh live rooms', exact: true }).click();
    await expect(page.locator('.da-live-room-sync')).toContainText('Update paused');
    await expect(active).toBeVisible();
    await expect(active).toHaveAttribute('href', '/drafts/live/active');
    await expect(page.getByRole('tab', { name: /^Live now(?:\s*\d+)?$/ })).toHaveAttribute('aria-selected', 'true');
    await fit(page, `${label}-retained-error`); await interactiveAudit(page, `${label}-error-controls`);
    await shot(page, `${label}-retained-error`);
    await page.getByRole('button', { name: 'Retry room update', exact: true }).click();
    await expect(page.locator('.da-live-room-sync')).toHaveAttribute('data-sync-state', 'ready');
    await expect(page.locator('.da-live-room-sync')).not.toContainText('Update paused');
    await expect(active).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Live now(?:\s*\d+)?$/ })).toHaveAttribute('aria-selected', 'true');
    await active.click();
    await expect(page.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/live/active');
    await expect(page.locator('.da-live-event-entry')).toBeVisible();
    const menu = await drawer(page);
    await menu.locator('a[href="/drafts/live"]').click();
    await expect(menu).toHaveCount(0);
    await expect(page.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/live');
    await tab(page, 'Finished'); await final.click();
    await expect(page.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/live/complete');
    await expect(page.getByRole('region', { name: 'Live event finale', exact: true })).toContainText('The results are in.');
    await expect(page.getByRole('button', { name: 'Enter live draft', exact: true })).toHaveCount(0);
    await tab(page, 'Results'); await fit(page, `${label}-finale`); await shot(page, `${label}-finale`);
    const magazine = page.getByRole('link', { name: 'Open Draft Magazine', exact: true });
    await magazine.scrollIntoViewIfNeeded(); await magazine.click();
    await expect(page.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/complete/magazine?live=1');
    await expect(page.locator('.da-magazine-deck')).toContainText('Live edition');
    await expect(page.locator('.da-magazine-winner')).toContainText('Alex');
    await fit(page, `${label}-magazine`); await shot(page, `${label}-magazine`);
    const back = page.getByRole('link', { name: 'Back to draft', exact: true });
    await back.scrollIntoViewIfNeeded(); await expect(back).toHaveAttribute('href', '/drafts/live/complete'); await back.click();
    await expect(page.locator('[data-qa-route]')).toHaveAttribute('data-qa-route', '/drafts/live/complete');
    await expect(page.getByRole('region', { name: 'Live event finale', exact: true })).toBeVisible();
    assert.equal(await page.evaluate(() => window.daQa.calls.some((call) => call.function === 'rate-draft')), false, 'The LIVE finale and magazine read persisted results without generating a score');
    assert.equal(await page.evaluate(() => window.daQa.operations.filter((operation) => ['draft_picks', 'draft_skips', 'draft_results'].includes(operation.table)).length), 0, 'Ending navigation never writes a pick, pass or judging result');
    report.checks.push({ label: `${label}-retained-refresh-retry-and-live-report-navigation`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function liveTimeoutClosesComposer() {
  const { page: host, context } = await setup(390, 844, 'dark', 'reduce');
  const label = 'live-real-timeout-closes-and-clears-open-composer';
  const shared = `timeout-${Date.now()}`;
  let player;
  try {
    await go(host, '/drafts/live/active', { stress: 'live-actions', shared });
    const hostPanel = host.locator('.da-live-host-panel');
    await expect(hostPanel.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
    player = await context.newPage(); await player.setViewportSize({ width: 320, height: 568 }); await installFixturePage(player);
    await go(player, '/drafts/live/active', { stress: 'live-actions', shared, user: 'u2' });
    await player.getByRole('button', { name: 'Enter live draft', exact: true }).click();
    const screen = player.getByRole('dialog', { name: 'Draft Arena player screen', exact: true });
    await screen.getByRole('button', { name: 'Make my pick', exact: true }).click();
    const composer = player.locator('.da-pick-dialog[role="dialog"]');
    await expect(composer).toContainText('Round 2 · Pick #5');
    await composer.getByRole('textbox', { name: 'Your draft pick', exact: true }).fill('This unfinished selection must be discarded');
    await hostPanel.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect.poll(() => host.evaluate(() => window.daQa.tables.draft_skips.filter((row) => row.draft_id === 'active').length)).toBe(1);
    await expect(composer).toHaveCount(0);
    await expect(screen).toBeVisible();
    const passed = await player.evaluate(() => ({ picks: window.daQa.tables.draft_picks.filter((row) => row.draft_id === 'active'), skips: window.daQa.tables.draft_skips.filter((row) => row.draft_id === 'active'), draft: window.daQa.tables.drafts.find((row) => row.id === 'active') }));
    assert.equal(passed.picks.length, 4, 'A real timeout closes the composer without inserting a new pick row');
    assert.deepEqual(passed.skips.map(({ user_id, pick_number, round }) => ({ user_id, pick_number, round })), [{ user_id: 'u2', pick_number: 5, round: 2 }]);
    await expect.poll(() => host.evaluate(() => window.daQa.tables.drafts.find((row) => row.id === 'active').current_pick_number)).toBe(6);
    await shot(player, 'live-timeout-player-composer-closed');
    for (const [number, title] of [[6, 'Interstellar'], [7, 'Blade Runner 2049']]) {
      const make = host.getByRole('button', { name: 'Make selection', exact: true });
      await expect(make).toBeVisible(); await make.click();
      const sheet = host.locator('.da-pick-dialog[role="dialog"]');
      await expect(sheet).toContainText(`Pick #${number}`);
      const input = sheet.getByRole('textbox', { name: 'Your draft pick', exact: true });
      await input.fill(title); await input.press('Enter');
      await expect(sheet).toHaveCount(0);
      await expect.poll(() => host.evaluate(() => window.daQa.tables.drafts.find((row) => row.id === 'active').current_pick_number)).toBe(number + 1);
    }
    await expect(screen.getByRole('button', { name: 'Make my pick', exact: true })).toBeVisible();
    await screen.getByRole('button', { name: 'Make my pick', exact: true }).click();
    await expect(composer).toContainText('Round 3 · Pick #8');
    await expect(composer.getByRole('textbox', { name: 'Your draft pick', exact: true })).toHaveValue('');
    assert.equal(await player.evaluate(() => window.daQa.operations.filter((operation) => operation.table === 'draft_picks' && operation.mode === 'insert').length), 0, 'The timed-out player never submitted the discarded text');
    await player.keyboard.press('Escape');
    report.checks.push({ label, ok: true }); console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(host, `${label}-host`); if (player) await captureFailure(player, `${label}-player`); throw error; }
  finally { await context.close(); }
}

async function largeCeremony(width, height) {
  const { page, context } = await setup(width, height, width < 640 ? 'dark' : 'light', 'reduce');
  const label = `live-ceremony-20-players-${width}x${height}`;
  try {
    await go(page, '/drafts/live/ceremony', { stress: 'ceremony', theme: width < 640 ? 'dark' : 'light' });
    const stage = page.getByRole('region', { name: 'Draft order ceremony', exact: true });
    const lineup = stage.getByRole('region', { name: 'Draft order lineup', exact: true });
    await expect(stage).toHaveAttribute('data-total-positions', '20');
    await expect(lineup.locator('li[data-ceremony-position]')).toHaveCount(20);
    const progress = stage.getByRole('progressbar', { name: 'Draft positions revealed', exact: true });
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    const reveal = stage.getByRole('button', { name: 'Reveal pick 1', exact: true });
    const skip = stage.getByRole('button', { name: 'Skip ceremony', exact: true });
    for (const [control, name] of [[reveal, 'reveal'], [skip, 'skip']]) {
      await fullyVisibleControl(control, `${label}-${name}-footer-visible`);
      const box = await control.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44, 'Ceremony footer targets remain at least 44px');
    }
    await fit(page, `${label}-initial`); await interactiveAudit(page, `${label}-initial-controls`, '.da-ceremony');
    await shot(page, `${label}-early`);
    for (let position = 1; position <= 20; position++) {
      await stage.getByRole('button', { name: `Reveal pick ${position}`, exact: true }).click();
      await expect(progress).toHaveAttribute('aria-valuenow', String(position));
    }
    await expect(stage.locator('.da-ceremony-current')).toContainText('Player 20');
    for (let position = 1; position <= 20; position++) {
      const row = lineup.locator(`li[data-ceremony-position="${position}"]`);
      await expect(row).toHaveClass(/is-revealed/);
      await reachByScrolling(page, row, lineup, `${label}-lineup-position-${position}-reachable`);
    }
    const begin = stage.getByRole('button', { name: 'Begin Draft', exact: true });
    await fullyVisibleControl(begin, `${label}-begin-footer-visible-after-lineup-scroll`);
    await fullyVisibleControl(stage.locator('.da-ceremony-footer'), `${label}-whole-footer-remains-visible`);
    await fit(page, `${label}-all-revealed`); await interactiveAudit(page, `${label}-final-controls`, '.da-ceremony');
    await shot(page, `${label}-last-lineup`);
    const stored = await page.evaluate(() => ({ draft: window.daQa.tables.drafts.find((row) => row.id === 'ceremony'), picks: window.daQa.tables.draft_picks.filter((row) => row.draft_id === 'ceremony') }));
    assert.equal(stored.draft.status, 'setup'); assert.equal(stored.draft.ceremony_reveal_index, 20); assert.equal(stored.picks.length, 0);
    report.checks.push({ label: `${label}-actual-reveals-bounded-lineup-and-fixed-footer`, ok: true });
    console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

async function projectorCeremony() {
  const { page, context } = await setup(1440, 900);
  const label = 'projector-saved-20-player-ceremony';
  try {
    await go(page, '/drafts/ceremony/kiosk', { stress: 'ceremony' });
    const stage = page.getByRole('region', { name: 'Draft order ceremony', exact: true });
    await expect(stage).toHaveAttribute('data-revealed-count', '12');
    await expect(stage.locator('.da-ceremony-current')).toContainText('Player 12');
    await expect(stage.getByRole('button')).toHaveCount(0);
    await fit(page, label, '.da-kiosk', { allowDocumentScroll: true });
    await shot(page, label);
    assert.equal(await page.evaluate(() => window.daQa.operations.length), 0, 'Projector ceremony stays read-only and does not advance the saved reveal');
    await expect(stage).toHaveAttribute('data-revealed-count', '12');
    report.checks.push({ label: `${label}-persisted-order-read-only`, ok: true }); console.log(`PASS ${label}`);
  } catch (error) { await captureFailure(page, label); throw error; }
  finally { await context.close(); }
}

try {
  await start();
  // Exercise newly added stress cases first; retain the complete core matrix.
  for (const args of [[320,568],[844,390]]) await largeCeremony(...args);
  await projectorCeremony();
  await liveTimeoutClosesComposer();
  for (const args of [[320,568,'dark'],[844,390,'light']]) await liveHubRecoveryAndFinale(...args);
  await liveEventLifecycle();
  for (const args of [[320,568,'dark'],[844,390,'light']]) await liveCreationLayout(...args);
  for (const args of [[320,568],[844,390],[1440,900]]) await projectorSmoke(...args);
  await recoveryStates();
  await hostSettingsDialog();
  for (const args of [[320,568,'dark'],[844,390,'light'],[1440,900,'dark']]) await secondaryJourney(...args);
  for (const args of [[320,568,'dark'],[390,844,'light'],[844,390,'dark'],[1440,900,'light']]) await artworkStress(...args);
  await palettesAndAccessibility();
  for (const args of [[320,568,'dark'],[390,844,'light'],[844,390,'dark'],[1440,900,'dark']]) await largeBoardStress(...args);
  await submitPick();
  await artworkSelection();
  for (const args of [[320,568,"no-preference"],[390,844,"reduce"],[844,390,"no-preference"]]) await liveWorkspace(...args);
  for (const args of [[320,568,"dark","no-preference"],[360,740,"light","no-preference"],[390,844,"light","no-preference"],[390,844,"dark","reduce"],[430,932,"dark","no-preference"],[768,1024,"light","no-preference"],[844,390,"dark","no-preference"],[1440,900,"light","no-preference"],[1920,1080,"dark","no-preference"]]) await viewportJourney(...args);
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
