import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createDeepClaimAudio,deepClaimAudioPreferenceKey,type DeepClaimAudio} from '@/lib/deepClaim/audio';
import {DEEP_CLAIM_AUDIO_BUDGET,DEEP_CLAIM_COMPOSITIONS,deepClaimAudioRegion,deepClaimMaterialTimbre} from '@/lib/deepClaim/audioScore';

class Param{value=0;setValueAtTime=vi.fn((value:number)=>{this.value=value;});exponentialRampToValueAtTime=vi.fn();setTargetAtTime=vi.fn((value:number)=>{this.value=value;});}
class Node{connections:Node[]=[];connect=vi.fn((node:Node)=>{this.connections.push(node);return node;});disconnect=vi.fn();}
class Source extends Node{
 frequency=new Param();type='';buffer:unknown;loop=false;onended:(()=>void)|null=null;ended=false;stopAt=Infinity;kind:'osc'|'noise';
 constructor(kind:'osc'|'noise'){super();this.kind=kind;}
 start=vi.fn();stop=vi.fn((when?:number)=>{this.stopAt=when??-1;if(when===undefined)this.end();});end(){if(this.ended)return;this.ended=true;this.onended?.();}
}
class Gain extends Node{gain=new Param();}
class Filter extends Node{frequency=new Param();Q=new Param();type='';}
const contexts:FakeContext[]=[];
let deferredResume:Promise<void>|null=null;
class FakeContext{
 state:AudioContextState='suspended';currentTime=0;sampleRate=8000;destination=new Node();sources:Source[]=[];gains:Gain[]=[];filters:Filter[]=[];buffers:Float32Array[]=[];onstatechange:(()=>void)|null=null;
 constructor(){contexts.push(this);}
 createGain(){const gain=new Gain();this.gains.push(gain);return gain;}
 createOscillator(){const source=new Source('osc');this.sources.push(source);return source;}
 createBufferSource(){const source=new Source('noise');this.sources.push(source);return source;}
 createBiquadFilter(){const filter=new Filter();this.filters.push(filter);return filter;}
 createBuffer(_channels:number,size:number){const data=new Float32Array(size);this.buffers.push(data);return {length:size,getChannelData:()=>data};}
 resume=vi.fn(async()=>{const waiting=deferredResume;if(waiting)await waiting;if(this.state==='closed')throw new Error('Closed AudioContext');this.state='running';this.onstatechange?.();});
 suspend=vi.fn(async()=>{if(this.state==='closed')return;this.state='suspended';this.onstatechange?.();});
 close=vi.fn(async()=>{this.state='closed';this.onstatechange?.();});
 advance(seconds:number){this.currentTime+=seconds;this.sources.forEach(source=>{if(source.stopAt<=this.currentTime)source.end();});}
}
const controllers:DeepClaimAudio[]=[];
let visibility:DocumentVisibilityState='visible';
const originalVisibility=Object.getOwnPropertyDescriptor(document,'visibilityState');
function audio(id='member-a'){const controller=createDeepClaimAudio(id);controllers.push(controller);return controller;}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
function globalSettings(categories:Partial<Record<'ui'|'combat'|'rewards'|'ambient',boolean>>={},master=true){localStorage.setItem('dh-club-sound-settings-v1',JSON.stringify({master,categories:{ui:true,combat:true,rewards:true,ambient:true,...categories}}));window.dispatchEvent(new StorageEvent('storage',{key:'dh-club-sound-settings-v1'}));}
beforeEach(()=>{
 vi.useFakeTimers();localStorage.clear();contexts.length=0;visibility='visible';deferredResume=null;vi.spyOn(globalThis,'setInterval');vi.spyOn(globalThis,'clearInterval');vi.stubGlobal('AudioContext',FakeContext);Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
});
afterEach(()=>{
 controllers.splice(0).forEach(controller=>controller.dispose());localStorage.clear();vi.restoreAllMocks();vi.useRealTimers();vi.unstubAllGlobals();if(originalVisibility)Object.defineProperty(document,'visibilityState',originalVisibility);else delete (document as unknown as Record<string,unknown>).visibilityState;
});

