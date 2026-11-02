// Actual production Page/hooks/RPCs. Only the explicitly labeled old late-game
// preconditions use fixture-owner setup; every new mineral and item is earned
// through paid dispatch, finite collection and real production below.
export async function runPhase7Browser(h) {
  const { expect, checked, fit, shot, assert } = h;
  const { context, page } = await h.setup(390,844,'dark','no-preference',{runtimeProbe:true,deviceScaleFactor:2,isMobile:true});
  const current=()=>h.rpc(page,'dc_get');
  const diagnostic=()=>page.evaluate(()=>window.deepClaimRuntime.samples.at(-1));
  async function refresh(){await page.getByRole('button',{name:'Refresh company',exact:true}).click();await expect(page.getByRole('button',{name:'Refresh company',exact:true})).toBeEnabled();}
  async function shaft(){await h.clearDialogs(page);await h.tab(page,'Surface');await page.getByRole('button',{name:'Open camp buildings',exact:true}).click();await page.getByRole('dialog',{name:'Buildings',exact:true}).getByRole('button',{name:/Mine Shaft/}).click();return page.getByRole('dialog',{name:'Mine Shaft',exact:true});}
  async function plan(mode,point,{confirm=false}={}){
    const dialog=await h.operationPlan(page,mode,{...point,review:false,workers:['Mara Flint']});
    await dialog.getByRole('group',{name:'Shift duration',exact:true}).getByRole('button',{name:/Standard/}).click();
    await dialog.getByRole('button',{name:'Review dispatch',exact:true}).click();
    await expect(dialog.getByRole('region',{name:'Heat and lift modifiers',exact:true})).toBeVisible();
    await expect(dialog.getByRole('button',{name:'Dispatch crew',exact:true})).toBeEnabled();
    if(confirm){await dialog.getByRole('button',{name:'Dispatch crew',exact:true}).click();await expect(dialog).toHaveCount(0);}
    return dialog;
  }
  async function complete(point,mode='Exploration'){
    await plan(mode,point,{confirm:true});let snapshot=await current();const job=snapshot.expeditions.find(job=>job.status==='active');assert.ok(job);
    checked(`deep-paid-config7-job-${mode}-${point.y}`,job.config_version===7&&job.cargo===null&&job.deep_modifiers?.lift_discount_percent>0,job.deep_modifiers);
    await h.command(page,'advance_job',{job_id:job.id,seconds:job.duration_seconds+1});await refresh();
    await page.getByRole('button',{name:'Open haul',exact:true}).click();await page.getByRole('button',{name:'Collect into storage',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Haul secured.',exact:true})).toBeVisible();await h.closeReward(page);
    return {snapshot:await current(),job};
  }
  try{
    await h.found(page,{run:'ancient-deep-controlled-old-history'});
    const setup=await h.command(page,'prepare_ancient_deep');await h.reloadCompany(page);await expect(page.getByRole('tablist',{name:'Company views'})).toBeVisible();
    let snapshot=await current();checked('deep-late-game-preconditions-are-explicit-and-new-goods-remain-zero',snapshot.schema_version===5&&snapshot.buildings.find(building=>building.key==='mine_shaft').level===5&&['nickel_ore','sulfur','nickel_alloy'].every(key=>snapshot.resources[key]===0),{scope:setup.scope});
    checked('deep-addon-is-not-decoded-for-an-old-depth-company',(await diagnostic())?.addon?.state!=='ready');
    let dialog=await shaft();await expect(dialog.getByRole('region',{name:'Ancient Deep shaft requirements',exact:true})).toBeVisible();await expect(dialog.getByRole('button',{name:'Confirm upgrade',exact:true})).toBeDisabled();
    await fit(page,'deep-research-gated-shaft');await shot(page,'deep-research-gated-shaft');
    await dialog.getByRole('button',{name:'Review deep research',exact:true}).click();
    const office=page.getByRole('dialog',{name:'Company Office',exact:true});await expect(office.getByRole('heading',{name:'Deep Cutting Systems',exact:true})).toBeVisible();
    await office.getByRole('button',{name:'Start research',exact:true}).click();await expect(page.getByRole('dialog',{name:'Research underway.',exact:true})).toBeVisible();await h.closeReward(page);
    snapshot=await current();const research=snapshot.business_catalog.research.find(node=>node.key==='deep_operations_2');await h.command(page,'advance_research',{research_key:research.key,seconds:research.duration_seconds+1});await refresh();
    snapshot=await current();const beforeUpgrade=snapshot.company.cash;dialog=await shaft();await expect(dialog.getByRole('button',{name:'Confirm upgrade',exact:true})).toBeEnabled();await dialog.getByRole('button',{name:'Confirm upgrade',exact:true}).click();await expect(page.getByRole('dialog',{name:'Mine Shaft upgraded.',exact:true})).toBeVisible();await h.closeReward(page);
    snapshot=await current();checked('deep-actual-paid-shaft-six-opens999-and192-infrastructure-cap',snapshot.world.max_depth===999&&snapshot.company.cash===beforeUpgrade-24000&&snapshot.deep_operations.infrastructure_capacity===192);
    await expect.poll(async()=>(await diagnostic())?.addon?.state).toBe('ready');await expect.poll(async()=>(await diagnostic())?.addon?.draws||0).toBeGreaterThan(0);
    checked('deep-authored-addon-decodes-only-after-public-depth-unlock',(await diagnostic()).addon.decodedBytes===786432,(await diagnostic()).addon);
    await h.tab(page,'Mine');await page.getByRole('button',{name:'Open mine operations',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Underground operations',exact:true});const depth=dialog.getByRole('group',{name:'Known mine depth',exact:true});
    const depths=await depth.locator('[data-dc-depth]').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.dcDepth)));
    const known=new Set(snapshot.world.tiles.filter(tile=>tile.y>0&&tile.remaining===0).map(tile=>tile.y));
    checked('deep-navigator-lists-only-actual-known-passages',known.size>500&&depths.length>0&&depths.length<=7&&depths.every(value=>Number.isInteger(value)&&value<=956&&known.has(value))&&!depths.includes(999));
    await dialog.getByRole('searchbox',{name:'Find depth',exact:true}).fill('999m');await expect(depth.locator('[data-dc-depth="999"]')).toHaveCount(0);
    await dialog.getByRole('searchbox',{name:'Find depth',exact:true}).fill('800m');const stop=depth.locator('[data-dc-depth="800"]');await stop.click();await expect(stop).toHaveAttribute('aria-pressed','true');
    await dialog.getByRole('button',{name:'Locate known depth',exact:true}).click();await expect.poll(async()=>(await diagnostic())?.camera?.y||0).toBeGreaterThan(790);
    await fit(page,'deep-known-depth-navigation');await shot(page,'deep-known-depth-navigation');
    const nickel=await h.command(page,'deep_worksite',{resource:'nickel_ore'}),sulfur=await h.command(page,'deep_worksite',{resource:'sulfur'});assert.ok(nickel&&sulfur,'Current private seeded geology needs a legal paid nickel and sulfur worksite');
    dialog=await plan('Exploration',nickel);const beforeProtection=await h.rpc(page,'dc_preview_operation',{p_worker_ids:[snapshot.workers.find(worker=>worker.name==='Mara Flint').id],p_mode:'explore',p_target_x:nickel.x,p_target_y:nickel.y,p_duration_minutes:60,p_tutorial:false,p_infrastructure_key:null});
    checked('deep-quote-explains-real-weighted-lift-and-productive-work-penalty',beforeProtection.deep_modifiers.lift_discount_percent>0&&beforeProtection.deep_modifiers.lift_discount_percent<=75&&beforeProtection.deep_modifiers.heat_penalty_percent>0&&beforeProtection.deep_modifiers.effective_work_seconds<beforeProtection.deep_modifiers.raw_work_seconds,beforeProtection.deep_modifiers);
    for(const [width,height] of [[320,568],[844,390],[390,844]]){await page.setViewportSize({width,height});await fit(page,`deep-quote-${width}x${height}`);await shot(page,`deep-quote-${width}x${height}`);}
    await h.clearDialogs(page);
    let completed=await complete(nickel);snapshot=completed.snapshot;checked('deep-nickel-stock-comes-from-actual-finite-return',snapshot.resources.nickel_ore>=9&&snapshot.world.tiles.some(tile=>tile.x===nickel.x&&tile.y===nickel.y&&tile.material==='nickel_ore'&&tile.remaining<tile.initial_amount));
    completed=await complete(sulfur);snapshot=completed.snapshot;checked('deep-sulfur-stock-comes-from-actual-finite-return',snapshot.resources.sulfur>=4&&snapshot.world.tiles.some(tile=>tile.x===sulfur.x&&tile.y===sulfur.y&&tile.material==='sulfur'&&tile.remaining<tile.initial_amount));
    const mined=snapshot.resources.nickel_ore;for(let index=0;index<3;index++)snapshot=await h.processRecipe(page,'smelt_nickel_alloy',{loseAcknowledgement:index===0});
    checked('deep-real-nickel-inputs-create-three-collected-alloys',snapshot.resources.nickel_alloy===3&&snapshot.resources.nickel_ore===mined-9);
    snapshot=await h.processRecipe(page,'craft_nickel_heatshield');const item=snapshot.equipment.find(item=>item.definition_key==='nickel_heatshield');assert.ok(item);checked('deep-shield-is-one-actually-crafted-owned-head-item',item.worker_id===null&&item.durability===180&&snapshot.resources.nickel_alloy===1);
    let file=await h.workerFile(page,'Mara Flint','Gear');await file.getByRole('button',{name:'Equip Nickel Heat Shield',exact:true}).click();await page.getByRole('button',{name:'Confirm equipment',exact:true}).click();await h.closeReward(page);
    snapshot=await current();const worker=snapshot.workers.find(worker=>worker.name==='Mara Flint');
    const protectedQuote=await h.rpc(page,'dc_preview_operation',{p_worker_ids:[worker.id],p_mode:'extract',p_target_x:nickel.x,p_target_y:nickel.y,p_duration_minutes:60,p_tutorial:false,p_infrastructure_key:null});
    checked('deep-working-assigned-shield-reduces-heat-by-fifteen-points',protectedQuote.deep_modifiers.gear_mitigation_percent===15&&protectedQuote.deep_modifiers.heat_penalty_percent===Math.max(0,beforeProtection.deep_modifiers.heat_penalty_percent-15),protectedQuote.deep_modifiers);
    dialog=await plan('Extraction',nickel);await page.emulateMedia({forcedColors:'active'});
    // The system palette can transition from the previous colors. Use the
    // existing finite-animation settle before measuring final opaque surfaces.
    await fit(page,'deep-forced-colors-review');
    const forced=await dialog.evaluate(node=>{
      const button=[...node.querySelectorAll('button')].find(value=>value.textContent?.trim()==='Dispatch crew');
      const colors=value=>{const parts=value.match(/[\d.]+/g)?.map(Number);return parts&&parts.length>=3?{rgb:parts.slice(0,3),alpha:parts.length>3?parts[3]:1}:null;};
      const luminance=rgb=>rgb.map(value=>{const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
      if(!button)return {missing_button:true};
      const surface=getComputedStyle(node),primary=getComputedStyle(button),bg=colors(primary.backgroundColor),fg=colors(primary.color),dialogBg=colors(surface.backgroundColor);
      const a=bg?luminance(bg.rgb):0,b=fg?luminance(fg.rgb):0;
      return {forced:matchMedia('(forced-colors: active)').matches,dialog_background:surface.backgroundColor,dialog_opaque:dialogBg?.alpha===1,
        button_background:primary.backgroundColor,button_text:primary.color,button_opaque:bg?.alpha===1,button_adjust:primary.forcedColorAdjust,
        descendant_adjust:[...button.querySelectorAll('*')].map(child=>getComputedStyle(child).forcedColorAdjust),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),
        text:[...node.querySelectorAll('h2,h3,.dcl-deep-modifiers span,.dcl-deep-modifiers strong,.dcl-deep-modifiers small')].map(child=>{
          const style=getComputedStyle(child),ink=colors(style.color),fill=colors(style.webkitTextFillColor);const paper=dialogBg?luminance(dialogBg.rgb):1,light=ink?luminance(ink.rgb):1;
          return {label:child.textContent?.trim(),color:style.color,fill:style.webkitTextFillColor,opacity:style.opacity,contrast:(Math.max(paper,light)+.05)/(Math.min(paper,light)+.05),fill_visible:fill?.alpha>0};
        })};
    });
    checked('deep-forced-colors-dialog-and-primary-remain-opaque-and-legible',forced.forced&&forced.dialog_opaque&&forced.button_opaque&&forced.button_adjust==='none'&&forced.descendant_adjust.every(value=>value==='none')&&forced.contrast>=4.5,forced);
    checked('deep-forced-colors-heading-and-operation-instructions-remain-readable',forced.text.length>=6&&forced.text.every(value=>value.contrast>=4.5&&value.fill_visible&&value.opacity==='1'),forced.text);
    await shot(page,'deep-forced-colors-review');await page.emulateMedia({forcedColors:'none'});await h.clearDialogs(page);
    completed=await complete(nickel,'Extraction');snapshot=completed.snapshot;const worn=snapshot.equipment.find(value=>value.id===item.id);checked('deep-shield-protection-is-frozen-and-wears-once-on-return',worn.durability===176&&snapshot.expeditions.find(job=>job.id===completed.job.id).deep_modifiers.gear_mitigation_percent===15);
    const beforeRepair={cash:snapshot.company.cash,alloy:snapshot.resources.nickel_alloy,sulfur:snapshot.resources.sulfur,cost:worn.repair_cost};
    file=await h.workerFile(page,'Mara Flint','Gear');await file.getByRole('button',{name:'Repair Nickel Heat Shield',exact:true}).click();await page.getByRole('button',{name:'Confirm repair',exact:true}).click();await h.closeReward(page);snapshot=await current();
    checked('deep-paid-repair-consumes-real-alloy-and-sulfur-once',snapshot.equipment.find(value=>value.id===item.id).durability===180&&snapshot.company.cash===beforeRepair.cash-beforeRepair.cost&&snapshot.resources.nickel_alloy===beforeRepair.alloy-1&&snapshot.resources.sulfur===beforeRepair.sulfur-2);
    await h.reloadCompany(page);await expect(page.getByRole('tablist',{name:'Company views'})).toBeVisible();const restored=await current();checked('deep-reload-preserves-the-same-owned-repaired-item-and-new-stock',restored.equipment.filter(value=>value.id===item.id).length===1&&restored.equipment.find(value=>value.id===item.id).durability===180&&restored.resources.sulfur===snapshot.resources.sulfur);
    await context.close();
  }catch(error){throw error;}
  const fallback=await h.setup(320,568,'light','reduce',{runtimeProbe:true,deviceScaleFactor:2,isMobile:true});
  try{
    await fallback.page.route('**/deep-claim/atlas-v2.png*',route=>route.abort('failed'));await h.found(fallback.page,{run:'ancient-deep-addon-failure'});await h.command(fallback.page,'prepare_ancient_deep',{unlock:true});await h.reloadCompany(fallback.page);
    await expect.poll(()=>fallback.page.evaluate(()=>window.deepClaimRuntime.samples.at(-1)?.addon?.state)).toBe('failed');
    await h.tab(fallback.page,'Mine');await fit(fallback.page,'deep-addon-fallback-phone');await shot(fallback.page,'deep-addon-fallback-phone');await fallback.page.getByRole('button',{name:'Open mine operations',exact:true}).click();await expect(fallback.page.getByRole('dialog',{name:'Underground operations',exact:true})).toBeVisible();
    checked('deep-addon-failure-keeps-real-known-depth-and-operation-controls',await fallback.page.getByRole('group',{name:'Known mine depth',exact:true}).isVisible());await fallback.context.close();
  }catch(error){throw error;}
  console.log('PASS Deep Claim Ancient Deep paid vertical slice and addon recovery');
}
