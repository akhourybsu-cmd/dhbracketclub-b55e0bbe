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
  const cases = h.visualCases ?? [[320,568,'dark','no-preference'],[390,844,'light','no-preference'],[844,390,'dark','no-preference'],[1440,900,'light','no-preference'],[390,844,'dark','reduce']];
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
    await openJournal(page,h);await h.expect(journal(page).getByRole('group',{name:'Training section',exact:true}).locator('[data-dc-training-section]')).toHaveCount(7);
    await h.expect.poll(async()=>(await menuSample(page))?.state).toBe('inactive');
    const paused=await menuSample(page);await page.waitForTimeout(250);
    h.checked(`training-title-paint-loop-pauses-behind-the-journal-${width}x${height}-${theme}`,(await menuSample(page)).paints===paused.paints);
    await journal(page).getByRole('group',{name:'Training section',exact:true}).locator('[data-dc-training-section="club"]').click();
    await journal(page).getByRole('searchbox',{name:'Search training lessons',exact:true}).fill('Privacy');
    await h.expect(journal(page).locator('[data-journal-lesson="club.privacy"]')).toBeVisible();
    await journal(page).getByRole('button',{name:'Open Privacy',exact:true}).click();
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
    await title(page).getByRole('button',{name:'New Game',exact:true}).click();
    await h.expect(page.getByRole('button',{name:'Skip introduction',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Advance dialogue',exact:true}).click();
    await h.expect(page.getByRole('button',{name:'Previous dialogue line',exact:true})).toBeEnabled();
    await h.fit(page,`training-dialogue-${width}x${height}-${theme}-${motion}`);await h.shot(page,`training-dialogue-${width}x${height}-${theme}-${motion}`);
    h.checked(`training-prologue-preview-is-still-nondestructive-${width}x${height}-${theme}`,!(await h.command(page,'calls')).some(call=>call.name==='dc_bootstrap'));
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
  await title(page).getByRole('button',{name:'New Game',exact:true}).click();const safeguard=page.getByRole('dialog',{name:'Existing company',exact:true});await h.expect(safeguard).toBeVisible();
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
    await journal(page).getByRole('group',{name:'Training section',exact:true}).locator(`[data-dc-training-section="${section}"]`).click();
    for(const key of keys){
      const id=`${section}.${key}`,card=journal(page).locator(`[data-journal-lesson="${id}"]`);
      if(!await card.count())await journal(page).getByRole('button',{name:'Next training page',exact:true}).click();
      await h.expect(card).toBeVisible();await card.getByRole('button',{name:/^Open /}).click();
      await h.expect(journal(page).locator(`[data-journal-detail="${id}"]`)).toBeVisible();
      const examples=journal(page).locator('details').filter({has:page.getByText('Try an example',{exact:true})});await examples.locator('summary').click();await examples.getByRole('button',{name:'View example',exact:true}).click();const practice=page.getByRole('region',{name:'Safe practice',exact:true});
      await h.expect(practice).toHaveAttribute('data-practice-id',`practice.${id}`);await h.expect(practice.getByRole('button',{name:'Finish example',exact:true})).toBeDisabled();
      await practice.getByRole('group',{name:'Try a decision',exact:true}).getByRole('button').first().click();
      await h.expect(practice.locator('[role="status"].dct-practice-feedback')).toBeVisible();await h.fit(page,`training-practice-footer-${id}`);await practice.getByRole('button',{name:'Finish example',exact:true}).click();
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
  const core=['beginner.plan.quote','beginner.descent.confirmed','beginner.waiting.returned','beginner.haul.collected','beginner.sale.sale','beginner.upgrade.review'];
  const optional=['beginner.camp','beginner.crew','beginner.mine','beginner.worksite'];
  async function runFirstShift({run,keep=false}) {
    const main=await h.setup(keep?320:390,keep?568:844,keep?'light':'dark',keep?'reduce':'no-preference',{isMobile:true,runtimeProbe:true});
    const {context,page}=main,narrative=new Map(),visited=new Set();
    const overlay=page.locator('.dct-overlay');
    async function readLine(){
      const scene=page.locator('[data-dialogue-scene]:visible').first();
      narrative.set(await scene.getAttribute('data-dialogue-line'),await scene.getByRole('button',{name:'Advance dialogue',exact:true}).innerText());
      await scene.getByRole('button',{name:'Advance dialogue',exact:true}).click();
    }
    async function guide(step){
      await h.expect(overlay).toHaveAttribute('data-step-id',step);
      visited.add(step);
      await h.expect(overlay.getByRole('region',{name:'Tutorial guidance',exact:true})).toBeVisible();
      // The next task is visible on screen, including compact phone guidance.
      const readable=await overlay.locator('.dct-guidance').evaluate(node=>{
        const instruction=node.querySelector('.dct-guidance-copy>p')??node.querySelector('h2');
        if(!instruction)return false;
        const box=instruction.getBoundingClientRect(),panel=node.getBoundingClientRect(),style=getComputedStyle(instruction);
        return box.width>20&&box.height>8&&style.visibility!=='hidden'&&style.display!=='none'
          &&!instruction.closest('.sr-only')&&instruction.scrollHeight<=instruction.clientHeight+1
          &&box.left>=-1&&box.right<=innerWidth+1&&box.top>=panel.top-1&&box.bottom<=panel.bottom+1&&box.bottom<=innerHeight+1;
      });
      h.checked(`training-readable-action-${keep?'keep':'sale'}-${step}`,readable);
    }
    async function quote(client){
      const dialog=client.getByRole('dialog',{name:'Extraction',exact:true});await h.expect(dialog).toBeVisible();
      const review=dialog.getByRole('button',{name:'Review dispatch',exact:true});
      if(await review.count()){
        const induction=dialog.locator('[data-dc-tutorial="dispatch-induction"] input');await h.expect(induction).toBeChecked();
        await review.click();
      }
      await h.expect(dialog.getByRole('region',{name:'Verified dispatch estimate',exact:true})).toBeVisible();
      await h.expect(dialog.getByText('30s',{exact:true})).toBeVisible();
      await h.expect(dialog.getByRole('button',{name:'Dispatch crew',exact:true})).toBeEnabled();
      return dialog;
    }
    async function inspectBuilding(client){
      const buildings=client.getByRole('dialog',{name:'Buildings',exact:true});
      await h.expect(buildings).toBeVisible();
      await buildings.getByRole('button',{name:/Warehouse/}).click();
      const detail=client.getByRole('dialog',{name:'Warehouse',exact:true});await h.expect(detail).toBeVisible();
      await h.expect(detail.getByRole('button',{name:'Confirm upgrade',exact:true})).toBeEnabled();
      return detail;
    }
    async function closeReceipt(name){
      const receipt=page.getByRole('dialog',{name,exact:true});await h.expect(receipt).toBeVisible();
      await receipt.getByRole('button',{name:'Back to the claim',exact:true}).click();
    }
    await h.go(page,{run,theme:keep?'light':'dark',enter:false});
    await title(page).getByRole('button',{name:'New Game',exact:true}).click();
    await h.expect(page.locator('[data-dialogue-scene="opening.deed"]')).toBeVisible();
    if(keep)await page.getByRole('button',{name:'Skip introduction',exact:true}).click();
    else {
      await page.getByRole('button',{name:'Dialogue history',exact:true}).click();
      await h.expect(page.getByRole('region',{name:'Dialogue history',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Close dialogue history',exact:true}).click();
      for(let line=0;line<16&&!await page.getByRole('textbox',{name:'Company name',exact:true}).isVisible();line++)await readLine();
    }
    await h.expect(page.getByRole('textbox',{name:'Company name',exact:true})).toBeVisible();
    await page.getByRole('textbox',{name:'Company name',exact:true}).fill(keep?'The Kept Seam':'Gus’s Lantern Works');
    await page.getByRole('button',{name:'Review deed',exact:true}).click();
    h.checked(`training-first-shift-deed-does-not-precreate-${keep?'keep':'sale'}`,!(await h.command(page,'calls')).some(call=>call.name==='dc_bootstrap'));
    await page.getByRole('button',{name:'Found company',exact:true}).click();
    await h.expect(page.locator('[data-dialogue-scene="opening.crew"]')).toBeVisible();
    if(keep)await page.getByRole('button',{name:'Skip dialogue',exact:true}).click();
    else for(let line=0;line<8&&await page.locator('[data-dialogue-scene="opening.crew"]:visible').count();line++)await readLine();
    await guide(core[0]);
    h.checked(`training-first-shift-starts-at-actionable-plan-${keep?'keep':'sale'}`,!await page.locator('[data-dc-tutorial="company-name"]').count()
      &&!await page.locator('.dct-overlay[data-step-id^="beginner.claim."]').count());
    await quote(page);await guide(core[1]);
    await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).active_step_id).toBe(core[1]);

    if(!keep){
      // The same pending company and real quote are inspected in every supported
      // layout before any dispatch. No fake job or economic state is injected.
      for(const [width,height,theme,motion] of h.visualCases??[]){
        const peer=await h.setup(width,height,theme,motion,{isMobile:width<900});
        await h.go(peer.page,{run,theme});await h.expect(peer.page.locator('.dct-overlay')).toHaveAttribute('data-step-id',core[1]);
        await quote(peer.page);await assertGuideTarget(peer.page,h,`first-shift-quote-${width}x${height}-${theme}-${motion}`);
        await h.fit(peer.page,`training-first-shift-quote-${width}x${height}-${theme}-${motion}`);await h.shot(peer.page,`training-first-shift-quote-${width}x${height}-${theme}-${motion}`);
        await peer.context.close();
      }
      await page.bringToFront();
    }
    const dispatch=await quote(page);
    await dispatch.getByRole('button',{name:'Dispatch crew',exact:true}).click();
    await guide(core[2]);
    let snapshot=await h.rpc(page,'dc_get');const job=snapshot.expeditions.find(value=>value.status==='active');
    h.checked(`training-one-real-thirty-second-shift-${keep?'keep':'sale'}`,job?.tutorial===true&&job.duration_seconds===30&&snapshot.company.cash===173
      &&snapshot.workers.every(worker=>worker.energy===5)&&job.cargo===null);
    if(!keep){
      await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).active_step_id).toBe(core[2]);
      await h.reloadCompany(page);await guide(core[2]);
      const peer=await h.setup(390,844,'dark','reduce',{isMobile:true});await h.go(peer.page,{run});
      await h.expect(peer.page.locator('.dct-overlay')).toHaveAttribute('data-step-id',core[2]);
      const resumed=await h.rpc(peer.page,'dc_get');
      h.checked('training-first-shift-reload-and-second-device-keep-the-identical-paid-job',resumed.expeditions.length===1&&resumed.expeditions[0].id===job.id
        &&resumed.company.cash===173&&resumed.workers.every(worker=>worker.energy===5));
      await peer.context.close();await page.bringToFront();
    }
    // Both paths use the real30-second server window. No advance_job command
    // accelerates mining work or educational proof here.
    await h.expect.poll(async()=>(await h.rpc(page,'dc_get')).expeditions.find(value=>value.id===job.id)?.status,{timeout:45000,intervals:[1000,2000]}).toBe('ready');
    snapshot=await h.rpc(page,'dc_get');
    h.checked(`training-first-shift-real-elapsed-return-${keep?'keep':'sale'}`,Date.parse(snapshot.server_now)-Date.parse(job.started_at)>=30000&&snapshot.expeditions.length===1);
    // Normal query refresh can already open the actual returned haul. Refresh
    // only when that foreground transition has not happened yet.
    const refresh=page.getByRole('button',{name:'Refresh company',exact:true});
    if(await refresh.isVisible())await refresh.click();
    await guide(core[3]);
    await h.expect(page.getByRole('button',{name:'Collect into storage',exact:true})).toBeVisible();
    await h.fit(page,`training-first-shift-collect-${keep?'keep':'sale'}`);await h.shot(page,`training-first-shift-collect-${keep?'keep':'sale'}`);
    await page.getByRole('button',{name:'Collect into storage',exact:true}).click();
    await h.expect(page.getByRole('dialog',{name:'Haul secured.',exact:true})).toBeVisible();
    h.checked(`training-collection-receipt-stays-open-until-dismissed-${keep?'keep':'sale'}`,await page.getByRole('dialog',{name:'Haul secured.',exact:true}).isVisible());
    await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).active_step_id).toBe(core[3]);
    await closeReceipt('Haul secured.');await guide(core[4]);
    const collected=economics(await h.rpc(page,'dc_get'));
    if(keep){
      await h.expect(page.getByRole('button',{name:'Keep materials',exact:true})).toBeVisible();
      await h.fit(page,'training-keep-materials-choice-small-phone');await h.shot(page,'training-keep-materials-choice-small-phone');
      await page.getByRole('button',{name:'Keep materials',exact:true}).click();await guide(core[5]);
      h.assert.deepEqual(economics(await h.rpc(page,'dc_get')),collected);
      await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).reviewed_lessons.includes('beginner.sale')).toBe(true);
      const notes=await h.rpc(page,'dc_tutorial_get');
      h.checked('training-keeping-ore-records-review-without-a-fake-sale',notes.reviewed_lessons.includes('beginner.sale')&&!notes.practiced_lessons.includes('beginner.sale')
        &&!(await h.command(page,'calls')).some(call=>call.name==='dc_sell'));
    }else{
      await page.getByRole('button',{name:'Sell Coal',exact:true}).click();
      await page.getByRole('spinbutton',{name:'Quantity to sell',exact:true}).fill('5');
      await page.getByRole('button',{name:'Confirm sale',exact:true}).click();
      await h.expect(page.getByRole('dialog',{name:'Trade recorded.',exact:true})).toBeVisible();
      await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).active_step_id).toBe(core[4]);
      await closeReceipt('Trade recorded.');await guide(core[5]);
    }
    await inspectBuilding(page);
    await assertGuideTarget(page,h,`first-shift-upgrade-${keep?'keep':'sale'}`);
    await h.fit(page,`training-first-shift-upgrade-${keep?'keep':'sale'}`);await h.shot(page,`training-first-shift-upgrade-${keep?'keep':'sale'}`);
    await page.getByRole('button',{name:'Next tutorial step',exact:true}).click();
    for(let line=0;line<8&&!await page.getByRole('region',{name:'First shift guide complete',exact:true}).isVisible();line++){
      await h.expect(page.locator('[data-dialogue-scene]:visible')).toHaveCount(1);await readLine();
    }
    await h.expect(page.getByRole('region',{name:'First shift guide complete',exact:true})).toBeVisible();
    await h.expect.poll(async()=>(await h.rpc(page,'dc_tutorial_get')).campaign_status).toBe('completed');
    const progress=await h.rpc(page,'dc_tutorial_get');snapshot=await h.rpc(page,'dc_get');
    h.checked(`training-six-step-guide-leaves-optional-topics-honest-${keep?'keep':'sale'}`,core.every(id=>visited.has(id))
      &&optional.every(id=>!progress.reviewed_lessons.includes(id)&&!progress.practiced_lessons.includes(id))&&!progress.skipped_lessons.length);
    h.checked(`training-only-real-work-gets-practical-marks-${keep?'keep':'sale'}`,['beginner.claim','beginner.descent','beginner.waiting','beginner.haul'].every(id=>progress.practiced_lessons.includes(id))
      &&progress.practiced_lessons.includes('beginner.sale')===!keep&&!progress.practiced_lessons.includes('beginner.upgrade'));
    h.checked(`training-completion-adds-no-fictitious-rewards-${keep?'keep':'sale'}`,snapshot.company.cash===(keep?173:193)&&snapshot.resources.coal===(keep?10:5)
      &&snapshot.resources.stone===12&&snapshot.workers.length===3&&snapshot.workers.every(worker=>worker.energy===5&&!worker.name.includes('Gus'))&&snapshot.expeditions.length===1);
    const calls=await h.command(page,'calls');
    h.checked(`training-only-authorized-first-shift-economic-actions-${keep?'keep':'sale'}`,calls.filter(call=>call.name==='dc_bootstrap').length===1
      &&calls.filter(call=>call.name==='dc_dispatch_operation').length===1&&calls.filter(call=>call.name==='dc_collect').length===1
      &&calls.filter(call=>call.name==='dc_sell').length===(keep?0:1)
      &&!calls.some(call=>['dc_upgrade','dc_hire','dc_train','dc_start_production','dc_resolve_discovery','dc_set_social_preferences','dc_contribute_project','dc_claim_project'].includes(call.name)));
    if(keep)h.checked('training-kept-stock-ending-never-claims-a-sale',narrative.has('graduation.review.01')&&!narrative.has('graduation.sale.01'));
    else h.checked('training-human-handover-uses-played-retirement-and-earned-sale-dialogue',narrative.get('opening.deed.02')?.includes('retiring')
      &&narrative.get('graduation.sale.01')?.includes('made a sale')&&![...narrative.keys()].some(id=>id.startsWith('chapter.')));
    await h.fit(page,`training-first-shift-complete-${keep?'keep':'sale'}`);await h.shot(page,`training-first-shift-complete-${keep?'keep':'sale'}`);
    await page.getByRole('button',{name:'Continue Mining',exact:true}).click();
    await h.clearDialogs(page);
    const pendingFinds=(await h.rpc(page,'dc_get')).discovery_summary?.pending??0;
    await h.expect(page.getByRole('button',{name:pendingFinds?`Review finds · ${pendingFinds}`:'Review camp upgrades',exact:true})).toBeVisible();
    if(pendingFinds){
      await page.getByRole('button',{name:'Open camp buildings',exact:true}).click();
      await h.expect(page.getByRole('dialog',{name:'Buildings',exact:true})).toBeVisible();
      await h.clearDialogs(page);
      h.checked(`training-pending-find-keeps-upgrades-accessible-${keep?'keep':'sale'}`,true);
    }
    await h.expect(page.getByRole('button',{name:'Sell first haul',exact:true})).toHaveCount(0);
    h.checked(`training-upgrade-cue-does-not-require-emptying-the-warehouse-${keep?'keep':'sale'}`,snapshot.resources.coal>0&&snapshot.resources.stone>0);
    if(!keep){
      const beforeHelp=economics(await h.rpc(page,'dc_get'));
      const file=await h.workerFile(page,'Mara Flint','Overview');await file.getByRole('button',{name:'Help: Worker skills',exact:true}).click();
      await h.expect(journal(page).locator('[data-journal-detail="workforce.stats"]')).toBeVisible();
      h.checked('training-contextual-worker-help-opens-the-matching-optional-topic',true);
      await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();await h.clearDialogs(page);
      await h.officeView(page,'Company');await page.getByRole('button',{name:'Ask Gus',exact:true}).click();
      const advice=page.getByRole('region',{name:'Ask Gus',exact:true});await h.expect(advice).toBeVisible();
      h.checked('training-gus-advice-stays-bounded-and-uses-real-company-records',await advice.getByRole('article').count()<=4);
      await h.fit(page,'training-ask-gus');await h.shot(page,'training-ask-gus');
      await advice.getByRole('button',{name:'Open related lesson',exact:true}).first().click();await h.expect(journal(page).locator('[data-journal-detail]')).toBeVisible();
      await journal(page).getByRole('button',{name:'Close Training Journal',exact:true}).click();await h.clearDialogs(page);
      h.assert.deepEqual(economics(await h.rpc(page,'dc_get')),beforeHelp);
      h.checked('training-contextual-help-and-gus-never-alter-company-state',true);
      await h.tab(page,'Settings');await page.getByRole('button',{name:'Return to Main Menu',exact:true}).click();await h.expect(title(page)).toBeVisible();
      const before=economics(await h.rpc(page,'dc_get'));await h.continueCompany(page);h.assert.deepEqual(economics(await h.rpc(page,'dc_get')),before);
      h.checked('training-completed-guide-stays-completed-after-title-and-continue',!(await page.locator('.dct-overlay').count()));
    }
    await context.close();
  }
  await runFirstShift({run:'training-guided-first-shift-sale'});
  await runFirstShift({run:'training-guided-first-shift-keep',keep:true});
  console.log('PASS Deep Claim six-stage first-shift guide, native30-second returns, partial sale and retained-stock paths');
}