describe('Deep Claim original authored score and deterministic material palette',()=>{
 it('contains six distinct sixteen-bar written arrangements with melody, bass, pads, rests and answers',()=>{
  const compositions=Object.values(DEEP_CLAIM_COMPOSITIONS);expect(compositions).toHaveLength(6);expect(new Set(compositions.map(score=>score.name)).size).toBe(6);expect(new Set(compositions.map(score=>JSON.stringify(score.events))).size).toBe(6);
  for(const score of compositions){expect(score.beats).toBe(64);expect(score.tempo).toBeGreaterThanOrEqual(64);expect(score.events.length).toBeGreaterThan(80);expect(score.events.every(event=>event.beat>=0&&event.beat<64&&event.midi>0&&event.beats>0&&event.gain<=.03)).toBe(true);expect(score.events.some(event=>event.instrument==='bass')).toBe(true);expect(score.events.some(event=>event.instrument==='pad')).toBe(true);expect(score.events.some(event=>event.instrument==='bell')).toBe(true);expect(score.events.map(event=>event.beat)).toEqual(score.events.map(event=>event.beat).sort((a,b)=>a-b));}
 });
 it('maps public depth and known formation context without any hidden-world or random input',()=>{
  expect([0,49,50,159,160,319,320,599].map(depth=>deepClaimAudioRegion('mine',depth))).toEqual(['shallow','shallow','ironworks','ironworks','crystal','crystal','forgotten','forgotten']);expect(deepClaimAudioRegion('surface',599)).toBe('surface');
  expect([600,608,999,1000].map(depth=>deepClaimAudioRegion('mine',depth))).toEqual(['ancient_deep','ancient_deep','ancient_deep','forgotten']);expect(deepClaimAudioRegion('surface',999)).toBe('surface');
  expect(['stone','clay','coal','iron_ore','quartz'].map(material=>deepClaimMaterialTimbre(material).kind)).toEqual(['stone','earth','carbon','metal','crystal']);expect(deepClaimMaterialTimbre('unrevealed')).toEqual(deepClaimMaterialTimbre('stone'));
  expect(deepClaimMaterialTimbre('nickel_ore').kind).toBe('metal');expect(deepClaimMaterialTimbre('sulfur').kind).toBe('earth');
 });
});

