// Actual title, journal and campaign controls against the same isolated real
// PostgreSQL transport as the released game. No tutorial mutation is faked.
const ACADEMY = {
  workforce: ['hiring','stats','training','equipment','repairs'],
  industry: ['ore','warehouse','smeltery','gems','crafting','queues'],
  field: ['exploration','survey','infrastructure','hazards','reports','discoveries'],
  business: ['office','research','contracts','milestones','strategy'],
  club: ['projects','standings','showcase','privacy','updates'],
  settings: ['sound','main_menu','exit'],
};
const journal = page => page.getByRole('region', { name: 'Prospector’s Training Journal', exact: true });
const title = page => page.getByTestId('deep-claim-title');
const menuSample = page => page.evaluate(() => window.deepClaimRuntime.menuSamples.at(-1));
function economics(snapshot) {
  const { server_now: _clock, ...rest } = snapshot;
  return rest;
}
async function openJournal(page, h) {
  await title(page).getByRole('button', { name: 'Tutorial & Field Guide', exact: true }).click();
  await h.expect(journal(page)).toBeVisible();
}

export async function runDeepClaimMenuBrowser(h) {
  const cases = [[320,568,'dark','no-preference'],[390,844,'light','no-preference'],[844,390,'dark','no-preference'],[1440,900,'light','no-preference'],[390,844,'dark','reduce']];
  for (const [width,height,theme,motion] of cases) {
    // Reuse one untouched isolated company slot across the visual matrix.
    const {context,page} = await h.setup(width,height,theme,motion,{runtimeProbe:true,isMobile:width<900});
    await h.go(page,{run:'training-menu-empty',theme,enter:false});
    await h.expect(title(page)).toBeVisible();
    await h.expect(title(page).getByRole('button',{name:'New Game',exact:true})).toBeEnabled();
    await h.expect(page.getByTestId('deep-claim-canvas')).toHaveCount(0);
    await h.expect(page.getByTestId('deep-claim-menu-backdrop')).toHaveAttribute('data-dc-title-scene','illustrative');
    h.checked(`training-title-no-save-does-not-bootstrap-${width}x${height}-${theme}`,!(await h.command(page,'calls')).some(call=>call.name==='dc_bootstrap'));
    h.checked(`training-title-audio-requires-a-gesture-${width}x${height}-${theme}`,await page.evaluate(()=>window.deepClaimRuntime.contexts.length===0));
    await h.expect.poll(async()=>(await menuSample(page))?.paints??0).toBeGreaterThan(0);
    const illustration=await menuSample(page);
    h.checked(`training-title-render-buffers-stay-bounded-${width}x${height}-${theme}`,illustration.backingPixels>0&&illustration.backingPixels<=1000000&&illustration.cachePixels<=2000000,illustration);
    if(motion==='reduce')await h.expect(page.getByTestId('deep-claim-menu-backdrop')).toHaveAttribute('data-dc-menu-state','static');
    await h.fit(page,`training-title-${width}x${height}-${theme}-${motion}`);await h.shot(page,`training-title-${width}x${height}-${theme}-${motion}`);
    const start=title(page).getByRole('button',{name:'New Game',exact:true});await start.focus();await page.keyboard.press('Tab');
    h.checked(`training-title-native-keyboard-order-${width}x${height}-${theme}`,await title(page).getByRole('button',{name:'Tutorial & Field Guide',exact:true}).evaluate(node=>node===document.activeElement));
    await page.keyboard.press('End');await h.expect(title(page).getByRole('button',{name:'Return to DH Club',exact:true})).toBeFocused();
    await page.keyboard.press('Home');await h.expect(start).toBeFocused();await page.keyboard.press('ArrowUp');
    await h.expect(title(page).getByRole('button',{name:'Return to DH Club',exact:true})).toBeFocused();
    h.checked(`training-title-arrow-navigation-wraps-without-activating-a-command-${width}x${height}-${theme}`,true);
    await openJournal(page,h);await h.expect(journal(page).getByRole('combobox',{name:'Training section',exact:true}).locator('option')).toHaveCount(7);
    await h.expect.poll(async()=>(await menuSample(page))?.state).toBe('inactive');
    const paused=await menuSample(page);await page.waitForTimeout(250);
    h.checked(`training-title-paint-loop-pauses-behind-the-journal-${width}x${height}-${theme}`,(await menuSample(page)).paints===paused.paints);
    await journal(page).getByRole('combobox',{name:'Training section',exact:true}).selectOption('club');
    await journal(page).getByRole('searchbox',{name:'Search training lessons',exact:true}).fill('Privacy');
    await h.expect(journal(page).locator('[data-journal-lesson="club.privacy"]')).toBeVisible();
    await journal(page).getByRole('button',{name:'Read Privacy',exact:true}).click();
    await h.expect(journal(page).locator('[data-journal-detail="club.privacy"]')).toBeVisible();
    await h.fit(page,`training-journal-${width}x${height}-${theme}`);await h.shot(page,`training-journal-${width}x${height}-${theme}`);
    await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();
    await h.expect(title(page)).toBeVisible();
    await title(page).getByRole('button',{name:'Settings',exact:true}).click();
    const settings=page.getByRole('tablist',{name:'Camp settings views',exact:true});await h.expect(settings).toBeVisible();
    await settings.getByRole('tab',{name:'Sound',exact:true}).click();
    await h.expect(page.getByRole('switch',{name:'Enable sound',exact:true})).toHaveAttribute('aria-checked','false');
    for(const label of ['Game sound volume','Music volume','Mining effects volume','Camp ambience volume'])await h.expect(page.getByRole('slider',{name:label,exact:true})).toBeVisible();
    await settings.getByRole('tab',{name:'Visuals',exact:true}).click();
    await page.getByRole('switch',{name:'Reduced graphics',exact:true}).click();
    await h.expect(page.getByRole('switch',{name:'Reduced graphics',exact:true})).toHaveAttribute('aria-checked','true');
    await h.fit(page,`training-menu-settings-${width}x${height}-${theme}`);await h.shot(page,`training-menu-settings-${width}x${height}-${theme}`);
    await page.keyboard.press('Escape');await h.expect(title(page)).toBeVisible();
    await h.expect(title(page).getByRole('button',{name:'Settings',exact:true})).toBeFocused();
    h.checked(`training-menu-reference-and-settings-never-found-a-company-${width}x${height}-${theme}`,!(await h.command(page,'calls')).some(call=>call.name==='dc_bootstrap'));
    await context.close();
  }
  const {context,page}=await h.setup(390,844,'dark','no-preference',{runtimeProbe:true,isMobile:true});
  const run='training-menu-actual-save';await h.go(page,{run,enter:false});
  await title(page).getByRole('button',{name:'New Game',exact:true}).click();
  await h.expect(page.getByRole('button',{name:'Skip introduction',exact:true})).toBeVisible();
  await h.shot(page,'training-new-game-gus-handover');await page.getByRole('button',{name:'Skip introduction',exact:true}).click();
  const name=page.getByRole('textbox',{name:'Company name',exact:true});await name.fill('The Lantern Claim');await name.focus();
  await page.setViewportSize({width:390,height:420});
  await h.fit(page,'training-naming-reduced-visible-viewport');await h.shot(page,'training-naming-reduced-visible-viewport');
  h.checked('training-naming-viewport-check-is-not-a-physical-soft-keyboard-claim',await name.evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Review deed',exact:true}).click();
  h.checked('training-reviewing-the-deed-does-not-create-a-company',!(await h.command(page,'calls')).some(call=>call.name==='dc_bootstrap'));
  await page.getByRole('button',{name:'Found company',exact:true}).click();await h.dismissTutorial(page);await h.expect(page.getByRole('tablist',{name:'Company views',exact:true})).toBeVisible();
  const founded=await h.rpc(page,'dc_get');h.checked('training-deed-uses-one-authoritative-bootstrap',founded.company.name==='The Lantern Claim'&&(await h.command(page,'calls')).filter(call=>call.name==='dc_bootstrap'&&call.status==='completed').length===1);
  await h.go(page,{run,enter:false});await h.expect(title(page).getByRole('button',{name:'Continue',exact:true})).toBeEnabled();
  await h.fit(page,'training-title-verified-existing-save');await h.shot(page,'training-title-verified-existing-save');
  await title(page).getByRole('button',{name:'New Game',exact:true}).click();const safeguard=page.getByRole('dialog',{name:'One claim. Yours.',exact:true});await h.expect(safeguard).toBeVisible();
  await safeguard.getByRole('button',{name:'Continue',exact:true}).click();await h.expect(page.getByRole('tablist',{name:'Company views',exact:true})).toBeVisible();
  const continued=await h.rpc(page,'dc_get');h.assert.deepEqual(economics(continued),economics(founded));
  h.checked('training-continue-and-new-game-safeguard-preserve-the-same-save-and-never-bootstrap',continued.company.id===founded.company.id&&(await h.command(page,'calls')).filter(call=>call.name==='dc_bootstrap').length===1);
  await h.go(page,{run,enter:false});await title(page).getByRole('button',{name:'Return to DH Club',exact:true}).click();await h.expect(page.getByRole('heading',{name:'Compete',exact:true})).toBeVisible();
  h.checked('training-title-return-to-dh-keeps-the-existing-company',true);await context.close();

  const fallback=await h.setup(320,568,'light','reduce');await fallback.page.route('**/deep-claim/atlas-v1.png*',route=>route.abort('failed'));
  await h.go(fallback.page,{run:'training-title-atlas-failure',theme:'light',enter:false});await h.expect(title(fallback.page).getByRole('button',{name:'New Game',exact:true})).toBeEnabled();
  await title(fallback.page).getByRole('button',{name:'New Game',exact:true}).click();await h.expect(fallback.page.getByRole('button',{name:'Skip introduction',exact:true})).toBeVisible();
  await fallback.page.getByRole('button',{name:'Skip introduction',exact:true}).click();await h.expect(fallback.page.getByRole('textbox',{name:'Company name',exact:true})).toBeVisible();
  h.checked('training-cosmetic-atlas-failure-does-not-block-new-game',true);await fallback.context.close();
  console.log('PASS Deep Claim cinematic menu, real founding and save protection');
}

export async function runDeepClaimAcademyBrowser(h) {
  const {context,page}=await h.setup(390,844,'light','reduce');const run='training-academy-readonly';
  await h.found(page,{run,theme:'light'});await h.go(page,{run,theme:'light',enter:false});await openJournal(page,h);
  const before=await h.rpc(page,'dc_get'),beforeProgress=await h.rpc(page,'dc_tutorial_get');
  const callStart=(await h.command(page,'calls')).length;
  for(const [section,keys] of Object.entries(ACADEMY)){
    await journal(page).getByRole('combobox',{name:'Training section',exact:true}).selectOption(section);
    for(const key of keys){
      const id=`${section}.${key}`,card=journal(page).locator(`[data-journal-lesson="${id}"]`);
      if(!await card.count())await journal(page).getByRole('button',{name:'Next training page',exact:true}).click();
      await h.expect(card).toBeVisible();await card.getByRole('button',{name:/^Read /}).click();
      await h.expect(journal(page).locator(`[data-journal-detail="${id}"]`)).toBeVisible();
      await journal(page).getByRole('button',{name:'Practice safely',exact:true}).click();const practice=page.getByRole('region',{name:'Safe practice',exact:true});
      await h.expect(practice).toHaveAttribute('data-practice-id',`practice.${id}`);await h.expect(practice.getByRole('button',{name:'Finish safe practice',exact:true})).toBeDisabled();
      await practice.getByRole('group',{name:'Try a decision',exact:true}).getByRole('button').first().click();
      await h.expect(practice.locator('[role="status"].dct-practice-feedback')).toBeVisible();await practice.getByRole('button',{name:'Finish safe practice',exact:true}).click();
      await h.expect(journal(page)).toBeVisible();await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).reviewed_lessons.includes(id)).toBe(true);
      if(await journal(page).locator('[data-journal-detail]').count())await journal(page).getByRole('button',{name:'Back to training lessons',exact:true}).click();
      h.checked(`training-safe-academy-review-${id}`,true);
    }
  }
  const after=await h.rpc(page,'dc_get'),afterProgress=await h.rpc(page,'dc_tutorial_get');h.assert.deepEqual(economics(after),economics(before));
  h.assert.deepEqual(afterProgress.practiced_lessons,beforeProgress.practiced_lessons);
  const expected=Object.entries(ACADEMY).flatMap(([section,keys])=>keys.map(key=>`${section}.${key}`));
  h.checked('training-all-thirty-academy-scenarios-persist-as-reviewed-without-fabricated-practical-completions',expected.length===30&&expected.every(id=>afterProgress.reviewed_lessons.includes(id)));
  const calls=(await h.command(page,'calls')).slice(callStart);h.checked('training-safe-practice-calls-no-economic-preview-or-mutation',calls.every(call=>['dc_get','dc_tutorial_get','dc_tutorial_save'].includes(call.name)),calls.map(call=>call.name));
  await h.fit(page,'training-academy-reviewed-library');await h.shot(page,'training-academy-reviewed-library');
  await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();await h.go(page,{run,theme:'light',enter:false});await openJournal(page,h);
  const restored=await h.rpc(page,'dc_tutorial_get');h.checked('training-academy-progress-survives-reload',expected.every(id=>restored.reviewed_lessons.includes(id)));
  await context.close();console.log('PASS Deep Claim thirty read-only academy lessons');
}

