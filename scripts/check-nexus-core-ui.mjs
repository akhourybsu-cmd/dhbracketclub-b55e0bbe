// Real game pages, hooks, engine, and CSS. An in-memory backend replaces only
// auth/club/Supabase in the fixture. No live accounts or database writes.
import { chromium, expect } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const output = await mkdtemp(join(tmpdir(), "nexus-core-ui-"));
console.log(`Screenshots: ${output}`);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.route("**/src/contexts/AuthContext.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const useAuth=()=>({user:{id:"member"}});',
    }),
  );
  await page.route("**/src/contexts/ClubContext.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export const useClub=()=>({club:{id:"club",name:"Dry My Horse"}});',
    }),
  );
  await page.route("**/src/integrations/supabase/client.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    const initial={credits:180,research:{},campaign:{},challenges:{},best_wave:0,total_runs:0};
    window.nexusQa={tickets:JSON.parse(sessionStorage.getItem('nexus-qa-tickets')||'{}'),logs:JSON.parse(sessionStorage.getItem('nexus-qa-logs')||'[]'),profile:JSON.parse(sessionStorage.getItem('nexus-qa-profile')||'null')||initial,claims:0,failClaims:sessionStorage.getItem('nexus-qa-fail')==='1',claimed:new Map()};
    const persist=()=>{sessionStorage.setItem('nexus-qa-profile',JSON.stringify(window.nexusQa.profile));sessionStorage.setItem('nexus-qa-tickets',JSON.stringify(window.nexusQa.tickets));sessionStorage.setItem('nexus-qa-logs',JSON.stringify(window.nexusQa.logs));};
    export const supabase={rpc:async(name,args)=>{
      if(name==='nexus_core_records')return{data:[],error:null};
      const qa=window.nexusQa; let data=qa.profile;
      if(name==='nexus_core_begin'){data=qa.tickets[args.p_id]||{id:args.p_id,seed:42,research:structuredClone(qa.profile.research)};qa.tickets[args.p_id]=data;}
      if(name==='nexus_core_research'){
        const track=args.p_track,level=qa.profile.research[track]||0,base={weapons:35,reactor:40,plating:30,barrier:30,salvage:35,nova:40}[track],cost=Math.round(base*1.35**level);
        if(qa.profile.credits<cost)return{data:null,error:{message:'Not enough credits'}};
        qa.profile={...qa.profile,credits:qa.profile.credits-cost,research:{...qa.profile.research,[track]:level+1}};data=qa.profile;qa.logs.unshift({id:qa.logs.length+1,kind:'research',delta:-cost,balance:qa.profile.credits,details:{track,level:level+1},created_at:new Date().toISOString()});
      }
      if(name==='nexus_core_finish'){
        qa.claims++;
        if(qa.failClaims)return{data:null,error:{message:'Offline'}};
        const run=args.p_run;
        if(!qa.claimed.has(run.id)){
          const waves=20,bonus=qa.profile.campaign[run.scenarioId]?0:70,reward=waves+bonus,stars=3;
          qa.profile={...qa.profile,credits:qa.profile.credits+reward,total_runs:qa.profile.total_runs+1,campaign:{...qa.profile.campaign,[run.scenarioId]:stars}};
          qa.claimed.set(run.id,{reward,stars,waves,bonus});qa.logs.unshift({id:qa.logs.length+1,kind:'run',delta:reward,balance:qa.profile.credits,details:{scenario:run.scenarioId,first_clear:bonus},created_at:new Date().toISOString()});
        }
        data={profile:qa.profile,...qa.claimed.get(run.id)};
      }
      persist();return{data,error:null};
    },from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:window.nexusQa.logs,error:null})};return q;}};
  `,
    }),
  );
  const go = async (route = "/nexus") =>
    page.goto(
      `http://127.0.0.1:8080/scripts/fixtures/nexus-core.html?route=${encodeURIComponent(route)}`,
      { waitUntil: "networkidle" },
    );
  const noOverflow = async () =>
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "No horizontal overflow",
    );
  // Visual and layout coverage in both app themes, including very narrow phones.
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1440, 1000],
  ])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height });
      await go();
      await page.evaluate(
        (theme) => (document.documentElement.className = theme),
        theme,
      );
      await expect(
        page.getByRole("heading", { name: "Hold the core. Defy the swarm." }),
      ).toBeVisible();
      await noOverflow();
      await page.screenshot({
        path: join(output, `${width}-${theme}-home.png`),
        fullPage: true,
      });
      await page.getByRole("link", { name: /Campaign Eight sectors/ }).click();
      await expect(
        page.getByRole("heading", { name: "Secure the perimeter." }),
      ).toBeVisible();
      await expect(page.getByText("Clear First light to unlock")).toBeVisible();
      await noOverflow();
      await go("/nexus/challenges");
      await expect(
        page.getByRole("heading", { name: "Glass cannon" }),
      ).toBeVisible();
      await noOverflow();
      await go("/nexus/research");
      await expect(
        page.getByRole("heading", { name: "Built to last." }),
      ).toBeVisible();
      await noOverflow();
    }
  await page.setViewportSize({ width: 390, height: 844 });
  // Atomic research response updates the live wallet and subsequent starts.
  await go("/nexus/research");
  await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Weapon amplifier" }) })
    .getByRole("button")
    .click();
  await expect(page.getByText("LEVEL 1 / 10", { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => window.nexusQa.profile.credits), 145);
  await go("/nexus/loadout/1");
  await page.getByRole("button", { name: "Deploy nexus" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  assert.ok(
    bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390,
    "Pause dialog is in the viewport",
  );
  await page.getByRole("button", { name: "Start defense" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /Weapon power, level 0/ }).click();
  await expect(
    page.getByRole("button", { name: /Weapon power, level 1/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Defense", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Hull plating/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause defense" }).click();
  await expect(dialog).toBeVisible();
  const snapshot = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")),
  );
  assert.equal(snapshot.research.weapons, 1);
  assert.equal(snapshot.upgrades.damage, 1);
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("nexus_core_run_v2:member:club")).time,
    ),
    snapshot.time,
    "Paused run does not advance",
  );
  await page.screenshot({ path: join(output, "390-paused.png") });
  await page.getByRole("button", { name: "Save & exit" }).click();
  await page.getByRole("link", { name: /Resume your defense/ }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Resume defense" }).click();
  await page.getByRole("button", { name: /Battle speed 1 times/ }).click();
  await expect(
    page.getByRole("button", { name: /Battle speed 2 times/ }),
  ).toBeVisible();
  await page.waitForTimeout(1300);
  await noOverflow();
  await page.screenshot({
    path: join(output, "390-battle.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: join(output, "1440-battle.png"),
    fullPage: true,
  });
  // A browser reload restores from checkpoint and never silently replaces it.
  await go("/nexus/loadout/endless");
  await expect(
    page.getByRole("link", { name: "Resume saved run" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Replace saved run" }).click();
  await page.getByRole("button", { name: "Deploy nexus" }).click();
  await page.getByRole("button", { name: "Start defense" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(dialog).toBeVisible();
  // Direct URLs cannot bypass campaign unlocks.
  await go("/nexus/battle/8");
  await expect(
    page.getByRole("heading", { name: "Sector locked." }),
  ).toBeVisible();
  // Exercise every live weapon and the exact-value upgrade previews in real UI.
  await go();
  await page.evaluate(() => window.stageNexusBattle());
  await go("/nexus/battle/endless");
  await page.getByRole("button", { name: "Resume defense" }).click();
  await page.locator(".nc-systems summary").click();
  await expect(page.getByText("4 / 4 online")).toBeVisible();
  await page.getByRole("tab", { name: "Weapons", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Chain arc, level 1/ }),
  ).toContainText("targets");
  await page.getByRole("button", { name: /Rail lance, level 1/ }).click();
  await expect(
    page.getByRole("button", { name: /Rail lance, level 2/ }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const s = JSON.parse(
            localStorage.getItem("nexus_core_run_v2:member:club"),
          );
          return ["pulse", "arc", "rail", "orbit"].every(
            (k) => s.metrics.damage[k] > 0,
          );
        }),
      { timeout: 10000 },
    )
    .toBe(true);
  await noOverflow();
  await page.screenshot({
    path: join(output, "1440-weapon-systems.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(output, "390-weapon-systems.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Reward failures show a retry. A retry unlocks the next sector.
  await go();
  await page.evaluate(() => {
    window.stageNexusResult();
    sessionStorage.setItem("nexus-qa-fail", "1");
  });
  await go("/nexus/results/1");
  await expect(page.getByRole("alert")).toContainText("Offline");
  await expect(page.getByRole("link", { name: "Deploy again" })).toHaveCount(0);
  await page.evaluate(() => {
    window.nexusQa.failClaims = false;
    sessionStorage.removeItem("nexus-qa-fail");
  });
  await page.getByRole("button", { name: "Retry sync →" }).click();
  await expect(page.getByText("Credits and record synced")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Next sector: Fast approach" }),
  ).toBeVisible();
  await page.screenshot({
    path: join(output, "1440-results.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => window.nexusQa.claims),
    2,
    "Result retries only after an explicit retry",
  );
  await go("/nexus/codex");
  await expect(
    page.getByRole("heading", { name: "Know your perimeter." }),
  ).toBeVisible();
  await go("/nexus/research");
  await expect(page.getByLabel("Credit history")).toContainText(
    "first-clear bonus",
  );
  await go("/nexus/leaderboard");
  await expect(
    page.getByRole("heading", { name: "The first record is yours to set." }),
  ).toBeVisible();
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS responsive themes, campaign locks, challenges, research, live upgrades, pause/resume, replacement, 2× speed, blur, reward sync, field guide, and records",
  );
} finally {
  await browser.close();
}