describe('Deep Claim gesture-only preferences and bounded mix buses',()=>{
 it('creates no context on construction, persisted opt-in, scene changes, settings updates or a non-gesture cue',()=>{
  localStorage.setItem(deepClaimAudioPreferenceKey('restored'),JSON.stringify({master:true}));const events=vi.spyOn(document,'addEventListener');const controller=audio('restored');expect(events.mock.calls.some(([name])=>name==='visibilitychange')).toBe(false);
  controller.setScene({view:'mine',depth:500,formation:'ruins'});controller.updateSettings({master:true});controller.setBackgroundPaused(true);controller.setActive(true);controller.play('complete');expect(contexts).toHaveLength(0);expect(controller.getDiagnostics().unlocked).toBe(false);
 });
 it('preserves old preference keys/defaults and clamps all independent bus volumes per account',()=>{
  localStorage.setItem(deepClaimAudioPreferenceKey('legacy'),JSON.stringify({master:true,music:false,volume:.4}));expect(audio('legacy').getSnapshot()).toMatchObject({master:true,music:false,volume:.4,musicVolume:1,ambientVolume:1,sfxVolume:1});
  const controller=audio('user:a');controller.updateSettings({master:true,volume:9,musicVolume:-2,ambientVolume:.3,sfxVolume:.4});expect(controller.getSnapshot()).toMatchObject({volume:1,musicVolume:0,ambientVolume:.3,sfxVolume:.4});expect(audio('user:a').getSnapshot()).toEqual(controller.getSnapshot());expect(audio('user:b').getSnapshot().master).toBe(false);expect(contexts).toHaveLength(0);
 });
 it('has independently connected mix buses and zero-volume music does not mute explicit reward effects',async()=>{
  const controller=audio();controller.updateSettings({master:true,musicVolume:.2,ambientVolume:.3,sfxVolume:.4});await controller.unlock();const context=contexts[0],master=context.gains[0],buses=context.gains.filter(gain=>gain.connections.includes(master));expect(buses).toHaveLength(3);expect(buses.map(bus=>bus.gain.value).sort()).toEqual([.2,.3,.4]);
  controller.updateSettings({musicVolume:0});expect(controller.getDiagnostics().voices.music).toBe(0);expect(controller.getDiagnostics().voices.ambient).toBeGreaterThan(0);controller.play('complete');expect(controller.getDiagnostics().voices.sfx).toBeGreaterThan(0);
  controller.updateSettings({sfxVolume:0});expect(controller.getDiagnostics().voices.sfx).toBe(0);controller.play('dispatch');expect(controller.getDiagnostics().voices.sfx).toBe(0);
 });
 it('attenuates material-specific mining, drops invalid distances and never exceeds fourteen simultaneous sources',async()=>{
  const controller=audio();controller.updateSettings({master:true,music:false,ambient:false});expect(await controller.unlock()).toBe(true);const context=contexts[0];let from=context.gains.length;controller.play('pickaxe',0,'clay');const near=Math.max(...context.gains.slice(from).flatMap(gain=>gain.gain.exponentialRampToValueAtTime.mock.calls.map(call=>Number(call[0]))));const clay=context.sources.filter(source=>source.kind==='osc').map(source=>source.frequency.value);expect(clay).toEqual([155,280]);
  context.advance(1);from=context.gains.length;controller.play('pickaxe',60,'quartz');const far=Math.max(...context.gains.slice(from).flatMap(gain=>gain.gain.exponentialRampToValueAtTime.mock.calls.map(call=>Number(call[0]))));expect(far).toBeLessThan(near);expect(context.sources.filter(source=>source.kind==='osc').slice(-2).map(source=>source.frequency.value)).toEqual([1046.5,1567.98]);
  for(const distance of [-1,Infinity,NaN,1000]){const count=context.sources.length;controller.play('pickaxe',distance,'stone');expect(context.sources).toHaveLength(count);}
  for(let i=0;i<80;i++){context.currentTime+=.2;controller.play('complete');expect(controller.getDiagnostics().voices.total).toBeLessThanOrEqual(14);}
 });
 it('uses a single deterministic bounded noise buffer and reuses it across surface/depth textures',async()=>{
  const first=audio('a');first.updateSettings({master:true,music:false});await first.unlock();const firstContext=contexts[0],samples=firstContext.buffers[0];expect(first.getDiagnostics().buffer_bytes).toBe(8000*4);
  first.setScene({view:'mine',depth:250,formation:'wet_cavern'});first.play('pickaxe',0,'stone');expect(firstContext.buffers).toHaveLength(1);expect(firstContext.filters[0].frequency.value).toBe(340);
  const second=audio('b');second.updateSettings({master:true,music:false});await second.unlock();expect([...contexts[1].buffers[0]]).toEqual([...samples]);expect(second.getDiagnostics().voices.total).toBeLessThanOrEqual(3);
 });
});