async function assertGuideTarget(page,h,label) {
  const result=await page.locator('.dct-overlay').evaluate(node=>{
    const state=node.getAttribute('data-target-state'),spot=node.querySelector('.dct-spotlight'),guide=node.querySelector('.dct-guidance')?.getBoundingClientRect();
    const base={state,portaled_in_dialog:!!node.closest('[role="dialog"]'),guide_in_view:!!guide&&guide.left>=-1&&guide.top>=-1&&guide.right<=innerWidth+1&&guide.bottom<=innerHeight+1};
    if(state!=='found'||!spot)return base;
    const rect=spot.getBoundingClientRect();
    const overlaps=!!guide&&Math.max(rect.left,guide.left)<Math.min(rect.right,guide.right)&&Math.max(rect.top,guide.top)<Math.min(rect.bottom,guide.bottom);
    return {...base,overlaps};
  });
  h.checked(`training-target-and-guide-do-not-overlap-${label}`,result.guide_in_view&&(result.state!=='found'||!result.overlaps),result);
  return result;
}

export async function runDeepClaimCampaignBrowser(h) {
  const run='training-twelve-chapter-campaign',main=await h.setup(390,844,'dark','no-preference',{isMobile:true,runtimeProbe:true});
  const {context,page}=main;const narrative=new Map(),visited=new Set();let dispatched=null,devicesChecked=false;
  async function readLine(){
    const scene=page.locator('[data-dialogue-scene]').filter({visible:true}).first();
    const id=await scene.getAttribute('data-dialogue-line');narrative.set(id,await scene.innerText());
    await scene.getByRole('button',{name:'Advance dialogue',exact:true}).click();
  }
  async function ensureIntroQuote(){
    const dialog=page.getByRole('dialog',{name:'Work a seam',exact:true});await h.expect(dialog).toBeVisible();
    const review=dialog.getByRole('button',{name:'Review dispatch',exact:true});
    if(await review.count()){
      const induction=dialog.locator('[data-dc-tutorial="dispatch-induction"] input');await h.expect(induction).toBeVisible();await induction.check();
      await review.click();
    }
    await h.expect(dialog.getByRole('region',{name:'Verified dispatch estimate',exact:true})).toBeVisible();await h.expect(dialog.getByText('30s',{exact:true})).toBeVisible();
    return dialog;
  }
  async function inspectBuilding(){
    const existing=page.getByRole('dialog',{name:'Warehouse',exact:true});
    const buildings=page.getByRole('dialog',{name:'The surface camp',exact:true});
    const opener=page.getByRole('button',{name:'Open camp buildings',exact:true});
    // The chapter may still be moving from Stores to Surface after dialogue.
    // Wait for a real destination/control before choosing the ordinary route.
    await h.expect(existing.or(buildings).or(opener).first()).toBeVisible();
    if(await existing.isVisible())return existing;
    if(!await buildings.isVisible())await opener.click();
    await h.expect(buildings).toBeVisible();await buildings.getByRole('button',{name:/Warehouse/}).click();
    await h.expect(existing).toBeVisible();return existing;
  }
  await h.go(page,{run,enter:false});await title(page).getByRole('button',{name:'New Game',exact:true}).click();
  await h.expect(page.locator('[data-dialogue-scene="opening.deed"]')).toBeVisible();
  await page.getByRole('button',{name:'Dialogue history',exact:true}).click();await h.expect(page.getByRole('region',{name:'Dialogue history',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialogue history',exact:true}).click();
  for(let line=0;line<16&&!await page.getByRole('textbox',{name:'Company name',exact:true}).isVisible();line++)await readLine();
  await page.getByRole('textbox',{name:'Company name',exact:true}).fill('Gus’s Lantern Works');await page.getByRole('button',{name:'Review deed',exact:true}).click();
  h.checked('training-full-campaign-narrative-never-precreates-the-company',!(await h.command(page,'calls')).some(call=>call.name==='dc_bootstrap'));
  await page.getByRole('button',{name:'Found company',exact:true}).click();await h.expect(page.locator('[data-dialogue-scene="opening.crew"]')).toBeVisible();
  for(let iteration=0;iteration<120;iteration++){
    const complete=page.getByRole('region',{name:'The First Descent complete',exact:true});if(await complete.isVisible())break;
    if(await page.locator('[data-dialogue-scene]:visible').count()){await readLine();continue;}
    if(await journal(page).isVisible()){await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();continue;}
    const overlay=page.locator('.dct-overlay');
    await h.expect(overlay.or(page.locator('[data-dialogue-scene]')).or(complete).first()).toBeVisible();
    if(!await overlay.isVisible())continue;
    const step=await overlay.getAttribute('data-step-id'),lesson=await overlay.getAttribute('data-lesson-id');visited.add(lesson);
    switch(step){
      case 'beginner.claim.deed':case 'beginner.claim.founded':case 'beginner.camp.surface':case 'beginner.camp.mine':case 'beginner.crew.crew':case 'beginner.mine.enter':case 'beginner.worksite.difference':case 'beginner.worksite.planner':case 'beginner.waiting.stages':case 'beginner.sale.stock':case 'beginner.graduate.ready':break;
      case 'beginner.camp.building':await inspectBuilding();break;
      case 'beginner.crew.mara':case 'beginner.crew.ivo':case 'beginner.crew.tessa':{
        const [name,stat,view]=step.endsWith('.mara')?['Mara Flint','Mining',[320,568]]:step.endsWith('.ivo')?['Ivo Vale','Geology',[844,390]]:['Tessa Pike','Logistics',[390,844]];
        await page.setViewportSize({width:view[0],height:view[1]});const file=page.getByRole('dialog',{name,exact:true});await h.expect(file).toBeVisible();
        const skill=file.getByRole('button',{name:`Inspect ${stat}`,exact:true});await skill.focus();await page.keyboard.press('Enter');
        await h.fit(page,`training-crew-guidance-${name.split(' ')[0]}`);await h.shot(page,`training-crew-guidance-${name.split(' ')[0]}`);
        const placement=await assertGuideTarget(page,h,step);h.checked(`training-worker-guidance-is-in-the-real-portaled-dialog-${stat}`,placement.portaled_in_dialog===true,placement);break;
      }
      case 'beginner.crew.conditions':{
        const file=page.getByRole('dialog',{name:'Tessa Pike',exact:true});
        if(!await file.isVisible())await h.workerFile(page,'Tessa Pike','Overview');
        await h.expect(file).toBeVisible();
        const energy=file.locator('[data-dc-tutorial="worker-energy"]'),traits=file.locator('[data-dc-tutorial="worker-traits"]');
        await h.expect(energy).toHaveCount(1);await h.expect(traits).toHaveCount(1);
        await energy.focus();await traits.focus();break;
      }
      case 'beginner.mine.control':await page.getByTestId('deep-claim-canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Equal');break;
      case 'beginner.mine.inspect':{
        await page.getByRole('button',{name:'Open mine operations',exact:true}).click();
        await page.getByRole('dialog',{name:'Underground operations',exact:true}).getByRole('group',{name:'Mine operations',exact:true}).getByRole('button',{name:/^Extraction/}).click();
        await page.getByRole('combobox',{name:'Expedition worksite',exact:true}).selectOption('47:1');break;
      }
      case 'beginner.plan.selection':{
        const dialog=page.getByRole('dialog',{name:'Work a seam',exact:true});await h.selectCrew(dialog,['Mara Flint','Ivo Vale','Tessa Pike']);
        const induction=dialog.locator('[data-dc-tutorial="dispatch-induction"] input');await induction.check();break;
      }
      case 'beginner.plan.quote':await ensureIntroQuote();await assertGuideTarget(page,h,step);await h.fit(page,'training-authoritative-intro-quote');await h.shot(page,'training-authoritative-intro-quote');break;
      case 'beginner.descent.confirmed':{
        const dialog=await ensureIntroQuote();await dialog.getByRole('button',{name:'Dispatch crew',exact:true}).click();await h.expect(dialog).toHaveCount(0);
        const snapshot=await h.rpc(page,'dc_get');dispatched=snapshot.expeditions.find(job=>job.status==='active');
        h.checked('training-campaign-commits-the-one-real-thirty-second-induction',dispatched?.tutorial===true&&dispatched.duration_seconds===30&&snapshot.company.cash===173&&snapshot.workers.every(worker=>worker.energy===5)&&dispatched.cargo===null);break;
      }
      case 'beginner.waiting.returned':{
        h.assert.ok(dispatched);await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).active_step_id).toBe(step);
        if(!devicesChecked){
          await h.reloadCompany(page);await h.expect(page.locator('.dct-overlay')).toHaveAttribute('data-step-id',step);
          const peer=await h.setup(390,844,'dark','reduce',{isMobile:true});await h.go(peer.page,{run,enter:false});await h.continueCompany(peer.page);
          await h.expect(peer.page.locator('.dct-overlay')).toHaveAttribute('data-step-id',step);const resumed=await h.rpc(peer.page,'dc_get');
          h.checked('training-mid-expedition-reload-and-fresh-device-resume-the-identical-paid-job',resumed.expeditions.length===1&&resumed.expeditions[0].id===dispatched.id&&resumed.company.cash===173&&resumed.workers.every(worker=>worker.energy===5));
          await peer.context.close();await page.bringToFront();devicesChecked=true;
        }
        // This release includes a real-clock smoke: no advance_job command is
        // used anywhere in this campaign. Other long-game regressions retain
        // their explicit isolated owner clock controls.
        await h.expect.poll(async()=>(await h.rpc(page,'dc_get')).expeditions.find(job=>job.id===dispatched.id)?.status,{timeout:45000,intervals:[1000,2000]}).toBe('ready');
        const ready=await h.rpc(page,'dc_get');h.checked('training-induction-return-used-real-server-elapsed-time',Date.parse(ready.server_now)-Date.parse(dispatched.started_at)>=30000&&ready.expeditions.length===1);
        await page.getByRole('button',{name:'Refresh company',exact:true}).click();await h.fit(page,'training-actual-thirty-second-return');await h.shot(page,'training-actual-thirty-second-return');break;
      }
      case 'beginner.haul.cargo':if(!await page.getByRole('button',{name:'Collect into storage',exact:true}).isVisible())await page.getByRole('button',{name:'Open haul',exact:true}).click();await h.expect(page.getByRole('button',{name:'Collect into storage',exact:true})).toBeVisible();break;
      case 'beginner.haul.collected':{
        if(!await page.getByRole('button',{name:'Collect into storage',exact:true}).isVisible())await page.getByRole('button',{name:'Open haul',exact:true}).click();
        await page.getByRole('button',{name:'Collect into storage',exact:true}).click();await h.expect(page.getByRole('dialog',{name:'Haul secured.',exact:true})).toBeVisible();await h.closeReward(page);break;
      }
      case 'beginner.sale.sale':await page.getByRole('button',{name:'Sell Coal',exact:true}).click();await page.getByRole('spinbutton',{name:'Quantity to sell',exact:true}).fill('5');await page.getByRole('button',{name:'Confirm sale',exact:true}).click();await h.expect(page.getByRole('dialog',{name:'Trade recorded.',exact:true})).toBeVisible();await h.closeReward(page);break;
      case 'beginner.upgrade.review':await inspectBuilding();await h.expect(page.getByRole('button',{name:'Confirm upgrade',exact:true})).toBeEnabled();break;
      default:throw new Error(`Uncovered First Descent step: ${step}`);
    }
    await h.expect(page.getByRole('button',{name:'Next tutorial step',exact:true})).toBeVisible();await page.getByRole('button',{name:'Next tutorial step',exact:true}).click();
    await h.expect.poll(async()=>!await page.locator(`.dct-overlay[data-step-id="${step}"]`).count()||await page.locator('[data-dialogue-scene]:visible').count()>0||await complete.isVisible()).toBe(true);
  }
  await h.expect(page.getByRole('region',{name:'The First Descent complete',exact:true})).toBeVisible();
  await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).campaign_status).toBe('completed');
  const progress=await h.rpc(page,'dc_tutorial_get'),snapshot=await h.rpc(page,'dc_get');
  h.checked('training-all-twelve-real-campaign-chapters-complete-without-skipping',visited.size===12&&progress.reviewed_lessons.filter(id=>id.startsWith('beginner.')).length===12&&!progress.skipped_lessons.length,{visited:[...visited]});
  h.checked('training-real-transaction-marks-are-distinct-from-the-optional-upgrade-review',['beginner.claim','beginner.descent','beginner.waiting','beginner.haul','beginner.sale'].every(id=>progress.practiced_lessons.includes(id))&&!progress.practiced_lessons.includes('beginner.upgrade'));
  h.checked('training-graduation-and-gus-create-no-extra-company-money-stock-energy-or-workers',snapshot.company.cash===193&&snapshot.resources.coal===5&&snapshot.resources.stone===12&&snapshot.workers.length===3&&snapshot.workers.every(worker=>worker.energy===5&&!worker.name.includes('Gus'))&&snapshot.expeditions.length===1);
  const calls=await h.command(page,'calls');h.checked('training-full-campaign-has-exactly-the-authorized-economic-actions',calls.filter(call=>call.name==='dc_bootstrap').length===1&&calls.filter(call=>call.name==='dc_dispatch_operation').length===1&&calls.filter(call=>call.name==='dc_collect').length===1&&calls.filter(call=>call.name==='dc_sell').length===1&&!calls.some(call=>['dc_upgrade','dc_hire','dc_train','dc_start_production','dc_resolve_discovery','dc_set_social_preferences','dc_contribute_project','dc_claim_project'].includes(call.name)));
  h.checked('training-gus-retirement-and-warm-graduation-are-actual-played-dialogue',[...narrative.values()].some(line=>line.includes('Forty-two years'))&&[...narrative.values()].some(line=>line.includes('turn a profit'))&&[...narrative.values()].some(line=>line.includes('arguing with a mule'))&&[...narrative.values()].some(line=>line.includes('She’s your mine now')));
  await h.fit(page,'training-first-descent-graduation');await h.shot(page,'training-first-descent-graduation');await page.getByRole('button',{name:'Continue Mining',exact:true}).click();
  const beforeHelp=economics(await h.rpc(page,'dc_get'));
  const file=await h.workerFile(page,'Mara Flint','Overview');await file.getByRole('button',{name:'Help: Worker skills',exact:true}).click();
  await h.expect(journal(page).locator('[data-journal-detail="workforce.stats"]')).toBeVisible();
  h.checked('training-contextual-worker-help-opens-the-matching-lesson',true);await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();await h.clearDialogs(page);
  await h.officeView(page,'Company');await page.getByRole('button',{name:'Ask Gus',exact:true}).click();
  const advice=page.getByRole('region',{name:'Ask Gus',exact:true});await h.expect(advice).toBeVisible();
  h.checked('training-gus-advice-is-a-bounded-public-record-reference',await advice.getByRole('article').count()<=4);await h.fit(page,'training-ask-gus');await h.shot(page,'training-ask-gus');
  await advice.getByRole('button',{name:'Open related lesson',exact:true}).first().click();await h.expect(journal(page).locator('[data-journal-detail]')).toBeVisible();
  await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();await h.clearDialogs(page);h.assert.deepEqual(economics(await h.rpc(page,'dc_get')),beforeHelp);
  h.checked('training-contextual-help-and-gus-never-alter-company-state',true);
  await h.tab(page,'Settings');await page.getByRole('button',{name:'Return to Main Menu',exact:true}).click();await h.expect(title(page)).toBeVisible();
  const before=economics(await h.rpc(page,'dc_get'));await h.continueCompany(page);h.assert.deepEqual(economics(await h.rpc(page,'dc_get')),before);
  h.checked('training-graduate-can-return-to-title-and-continue-without-restarting-the-campaign',true);await context.close();
  console.log('PASS Deep Claim twelve-chapter campaign, real30-second induction and cross-device journal');
}
