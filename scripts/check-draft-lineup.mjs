// Actual Lineup pages with an isolated validating browser-local transport.
// Official database rules run separately in test-draft-lineup-db.mjs.
import {spawn} from 'node:child_process';
import {createWriteStream,existsSync} from 'node:fs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit,devices,expect} from '@playwright/test';
const output=process.env.DRAFT_LINEUP_OUTPUT||await mkdtemp(join(tmpdir(),'draft-lineup-'));
await mkdir(output,{recursive:true});
const engine=process.env.DRAFT_LINEUP_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const base=process.env.DRAFT_LINEUP_URL||'http://127.0.0.1:8096';
const report={engine,checks:[],errors:[],runtimeErrors:[],fixtures:'Production Lineup pages and hooks; browser-local auth, persistence, validating RPC transport. SQL integration is tested separately.',commit:process.env.GITHUB_SHA||null,keyboard_model:'Controlled VisualViewport resize/pan events; no physical iPhone or OS keyboard is opened.'};
let server,browser,page,log;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const check=(label,extra={})=>report.checks.push({label,ok:true,...extra});
let cleanupStarted=false;
async function cleanup(){if(cleanupStarted)return;cleanupStarted=true;await browser?.close().catch(()=>{});if(server&&server.exitCode===null&&server.signalCode===null){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),wait(1000)]);if(server.exitCode===null&&server.signalCode===null)server.kill('SIGKILL');}log?.end();}
process.once('SIGINT',()=>{void cleanup().then(()=>process.exit(130));});process.once('SIGTERM',()=>{void cleanup().then(()=>process.exit(143));});
async function settle(p){await p.waitForFunction(()=>window.daQa?.ready&&window.daQueryClient?.isFetching()===0);await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await wait(150);}
async function setup(width,height,theme,shared){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<1024,reducedMotion:'reduce',...(engine==='webkit'?{userAgent:devices['iPhone 13'].userAgent}:{})});
 const p=await context.newPage();page=p;p.setDefaultTimeout(12000);p.on('pageerror',e=>report.runtimeErrors.push(e.message));
 await p.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const stub=(path,body)=>p.route(`**/${path}*`,route=>route.fulfill({contentType:'text/javascript',body}));
 await stub('src/integrations/supabase/client.ts',"export {supabase} from '/scripts/fixtures/draft-arena-backend.ts';");
 await stub('src/contexts/AuthContext.tsx',"const id=new URLSearchParams(location.search).get('user')||'u1';export const useAuth=()=>({user:{id,user_metadata:{display_name:id==='u1'?'Alex':'Blair'}},loading:false,signOut:async()=>{}});");
 await stub('src/contexts/ClubContext.tsx',"export const useClub=()=>({club:{id:'club',name:'Dry My Horse',slug:'dh'},loading:false,isClubAdmin:false,isPrivateSession:false});");
 await p.addInitScript(()=>{
  sessionStorage.setItem('da_boot_played_v1','1');localStorage.setItem('dh-club-sound-enabled','false');
  const viewport=new EventTarget();let bounds=null;const current=()=>({width:innerWidth,height:innerHeight,offsetTop:0,offsetLeft:0,scale:1,...bounds});
  for(const key of ['width','height','offsetTop','offsetLeft','scale'])Object.defineProperty(viewport,key,{get:()=>current()[key]});
  Object.defineProperty(viewport,'pageTop',{get:()=>scrollY+current().offsetTop});Object.defineProperty(viewport,'pageLeft',{get:()=>scrollX+current().offsetLeft});Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
  window.daLineupViewport={set(next,event='resize'){bounds={...current(),...next};viewport.dispatchEvent(new Event(event));},reset(){bounds=null;viewport.dispatchEvent(new Event('resize'));}};
 });
 const go=async(route,user='u1')=>{const params=new URLSearchParams({route,user,theme,stress:'lineup',shared,keyboard:'1'});await p.goto(`${base}/scripts/fixtures/draft-arena.html?${params}`,{waitUntil:'domcontentloaded'});await settle(p);};
 return {p,context,go};
}
async function widthAudit(p,label){
 const evidence=await p.locator('.da-lineup').evaluateAll(nodes=>{
  const failures=[],dimensions=[];
  if(!nodes.length)failures.push({issue:'Missing Lineup page root'});
  const viewport=document.documentElement.clientWidth||innerWidth;
  const roots=[['document',document.documentElement],['body',document.body],['arena-main',document.querySelector('#draft-arena-main')],...nodes.map((node,index)=>[`lineup-${index}`,node])];
  for(const [scope,node]of roots){
   if(!node){failures.push({scope,issue:'Missing width audit root'});continue;}
   const b=node.getBoundingClientRect(),measurement={scope,left:b.left,right:b.right,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,viewport};
   dimensions.push(measurement);
   if(node.scrollWidth>node.clientWidth+1)failures.push({...measurement,issue:'Scrollable content exceeds its reading area'});
   if(scope!=='document'&&scope!=='body'&&(b.left<-.5||b.right>viewport+.5))failures.push({...measurement,issue:'Container extends beyond the page'});
  }
  // Inspect real controls, not decorative SVG paths, glows or shadows. The
  // status-filter tray may intentionally scroll; the page itself may not.
  for(const root of nodes)for(const control of root.querySelectorAll('button,a,input,textarea,select')){
   const b=control.getBoundingClientRect();
   if(!b.width||!b.height)continue;
   let left=0,right=viewport,scrollableTray=false;
   for(let owner=control.parentElement;owner;owner=owner.parentElement){
    const style=getComputedStyle(owner),r=owner.getBoundingClientRect();
    if(/^(auto|scroll)$/.test(style.overflowX)&&owner.scrollWidth>owner.clientWidth+1){scrollableTray=true;break;}
    if(/^(hidden|clip|auto|scroll)$/.test(style.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}
   }
   if(!scrollableTray&&(b.left<left-1||b.right>right+1))failures.push({issue:'Interactive control is horizontally clipped',control:control.getAttribute('aria-label')||control.textContent?.trim().slice(0,80),left:b.left,right:b.right,clip:{left,right}});
  }
  return {failures,dimensions};
 });
 assert.deepEqual(evidence.failures,[],label+' has no horizontal overflow or clipped controls');
 check(label,{dimensions:evidence.dimensions});
}
async function keyboardControl(control,label){
 let evidence;
 await expect.poll(async()=>{evidence=await control.evaluate(node=>{const b=node.getBoundingClientRect(),v=visualViewport;let left=v.offsetLeft,top=v.offsetTop,right=left+v.width,bottom=top+v.height;const issues=[];
  for(let owner=node.parentElement;owner;owner=owner.parentElement){const r=owner.getBoundingClientRect(),style=getComputedStyle(owner);if(/(auto|scroll|hidden|clip)/.test(style.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}if(/(auto|scroll|hidden|clip)/.test(style.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}}
  if(b.width<43.5||b.height<43.5)issues.push('Control smaller than44px');if(b.left<left-1||b.right>right+1||b.top<top-1||b.bottom>bottom+1)issues.push(`Clipped control ${JSON.stringify({box:{x:b.x,y:b.y,width:b.width,height:b.height},clip:{left,top,right,bottom}})}`);
  if(node.matches('input,textarea')&&parseFloat(getComputedStyle(node).fontSize)<16)issues.push('Input risks Safari focus zoom');const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);if(!node.matches(':disabled')&&hit!==node&&!node.contains(hit))issues.push('Control center is obscured');return {issues,box:{x:b.x,y:b.y,width:b.width,height:b.height}};});return evidence.issues;},{message:label}).toEqual([]);check(label,evidence);
}
async function keyboard(p,input,submit,width,height,label){
 const visible=width>height?210:width===320?260:330,top=width>height?35:width===320?70:110;
 await input.focus();await p.evaluate(({width,visible,top})=>window.daLineupViewport.set({width:width-12,height:visible,offsetTop:top,offsetLeft:6}),{width,visible,top});
 await keyboardControl(input,label+'-input-visible');await keyboardControl(submit,label+'-submit-visible');await input.evaluate(node=>node.setSelectionRange(3,3));
 await p.evaluate(({width,visible,top})=>window.daLineupViewport.set({width:width-12,height:visible,offsetTop:top+12,offsetLeft:6},'scroll'),{width,visible,top});
 await keyboardControl(input,label+'-pan-preserves-field');assert.equal(await input.evaluate(node=>node.selectionStart),3);check(label+'-pan-preserves-caret');await p.screenshot({path:join(output,label+'-keyboard.png')});
}
async function journey(width=390,height=844,theme='dark'){
 const label=`${engine}-${width}x${height}-${theme}`;const {p,context,go}=await setup(width,height,theme,`${label}-${Date.now()}`);
 try{
  await go('/drafts/lineup');await expect(p.getByRole('heading',{name:/Every pick/})).toBeVisible();await widthAudit(p,label+'-hub-width');await p.screenshot({path:join(output,label+'-hub.png')});
  await go('/drafts/lineup/create');await p.getByRole('button',{name:/Breakfast Club/}).click();await p.getByRole('button',{name:'Next',exact:true}).click();await p.getByLabel('Draft topic',{exact:true}).fill('The perfect weekend breakfast');await p.getByRole('button',{name:'Next',exact:true}).click();await p.evaluate(()=>window.daQa.loseNextLineupResponse());await p.getByRole('button',{name:'Create lineup',exact:true}).click();
  await expect(p.getByRole('button',{name:'Retry creation',exact:true})).toBeVisible();const createRequest=await p.evaluate(()=>window.daQa.tables.draft_lineup_requests.find(row=>row.result.action==='create').request_id);await p.reload();await settle(p);await expect(p.getByRole('button',{name:'Retry creation',exact:true})).toBeVisible();await p.getByRole('button',{name:'Retry creation',exact:true}).click();
  await expect.poll(()=>p.evaluate(()=>window.daQa.calls.filter(row=>row.rpc==='draft_lineup_action').at(-1)?.args.p_request_id)).toBe(createRequest);check(label+'-creation-lost-reply-reload-retry');
  await expect(p.locator('[data-lineup-status="setup"]')).toBeVisible();const createdId=await p.evaluate(()=>window.daQa.tables.drafts.findLast(d=>d.draft_format==='lineup'&&d.topic==='The perfect weekend breakfast')?.id);assert.ok(createdId);assert.equal(await p.evaluate(()=>window.daQa.tables.drafts.filter(d=>d.topic==='The perfect weekend breakfast').length),1);check(label+'-actual-create');
  await go('/drafts/lineup/'+createdId,'u2');await p.getByRole('button',{name:'Join lineup',exact:true}).click();await expect(p.getByRole('button',{name:'Leave lineup',exact:true})).toBeVisible();check(label+'-join');
  await go('/drafts/lineup/'+createdId);await p.getByRole('button',{name:'Start lineup',exact:true}).click();await expect(p.getByRole('button',{name:'Make selection',exact:true})).toBeVisible();check(label+'-start');
  await p.getByRole('button',{name:'Draft Dessert',exact:true}).click();const dialog=p.locator('.da-pick-dialog[role="dialog"]');await expect(dialog.getByRole('button',{name:'Dessert',exact:true})).toHaveAttribute('aria-pressed','true');const input=dialog.getByRole('textbox',{name:'Your draft pick',exact:true});await input.fill('Chocolate croissant');await keyboard(p,input,dialog.getByRole('button',{name:'Submit pick',exact:true}),width,height,label);await dialog.getByRole('button',{name:'Submit pick',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(p.getByRole('region',{name:'Your lineup',exact:true})).toContainText('Chocolate croissant');
  const pick=await p.evaluate(()=>window.daQa.tables.draft_picks.find(row=>row.pick_text==='Chocolate croissant'&&row.draft_id===window.daQa.tables.drafts.findLast(d=>d.topic==='The perfect weekend breakfast').id));assert.equal(pick.lineup_slot_id,'sweet');assert.equal(pick.pick_number,1);check(label+'-any-slot-first-pick');await p.evaluate(()=>window.daLineupViewport.reset());
  await p.reload();await settle(p);await expect(p.getByRole('region',{name:'Your lineup',exact:true})).toContainText('Chocolate croissant');check(label+'-reload-roster');await widthAudit(p,label+'-room-width');await p.screenshot({path:join(output,label+'-room.png')});
  await go('/drafts/lineup/lineup-active');await p.getByRole('button',{name:'Make selection',exact:true}).click();const retryDialog=p.locator('.da-pick-dialog[role="dialog"]');await expect(retryDialog.getByRole('button',{name:'Drink, filled',exact:true})).toBeDisabled();await retryDialog.getByRole('button',{name:'Dessert',exact:true}).click();await retryDialog.getByRole('textbox',{name:'Your draft pick',exact:true}).fill('Blueberry muffin');await p.evaluate(()=>window.daQa.loseNextLineupResponse());await retryDialog.getByRole('button',{name:'Submit pick',exact:true}).click();await expect(p.getByRole('button',{name:'Retry saved action',exact:true})).toBeVisible();
  const pendingPick=await p.evaluate(()=>JSON.parse(localStorage.getItem('dh:lineup:pending:v1:u1:club:lineup-active')));assert.equal(pendingPick.payload.slot_id,'sweet');await p.reload();await settle(p);await p.getByRole('button',{name:'Retry saved action',exact:true}).click();await expect(p.getByRole('button',{name:'Retry saved action',exact:true})).toHaveCount(0);assert.equal(await p.evaluate(()=>window.daQa.tables.draft_picks.filter(row=>row.draft_id==='lineup-active'&&row.pick_text==='Blueberry muffin').length),1);assert.equal(await p.evaluate(()=>window.daQa.calls.filter(row=>row.rpc==='draft_lineup_action').at(-1).args.p_request_id),pendingPick.requestId);check(label+'-pick-lost-reply-reload-exact-retry');
  await p.getByRole('button',{name:'Make selection',exact:true}).click();await expect(p.locator('.da-pick-dialog').getByRole('button',{name:'Dessert, filled',exact:true})).toBeDisabled();await p.keyboard.press('Escape');check(label+'-filled-slots-disabled');
  await p.getByRole('tab',{name:'Pick log',exact:true}).click();await expect(p.getByRole('list',{name:'Lineup pick history'})).toContainText('Dessert · Alex');check(label+'-history-slot-labels');
  await go('/drafts/lineup/lineup-complete?view=results');await p.getByRole('tab',{name:'Results',exact:true}).click();await expect(p.locator('.da-lineup-results')).toContainText('36');await widthAudit(p,label+'-results-width');await p.screenshot({path:join(output,label+'-results.png')});check(label+'-stored-results');
  await go('/drafts/lineup/create');await expect(p.getByRole('group',{name:'Lineup templates',exact:true}).getByRole('button')).toHaveCount(7);await p.getByRole('button',{name:/Fictional Football/}).click();await expect(p.locator('.da-lineup-template-preview')).toContainText('5 picks each');await p.getByRole('button',{name:/Your Lineup/}).click();
  await p.getByRole('textbox',{name:'Slot 1 name',exact:true}).fill('');await expect(p.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await p.getByRole('textbox',{name:'Slot 1 name',exact:true}).fill('Lead role');await p.getByRole('button',{name:'Remove slot 4',exact:true}).click();await p.getByRole('button',{name:'Remove slot 3',exact:true}).click();await expect(p.getByRole('button',{name:'Remove slot 1',exact:true})).toBeDisabled();await p.getByRole('button',{name:/^Add slot/}).click();await expect(p.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await p.getByRole('textbox',{name:'Slot 3 name',exact:true}).fill('Wildcard');await p.getByRole('button',{name:'Move slot 3 up',exact:true}).click();await expect(p.getByRole('textbox',{name:'Slot 2 name',exact:true})).toHaveValue('Wildcard');await widthAudit(p,label+'-custom-slot-editor-width');await p.screenshot({path:join(output,label+'-custom-slots.png')});await p.getByRole('button',{name:'Next',exact:true}).click();await p.getByLabel('Draft topic',{exact:true}).fill('Our custom crew');await p.getByRole('button',{name:'Next',exact:true}).click();await p.getByRole('button',{name:'Create lineup',exact:true}).click();await expect(p.locator('[data-lineup-status="setup"]')).toBeVisible();const custom=await p.evaluate(()=>window.daQa.tables.drafts.findLast(row=>row.topic==='Our custom crew'));assert.equal(custom.num_rounds,3);assert.deepEqual(custom.lineup_config.slots.map(row=>row.label),['Lead role','Wildcard','Slot 2']);check(label+'-custom-slots-validate-reorder-persist');
  assert.equal(await p.evaluate(()=>window.daQa.operations.filter(row=>row.rows?.some(item=>item.draft_format==='lineup'||item.lineup_slot_id)&&row.transport!=='lineup-rpc').length),0);check(label+'-writes-use-authorized-rpc-transport');
  console.log('PASS '+label);
 }catch(error){await p.screenshot({path:join(output,label+'-failure.png')}).catch(()=>{});await writeFile(join(output,label+'-failure.txt'),String(error.stack||error));throw error;}finally{await context.close();}
}
try{
 log=createWriteStream(join(output,'vite.log'));if(!process.env.DRAFT_LINEUP_URL){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','8096','--strictPort'],{cwd:resolve('.'),stdio:['ignore','pipe','pipe']});server.stdout.pipe(log);server.stderr.pipe(log);}
 for(let i=0;i<100;i++){try{if((await fetch(base+'/scripts/fixtures/draft-arena.html')).ok)break;}catch{}if(i===99)throw Error('Vite did not start within20seconds');await wait(200);}
 browser=engine==='webkit'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:process.env.DRAFT_LINEUP_CHROMIUM||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),args:['--no-sandbox']});
 const sizes=process.env.DRAFT_LINEUP_QUICK?[[390,844,'dark']]:[[320,568,'dark'],[320,568,'light'],[390,844,'dark'],[390,844,'light'],[844,390,'dark'],[844,390,'light'],[1440,900,'dark'],[1440,900,'light']];
 for(const [width,height,theme]of sizes)await journey(width,height,theme);assert.deepEqual(report.runtimeErrors,[]);console.log(`PASS Lineup ${engine}: ${report.checks.length} checks`);
}catch(error){report.errors.push(String(error.stack||error));console.error(error);process.exitCode=1;}finally{await cleanup();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Lineup report: '+join(output,'report.json'));}