describe('Deep Claim category, scene and menu lifetimes',()=>{
 it('honors combat, UI and rewards independently and cancels already queued voices when a global category changes',async()=>{
  const controller=audio();controller.updateSettings({master:true,music:false,ambient:false});await controller.unlock();controller.play('pickaxe',0,'iron_ore');controller.play('complete');controller.play('dispatch');expect(controller.getDiagnostics().voices.sfx).toBe(10);
  globalSettings({combat:false});expect(controller.getDiagnostics().voices.sfx).toBe(7);controller.play('haul');expect(controller.getDiagnostics().voices.sfx).toBe(7);
  globalSettings({combat:false,rewards:false});expect(controller.getDiagnostics().voices.sfx).toBe(3);controller.play('upgrade');controller.play('deposit');expect(controller.getDiagnostics().voices.sfx).toBe(3);
  globalSettings({combat:false,rewards:false,ui:false});expect(controller.getDiagnostics().voices.total).toBe(0);
 });
 it('global ambient mute removes both musical and scene textures without blocking explicit UI cues',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();expect(controller.getDiagnostics().scheduler_active).toBe(true);globalSettings({ambient:false});expect(controller.getDiagnostics().voices.music).toBe(0);expect(controller.getDiagnostics().voices.ambient).toBe(0);expect(controller.getDiagnostics().scheduler_active).toBe(false);controller.play('building');expect(controller.getDiagnostics().voices.sfx).toBe(2);
 });
 it('pauses scene beds and mining behind a menu while keeping explicit confirmation cues, then resumes one scheduler',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();controller.play('pickaxe');controller.setBackgroundPaused(true);expect(controller.getDiagnostics()).toMatchObject({scheduler_active:false,background_paused:true,voices:{total:0,music:0,ambient:0,sfx:0}});
  controller.play('pickaxe');expect(controller.getDiagnostics().voices.total).toBe(0);controller.play('complete');expect(controller.getDiagnostics().voices.sfx).toBe(4);
  controller.setBackgroundPaused(false);expect(controller.getDiagnostics().scheduler_active).toBe(true);const starts=vi.mocked(setInterval).mock.calls.length;controller.setBackgroundPaused(false);controller.setScene({view:'surface',depth:0});expect(vi.mocked(setInterval).mock.calls.length).toBe(starts);
 });
 it('switches only on coarse public scene changes and keeps ambient-only scheduling to one hertz',async()=>{
  const controller=audio();controller.updateSettings({master:true,music:false});await controller.unlock();expect(vi.mocked(setInterval).mock.calls.at(-1)?.[1]).toBe(1000);const count=contexts[0].sources.length;
  controller.setScene({view:'mine',depth:50,formation:null});expect(controller.getDiagnostics().region).toBe('ironworks');controller.setScene({view:'mine',depth:80,formation:null});expect(contexts[0].sources.length).toBe(count);
  controller.updateSettings({music:true});expect(vi.mocked(setInterval).mock.calls.at(-1)?.[1]).toBe(250);expect(controller.getDiagnostics().voices.music).toBeGreaterThan(0);
 });
 it('retunes local cavern textures without restarting the score while panning within one depth band',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();controller.setScene({view:'mine',depth:100});const context=contexts[0],count=context.sources.length;
  controller.setScene({view:'mine',depth:110,formation:'wet_cavern'});controller.setScene({view:'mine',depth:115,formation:null});expect(context.sources.length).toBe(count);expect(controller.getDiagnostics().region).toBe('ironworks');
 });
 it('rebases a large visible audio-clock jump instead of consuming a long silent score backlog',async()=>{
  const controller=audio();controller.updateSettings({master:true,ambient:false});await controller.unlock();const context=contexts[0];context.advance(1000);const count=context.sources.length;vi.advanceTimersByTime(250);const added=context.sources.slice(count);expect(added.length).toBeGreaterThan(0);expect(added.length).toBeLessThanOrEqual(8);expect(added.every(source=>Number(source.start.mock.calls[0]?.[0])>=1000)).toBe(true);expect(controller.getDiagnostics().scheduler_active).toBe(true);
 });
 it('keeps the real active-source budget bounded during score playback plus repeated effects',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();const context=contexts[0];for(let i=0;i<100;i++){context.advance(.25);vi.advanceTimersByTime(250);if(i%2===0)controller.play('complete');expect(controller.getDiagnostics().voices.total).toBeLessThanOrEqual(DEEP_CLAIM_AUDIO_BUDGET.maxVoices);expect(context.sources.filter(source=>!source.ended).length).toBeLessThanOrEqual(14);}
 });
});

