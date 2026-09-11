// Actual React/CSS components + actual inbox hook. Mock backend, no live writes.
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const output=await mkdtemp(join(tmpdir(),'dh-mobile-home-'));
console.log(`Screenshots: ${output}`);
const server=await createServer({server:{host:'127.0.0.1',port:8094,strictPort:true},mode:'test'});
let browser;
try {
  await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
  page.on('requestfailed',request=>{if(new URL(request.url()).hostname==='127.0.0.1')console.error('Local request failed:',request.url(),request.failure()?.errorText);});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.route('**/src/contexts/AuthContext.tsx*',route=>route.fulfill({contentType:'text/javascript',body:'export const useAuth=()=>({user:{id:"member"}});'}));
  await page.route('**/src/contexts/ClubContext.tsx*',route=>route.fulfill({contentType:'text/javascript',body:'export const useClub=()=>({club:{id:"club"}});'}));
  await page.route('**/src/integrations/supabase/client.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
    import {createNotificationBackend,notificationRow} from '/src/test/fixtures/notificationBackend.ts';
    window.qa=createNotificationBackend(Array.from({length:128},(_,n)=>notificationRow(n+1)));
    window.qa.rows[127].body='A long notification about your next turn, standings, and the club’s latest activity. This should wrap cleanly on every phone.';
    export const supabase=window.qa;`}));
  const bell=()=>page.getByRole('button',{name:/^Notifications(?: \(|$)/});
  const panel=()=>page.getByRole('dialog',{name:'Notifications',exact:true});
  const withinViewport=async(locator,label)=>{
    await expect.poll(async()=>{
      const rect=await locator.boundingBox(),size=page.viewportSize();
      return !!rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=size.width+1&&rect.y+rect.height<=size.height+1;
    },{message:label+' stays within viewport'}).toBe(true);
    await locator.evaluate(async element=>{
      await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{})));
    });
  };
  const viewports=process.argv.includes('--quick')?[[375,812]]:[[320,740],[375,812],[412,915],[768,1024],[568,320],[1280,900]];
  for(const [width,height] of viewports)for(const theme of ['light','dark']){
    console.log(`Checking ${width}×${height} ${theme}`);
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:8094/scripts/fixtures/mobile-home.html',{waitUntil:'domcontentloaded',timeout:60_000});
    await page.evaluate(theme=>{document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);localStorage.clear();},theme);
    await page.getByRole('heading',{name:'Hey, Alex.'}).waitFor({timeout:60_000});
    await page.getByRole('button',{name:'Notifications (128 unread)',exact:true}).waitFor();
    // Theme changes transition on buttons. Inspect settled colors, not an
    // intermediate dark-to-light frame with misleading contrast.
    await page.evaluate(async()=>{
      await new Promise(requestAnimationFrame);
      await Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
    });
    const tabContrast=await page.getByRole('tab',{name:'Latest',exact:true}).evaluate(element=>{
      const luminance=color=>{
        const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
        return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
      };
      const style=getComputedStyle(element),ink=luminance(style.color),surface=luminance(style.backgroundColor);
      return (Math.max(ink,surface)+0.05)/(Math.min(ink,surface)+0.05);
    });
    assert.ok(tabContrast>=4.5,`Selected-tab text meets AA contrast in ${theme}: ${tabContrast}`);
    assert.equal(await bell().count(),1,'Only one bell should be mounted');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    const shortcutIcons=await page.locator('.home-shortcut-icon').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().y));
    assert.ok(shortcutIcons.length===4&&shortcutIcons.every(y=>Math.abs(y-shortcutIcons[0])<1),'Shortcut icons align regardless of label wrapping');
    if(width<1024){
      const bounds=await Promise.all([bell(),page.getByRole('link',{name:'Profile',exact:true}),page.getByRole('button',{name:'Open navigation menu'})].map(item=>item.boundingBox()));
      assert.ok(bounds.every(box=>box.width>=44&&box.height>=44&&Math.abs(box.y-bounds[0].y)<1),'Header controls align and have 44px touch targets');
    }
    await page.screenshot({path:join(output,`${width}-${theme}-home.png`)});
    await page.getByRole('tab',{name:'Upcoming',exact:true}).click();
    assert.equal(await page.getByRole('tabpanel').getByText('Sunday watch party').count(),1);
    await page.getByRole('tab',{name:'In progress',exact:true}).click();
    assert.equal(await page.getByRole('tabpanel').getByText('All-time movie villains').count(),1);
    // Scroll home before opening: popover must stay anchored to sticky header.
    await bell().click();await panel().waitFor();await withinViewport(panel(),'Notification panel');
    assert.ok(await panel().locator('[aria-busy]').evaluate(el=>el.clientHeight>0&&el.scrollHeight>el.clientHeight),'Inbox list must remain scrollable');
    await withinViewport(page.getByRole('button',{name:'Open notification inbox'}),'Inbox footer');
    await page.screenshot({path:join(output,`${width}-${theme}-bell.png`)});
    await page.keyboard.press('Escape');await panel().waitFor({state:'hidden'});
    assert.equal(await bell().evaluate(el=>el===document.activeElement),true,'Escape restores trigger focus');
    await page.getByRole('button',{name:'Customize shortcuts'}).click();
    const sheet=page.getByRole('dialog',{name:'Your shortcuts',exact:true});await sheet.waitFor();
    await withinViewport(sheet,'Shortcut sheet');
    await page.screenshot({path:join(output,`${width}-${theme}-shortcuts.png`)});
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await sheet.waitFor({state:'hidden'});
    console.log(`PASS ${width}×${height} ${theme}: alignment, overflow, activity tabs, scrollable bell, focus restore, shortcut sheet`);
  }
  // Six shortcuts, enlarged text/spacing and reduced motion must stay usable.
  await page.setViewportSize({width:320,height:740});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='20px';});
  await page.getByRole('button',{name:'Customize shortcuts'}).click();
  await page.getByRole('button',{name:'Activity Feed',exact:true}).click();
  await page.getByRole('button',{name:'Rune Delve',exact:true}).click();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('dialog',{name:'Your shortcuts',exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.locator('.home-shortcut').count(),6);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Enlarged six-shortcut layout stays within the phone');
  // Use actual keyboard navigation: programmatic focus after a mouse click
  // intentionally does not activate the browser's :focus-visible heuristic.
  await page.getByRole('button',{name:'Customize shortcuts'}).focus();
  await page.keyboard.press('Tab');
  const shortcut=page.locator('.home-shortcut').first();
  assert.equal(await shortcut.evaluate(element=>element===document.activeElement),true);
  assert.equal(await shortcut.evaluate(element=>getComputedStyle(element).outlineStyle),'solid','Keyboard focus remains visible above elevation shadows');
  assert.equal(await shortcut.evaluate(element=>getComputedStyle(element).transitionDuration),'0s','Reduced motion disables home transitions');
  assert.equal(await shortcut.evaluate(element=>getComputedStyle(element).transform),'none','Reduced motion disables hover translation');
  await page.screenshot({path:join(output,'320-dark-large-text-six-shortcuts.png')});
  await page.getByRole('button',{name:'Customize shortcuts'}).click();
  await page.getByRole('button',{name:'Reset shortcuts',exact:true}).click();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('dialog',{name:'Your shortcuts',exact:true}).waitFor({state:'hidden'});
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Live resizing while open: no stale coordinates; then exercise the real hook.
  await page.setViewportSize({width:412,height:915});await bell().click();
  await page.setViewportSize({width:320,height:640});await withinViewport(panel(),'Resized panel');
  await panel().getByRole('button',{name:/Club update 128/}).click();
  await page.getByText('127 unread',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Open notification inbox'}).click();
  await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor();
  await page.getByRole('button',{name:'Dismiss Club update 128',exact:true}).click();
  await page.waitForFunction(()=>!window.qa.rows.some(row=>row.title==='Club update 128'));
  await page.getByRole('button',{name:'Mark all read',exact:true}).click();
  await page.getByRole('button',{name:'Notifications',exact:true}).waitFor();
  await page.getByRole('tab',{name:'Unread',exact:true}).click();
  await page.getByText('No unread notifications',{exact:true}).waitFor();
  await page.screenshot({path:join(output,'320-dark-inbox-empty.png')});
  await bell().click();await page.getByRole('button',{name:'Open notification inbox'}).waitFor();
  await page.getByRole('button',{name:'Close notifications'}).click();
  await page.evaluate(()=>{window.qa.failReads=true;});
  await bell().click();await page.getByRole('button',{name:'Refresh notifications'}).click();
  await panel().getByRole('alert').waitFor();
  await page.evaluate(()=>{window.qa.failReads=false;});
  await panel().getByRole('button',{name:'Try again',exact:true}).click();
  await panel().getByRole('alert').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);console.log(`PASS shared inbox writes and network recovery. Screenshots: ${output}`);
}finally{await browser?.close();await server.close();}
