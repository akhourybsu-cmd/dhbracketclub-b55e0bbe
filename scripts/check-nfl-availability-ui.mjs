// Actual page + production CSS with mocked hooks. Never signs in or writes live data.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const output=await mkdtemp(join(tmpdir(),'dh-nfl-availability-'));
const server=await createServer({server:{host:'127.0.0.1',port:8093,strictPort:true},mode:'test'});
let browser;
try {
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // External fonts/telemetry are irrelevant to this local layout check and can
 // otherwise leave the browser waiting on an unavailable network.
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1' ? route.continue() : route.abort());
 await page.route('**/src/contexts/AuthContext.tsx*',route=>route.fulfill({contentType:'text/javascript',body:'export const useAuth=()=>({user:{id:"me"}});'}));
 const modules={
  usePickem:'export const useActiveSeason=()=>({season:window.qa.season});export const useWeekGames=()=>({games:window.qa.games});',
  useCrazyChainWeeks:'export const useCrazyChainWeeks=()=>({weeks:window.qa.weeks});export const chooseChainBoardWeek=()=>window.qa.weeks[0];',
  useCrazyChainBoard:'export const useCrazyChainBoard=()=>({migrationReady:true,availabilityReady:true,now:window.qa.now,board:{games:[{game_id:"game",unlocked:true}]}});',
  useCrazyChain:'export const useCrazyChainMarkets=()=>({markets:window.qa.markets});export const useMyCrazyChainEntry=()=>({entry:window.qa.entry,refetch:async()=>({})});export const useCrazyChainStandings=()=>({standings:[]});export const useMyCrazyChainGameCards=()=>({cards:[]});export const saveCrazyChainGame=async(game,ids)=>{window.qa.saves.push({game,ids});};',
 };
 for(const [name,body] of Object.entries(modules)) await page.route(`**/src/hooks/${name}.ts*`,route=>route.fulfill({contentType:'text/javascript',body}));
 await page.addInitScript(()=>{
  const now=Date.now();const team=id=>({id,abbr:id,name:id,city:id});
  const base={game_id:'game',market_type:'passing_yards',operator:'gte',threshold:200,source_provider:'espn-roster',subject_external_id:'qb',status:'open'};
  window.qa={now,saves:[],season:{id:'season',current_week:1},weeks:[{id:'week',week_number:1,label:'Week 1',marketCount:3}],
   games:[{id:'game',week_id:'week',season_id:'season',status:'scheduled',kickoff_at:new Date(now+7200_000).toISOString(),home_team:team('LAR'),away_team:team('SF')}],
   markets:[{...base,id:'advisory',display_text:'Questionable Quarterback · 200+ passing yards',availability_status:'review',availability_note:'Injury or availability concern; you can still select this player.'},
    {...base,id:'stale',display_text:'Pending Recheck Receiver · 4+ receptions',market_type:'receptions',threshold:4,availability_status:'verified',availability_checked_at:null},
    {...base,id:'cancelled',display_text:'Unavailable Running Back · 50+ rushing yards',market_type:'rushing_yards',threshold:50,status:'void',void_reason:'Player out before kickoff. Pick cancelled; no chain penalty.'}],
   entry:{legs:[{market_id:'cancelled',status:'void',display_text:'Unavailable Running Back · 50+ rushing yards',void_reason:'Player out before kickoff. Pick cancelled; no chain penalty.'}]}};
 });
 for(const width of [320,375,412,1280]) for(const theme of ['light','dark']) {
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:8093/scripts/fixtures/nfl-availability.html',{waitUntil:'domcontentloaded',timeout:60_000});
  await page.getByRole('heading',{name:'Crazy Chain',exact:true}).waitFor();
  await page.evaluate(theme=>{
   document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);
  },theme);
  const advisory=page.getByRole('button',{name:/Questionable Quarterback/});
  assert.equal(await advisory.isEnabled(),true);
  assert.equal(await page.getByRole('button',{name:/Pending Recheck Receiver/}).isEnabled(),true);
  assert.equal(await page.getByRole('button',{name:/Unavailable Running Back/}).isEnabled(),false);
  await advisory.click();await page.getByRole('button',{name:'Save picks for SF at LAR'}).click();
  await page.waitForFunction(()=>window.qa.saves.length===1);
  assert.deepEqual(await page.evaluate(()=>window.qa.saves[0]),{game:'game',ids:['cancelled','advisory']});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}px ${theme}`);
  // The app intentionally scrolls body inside a fixed-height document. Capture
  // both visible positions instead of a clipped full-document screenshot.
  await page.screenshot({path:join(output,`${width}-${theme}-picks.png`)});
  await page.evaluate(()=>{
   window.scrollTo(0,0);document.querySelectorAll('*').forEach(element=>{if(element.scrollTop)element.scrollTop=0;});
  });
  await page.screenshot({path:join(output,`${width}-${theme}.png`)});
  console.log(`PASS ${width}px ${theme}: advisory picks, saved cancellation, no horizontal overflow`);
 }
 assert.deepEqual(errors,[]);console.log(`Screenshots: ${output}`);
} finally {
 await browser?.close();await server.close();
}