describe('Deep Claim background/autoplay/resume-race cleanup',()=>{
 it('fully suspends and cancels scheduling in a hidden document or inactive route',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();const context=contexts[0];visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));await flush();expect(context.state).toBe('suspended');expect(controller.getDiagnostics()).toMatchObject({scheduler_active:false,voices:{total:0}});
  const count=context.sources.length;controller.play('complete');expect(context.sources).toHaveLength(count);visibility='visible';document.dispatchEvent(new Event('visibilitychange'));await flush();expect(context.state).toBe('running');expect(controller.getDiagnostics().scheduler_active).toBe(true);
  controller.setActive(false);await flush();expect(context.state).toBe('suspended');expect(controller.getDiagnostics().scheduler_active).toBe(false);
 });
 it('deduplicates simultaneous gesture resumes and resuspends when a late resume finishes after hiding',async()=>{
  let resolve!:()=>void;deferredResume=new Promise<void>(done=>{resolve=done;});const controller=audio();controller.updateSettings({master:true});const first=controller.unlock(),second=controller.unlock();expect(contexts).toHaveLength(1);expect(contexts[0].resume).toHaveBeenCalledOnce();visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));resolve();expect(await first).toBe(false);expect(await second).toBe(false);await flush();expect(contexts[0].state).toBe('suspended');expect(controller.getDiagnostics()).toMatchObject({scheduler_active:false,voices:{total:0}});
 });
 it('does not restart loops after a late resume races with master mute or disposal',async()=>{
  let resolve!:()=>void;deferredResume=new Promise<void>(done=>{resolve=done;});const controller=audio();controller.updateSettings({master:true});const pending=controller.unlock();controller.updateSettings({master:false});resolve();expect(await pending).toBe(false);expect(controller.getDiagnostics().scheduler_active).toBe(false);await flush();expect(contexts[0].state).toBe('suspended');
  deferredResume=null;const other=audio('other');other.updateSettings({master:true});let complete!:()=>void;deferredResume=new Promise<void>(done=>{complete=done;});const late=other.unlock();other.dispose();complete();expect(await late).toBe(false);expect(contexts[1].close).toHaveBeenCalledOnce();expect(other.getDiagnostics()).toMatchObject({context_state:'unavailable',scheduler_active:false,voices:{total:0}});
 });
 it('recovers from a pending suspend when the route becomes active again',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();controller.setActive(false);controller.setActive(true);await flush();expect(contexts[0].state).toBe('running');expect(controller.getDiagnostics().scheduler_active).toBe(true);
 });
 it('honors legacy app master settings and storage clear without creating a new context',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();localStorage.setItem('dh-club-sound-enabled','false');window.dispatchEvent(new StorageEvent('storage',{key:'dh-club-sound-enabled'}));await flush();expect(contexts[0].state).toBe('suspended');expect(controller.getDiagnostics().voices.total).toBe(0);
  localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null}));await flush();expect(controller.getSnapshot().master).toBe(false);expect(contexts).toHaveLength(1);
 });
 it('handles unsupported or rejected autoplay contexts without leaking timers or throwing',async()=>{
  vi.stubGlobal('AudioContext',undefined);const unavailable=audio();unavailable.updateSettings({master:true});expect(await unavailable.unlock()).toBe(false);expect(contexts).toHaveLength(0);
  vi.stubGlobal('AudioContext',FakeContext);deferredResume=Promise.reject(new Error('Autoplay denied'));const rejected=audio('rejected');rejected.updateSettings({master:true});expect(await rejected.unlock()).toBe(false);expect(rejected.getDiagnostics().scheduler_active).toBe(false);expect(rejected.getDiagnostics().voices.total).toBe(0);
 });
 it('removes listeners, sources, buses, buffer and scheduler on disposal and never recreates a disposed controller',async()=>{
  const controller=audio();controller.updateSettings({master:true});await controller.unlock();const context=contexts[0];controller.dispose();expect(context.close).toHaveBeenCalledOnce();expect(context.sources.every(source=>source.ended&&source.disconnect.mock.calls.length>0)).toBe(true);expect(controller.getDiagnostics()).toMatchObject({context_state:'unavailable',scheduler_active:false,buffer_bytes:0,voices:{total:0}});
  expect(await controller.unlock()).toBe(false);controller.play('dispatch');controller.setScene({view:'mine',depth:599});controller.updateSettings({master:true});expect(contexts).toHaveLength(1);
 });
});
