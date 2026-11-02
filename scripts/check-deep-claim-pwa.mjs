// Real built application bootstrap on localhost. No auth stubs, remote services,
// installed-device claim, push delivery, or production data writes.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';

const artifacts=process.env.DEEP_CLAIM_PWA_OUTPUT||await mkdtemp(join(tmpdir(),'deep-claim-pwa-'));
const report={checks:[],errors:[],runtimeErrors:[],artifacts,externalRequestsBlocked:0,
  notificationPermissionRequests:0,notificationPermissionBaselines:[],
  scope:'Real production build on local Chromium; unauthenticated. No external network, player records, OS installation or physical-device verification.'};
let server,browser,page;
const check=(label,condition,detail)=>{report.checks.push({label,ok:Boolean(condition),...(detail?{detail}:{})});assert.ok(condition,label);};
console.log('Deep Claim production PWA artifacts:',artifacts);
try{
  server=await preview({root:resolve('.'),preview:{host:'127.0.0.1',port:8107,strictPort:true}});
  browser=await chromium.launch({executablePath:process.env.DEEP_CLAIM_QA_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,serviceWorkers:'allow'});
  await context.exposeBinding('__deepClaimPwaPermissionObserved',(_source,event)=>{
    if(event.operation==='request')report.notificationPermissionRequests++;
    else if(event.operation==='baseline')report.notificationPermissionBaselines.push(event.permission);
  });
  await context.addInitScript(()=>{
    const probe={baseline:typeof Notification==='function'?Notification.permission:'unsupported',requests:0,wrapped:false};
    window.deepClaimPwaPermissionProbe=probe;
    void window.__deepClaimPwaPermissionObserved({operation:'baseline',permission:probe.baseline}).catch(()=>{});
    if(typeof Notification==='function'&&typeof Notification.requestPermission==='function'){
      const nativeRequest=Notification.requestPermission;
      Notification.requestPermission=function(...args){
        probe.requests++;
        void window.__deepClaimPwaPermissionObserved({operation:'request',permission:Notification.permission}).catch(()=>{});
        return Reflect.apply(nativeRequest,this,args);
      };
      probe.wrapped=Notification.requestPermission!==nativeRequest;
    }
  });
  await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();report.externalRequestsBlocked++;return route.abort();});
  page=await context.newPage();page.on('pageerror',error=>report.runtimeErrors.push(error.message));
  await page.goto('http://127.0.0.1:8107/deep-claim?source=pwa-qa',{waitUntil:'load'});
  await expect.poll(()=>new URL(page.url()).pathname,{timeout:20000}).toBe('/auth');
  check('production-cold-deep-link-retains-existing-authentication-boundary',true);
  const metadata=await page.evaluate(()=>({viewport:document.querySelector('meta[name="viewport"]')?.getAttribute('content'),manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href'),apple:document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),theme:document.querySelector('meta[name="theme-color"]')?.getAttribute('content')}));
  check('production-index-declares-covered-and-resizable-mobile-viewport',metadata.viewport?.includes('viewport-fit=cover')&&metadata.viewport.includes('interactive-widget=resizes-content'),metadata);
  const response=await page.request.get('http://127.0.0.1:8107'+metadata.manifest);assert.equal(response.status(),200);const manifest=await response.json();
  check('production-manifest-declares-a-scoped-standalone-app-with-protected-start-url',manifest.scope==='/'&&manifest.display==='standalone'&&manifest.orientation==='any'&&manifest.start_url.startsWith('/dashboard'),{scope:manifest.scope,display:manifest.display,start_url:manifest.start_url});
  for(const icon of manifest.icons){const image=await page.request.get('http://127.0.0.1:8107'+icon.src);assert.equal(image.status(),200);const bytes=await image.body();assert.equal(bytes.toString('ascii',12,16),'IHDR');const size=`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;check(`production-pwa-icon-decodes-at-declared-size-${icon.src}`,icon.sizes.split(' ').includes(size),{declared:icon.sizes,actual:size,purpose:icon.purpose});}
  await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(reg=>reg.active?.scriptURL).filter(Boolean)),{timeout:20000}).toContainEqual(expect.stringMatching(/127\.0\.0\.1:8107\/sw-push\.js\?v=/));
  const worker=await page.evaluate(async()=>({registrations:(await navigator.serviceWorker.getRegistrations()).map(reg=>({scope:reg.scope,script:reg.active?.scriptURL})),caches:await caches.keys(),permission:Notification.permission,permission_probe:window.deepClaimPwaPermissionProbe,standalone:matchMedia('(display-mode: standalone)').matches}));
  check('production-bootstrap-registers-actual-versioned-push-only-worker',worker.registrations.some(reg=>reg.scope==='http://127.0.0.1:8107/'&&reg.script?.includes('/sw-push.js?v=')),worker);
  check('production-app-does-not-request-notification-permission-on-cold-launch',worker.permission_probe.wrapped&&worker.permission_probe.requests===0&&report.notificationPermissionRequests===0,{baseline_permission:worker.permission_probe.baseline,current_permission:worker.permission,document_request_calls:worker.permission_probe.requests,total_request_calls:report.notificationPermissionRequests});
  const sw=await page.request.get('http://127.0.0.1:8107/sw-push.js');const script=await sw.text();
  check('production-worker-keeps-network-fresh-instead-of-caching-game-or-api-responses',!/addEventListener\(\s*['"]fetch['"]/.test(script)&&worker.caches.length===0,{cache_names:worker.caches});
  await page.screenshot({path:join(artifacts,'production-authenticated-boundary-mobile.png')});
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:join(artifacts,'production-auth-boundary-landscape.png')});
  const layout=await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth>innerWidth+2,dpr:devicePixelRatio,visualViewport:visualViewport?{width:visualViewport.width,height:visualViewport.height}:null}));
  check('production-mobile-rotation-has-no-horizontal-overflow',!layout.horizontal&&layout.dpr===2,layout);
  check('production-bootstrap-has-no-unhandled-browser-errors',report.runtimeErrors.length===0,report.runtimeErrors);
  console.log(`PASS production PWA smoke: ${report.checks.length} checks; display-mode standalone observed=${worker.standalone}.`);
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;console.error(error);if(page)await page.screenshot({path:join(artifacts,'failure.png')}).catch(()=>{});}
finally{await writeFile(join(artifacts,'report.json'),JSON.stringify(report,null,2));console.log('Report:',join(artifacts,'report.json'));await browser?.close();await new Promise(resolve=>server?.httpServer?server.httpServer.close(resolve):resolve());}
