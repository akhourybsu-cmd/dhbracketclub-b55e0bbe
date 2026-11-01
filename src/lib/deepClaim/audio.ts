import { getSoundSettings, type SoundCategory } from '@/hooks/useSoundSettings';
import { DEEP_CLAIM_AUDIO_BUDGET, DEEP_CLAIM_COMPOSITIONS, deepClaimAudioRegion, deepClaimMaterialTimbre, deepClaimMidiHz, type DeepClaimAudioRegion } from './audioScore';

export interface DeepClaimAudioSettings {master:boolean;music:boolean;sfx:boolean;ambient:boolean;volume:number;musicVolume:number;ambientVolume:number;sfxVolume:number}
export interface DeepClaimAudioScene {view:'surface'|'mine';depth:number;formation?:string|null}
export type DeepClaimAudioCue='pickaxe'|'haul'|'deposit'|'building'|'upgrade'|'dispatch'|'complete'|'error';
type Group='music'|'ambient'|'sfx';
type Listener=()=>void;
interface Voice {source:OscillatorNode|AudioBufferSourceNode;gain:GainNode;filter?:BiquadFilterNode;group:Group;category:SoundCategory;ambientRole?:'wind'|'drone'}
export interface DeepClaimAudioDiagnostics {unlocked:boolean;context_state:AudioContextState|'unavailable';scheduler_active:boolean;background_paused:boolean;region:DeepClaimAudioRegion;voices:{total:number;music:number;ambient:number;sfx:number};buffer_bytes:number}
const DEFAULTS:DeepClaimAudioSettings={master:false,music:true,sfx:true,ambient:true,volume:.65,musicVolume:1,ambientVolume:1,sfxVolume:1};
const unit=(value:number)=>Math.max(0,Math.min(1,value));
export const deepClaimAudioPreferenceKey=(userId:string)=>`dh:deep-claim:audio:v1:${encodeURIComponent(userId)}`;
function read(key:string):DeepClaimAudioSettings{
 try{const value=JSON.parse(localStorage.getItem(key)??'null') as Partial<DeepClaimAudioSettings>|null;
  const volume=(key:'volume'|'musicVolume'|'ambientVolume'|'sfxVolume')=>typeof value?.[key]==='number'&&Number.isFinite(value[key])?unit(value[key]!):DEFAULTS[key];
  return {master:value?.master===true,music:value?.music!==false,sfx:value?.sfx!==false,ambient:value?.ambient!==false,volume:volume('volume'),musicVolume:volume('musicVolume'),ambientVolume:volume('ambientVolume'),sfxVolume:volume('sfxVolume')};
 }catch{return {...DEFAULTS};}
}
/** Source-composed music, bounded deterministic texture and public-material cues; no economy or hidden world inputs. */
export class DeepClaimAudio {
 private settings:DeepClaimAudioSettings;
 private listeners=new Set<Listener>();
 private context:AudioContext|null=null;
 private output:GainNode|null=null;
 private buses:Record<Group,GainNode>|null=null;
 private voices=new Set<Voice>();
 private cueTimes=new Map<DeepClaimAudioCue,number>();
 private noise:AudioBuffer|null=null;
 private timer:ReturnType<typeof setInterval>|null=null;
 private timerMilliseconds=0;
 private active=true;
 private backgroundPaused=false;
 private unlocked=false;
 private disposed=false;
 private listening=false;
 private resumePending:Promise<boolean>|null=null;
 private suspendPending:Promise<void>|null=null;
 private region:DeepClaimAudioRegion='surface';
 private formation:string|null=null;
 private scoreOrigin=0;
 private scoreLoop=0;
 private scoreIndex=0;
 private scoreStarted=false;
 private nextTextureAt=0;
 private textureIndex=0;
 private readonly key:string;
 constructor(userId:string){this.key=deepClaimAudioPreferenceKey(userId);this.settings=read(this.key);}
 private listen(){if(this.listening||this.disposed)return;this.listening=true;if(typeof document!=='undefined')document.addEventListener('visibilitychange',this.onVisibility);if(typeof window!=='undefined')window.addEventListener('storage',this.onStorage);}
 getSnapshot=()=>this.settings;
 subscribe=(listener:Listener)=>{this.listen();this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getDiagnostics=():DeepClaimAudioDiagnostics=>({unlocked:this.unlocked,context_state:this.context?.state??'unavailable',scheduler_active:this.timer!==null,background_paused:this.backgroundPaused,region:this.region,
  voices:{total:this.voices.size,music:[...this.voices].filter(v=>v.group==='music').length,ambient:[...this.voices].filter(v=>v.group==='ambient').length,sfx:[...this.voices].filter(v=>v.group==='sfx').length},buffer_bytes:this.noise?this.noise.length*4:0});
 updateSettings=(patch:Partial<DeepClaimAudioSettings>)=>{
  if(this.disposed)return;const next={...this.settings};
  for(const key of ['master','music','sfx','ambient'] as const)if(typeof patch[key]==='boolean')next[key]=patch[key]!;
  for(const key of ['volume','musicVolume','ambientVolume','sfxVolume'] as const)if(typeof patch[key]==='number'&&Number.isFinite(patch[key]))next[key]=unit(patch[key]!);
  this.settings=next;try{localStorage.setItem(this.key,JSON.stringify(next));}catch{/* Current opt-in works without persistent storage. */}
  this.listeners.forEach(listener=>listener());this.sync();
 };
 /** This is the only method which creates a context; call directly from a click/tap. */
 unlock=async():Promise<boolean>=>{
  if(this.disposed||typeof window==='undefined'||!this.settings.master||!getSoundSettings().master)return false;
  this.listen();
  try{
   if(!this.context||this.context.state==='closed'){
    const Ctor=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctor)return false;
    const c=new Ctor();this.context=c;this.output=c.createGain();this.output.gain.value=0;this.output.connect(c.destination);
    this.buses={music:c.createGain(),ambient:c.createGain(),sfx:c.createGain()};Object.values(this.buses).forEach(bus=>bus.connect(this.output!));
    c.onstatechange=this.onContextState;
   }
   this.unlocked=true;const running=await this.resume();if(this.disposed)return false;this.sync();return running&&this.context?.state==='running'&&this.audible();
  }catch{return false;}
 };
 setActive=(active:boolean)=>{this.listen();if(!this.disposed&&this.active!==active){this.active=active;this.sync();}};
 /** Menus pause the scene bed while source-confirmed UI/reward cues remain available. */
 setBackgroundPaused=(paused:boolean)=>{if(!this.disposed&&this.backgroundPaused!==paused){this.backgroundPaused=paused;this.sync();}};
 setScene=(scene:DeepClaimAudioScene)=>{
  if(this.disposed||!scene||!['surface','mine'].includes(scene.view)||!Number.isFinite(scene.depth))return;
  const region=deepClaimAudioRegion(scene.view,Math.max(0,scene.depth)),formation=['cavern','wet_cavern','crystal_cavern','ruins'].includes(scene.formation??'')?scene.formation!:null;
  if(this.region===region&&this.formation===formation)return;const changedScore=this.region!==region;this.region=region;this.formation=formation;if(changedScore){this.resetScore();this.stopVoices(voice=>voice.group==='music');}this.retuneAmbience();this.sync();
 };
 private audible(){return !this.disposed&&this.active&&this.unlocked&&this.settings.master&&this.settings.volume>0&&getSoundSettings().master&&(typeof document==='undefined'||document.visibilityState!=='hidden');}
 private categoryAllowed(category:SoundCategory){return this.audible()&&getSoundSettings().categories[category]&&!(this.backgroundPaused&&category==='combat');}
 private groupAllowed(group:Group){if(!this.audible())return false;if(group==='sfx')return this.settings.sfx&&this.settings.sfxVolume>0;return !this.backgroundPaused&&getSoundSettings().categories.ambient&&(group==='music'?this.settings.music&&this.settings.musicVolume>0:this.settings.ambient&&this.settings.ambientVolume>0);}
 private suspend(c:AudioContext):Promise<void>{
  if(this.suspendPending)return this.suspendPending;if(c.state!=='running')return Promise.resolve();
  const pending:Promise<void>=Promise.resolve().then(()=>c.suspend()).catch(()=>{}).then(()=>{if(this.context===c&&!this.disposed&&this.audible())this.sync();}).finally(()=>{if(this.suspendPending===pending){this.suspendPending=null;if(this.context===c&&!this.disposed&&this.audible())this.sync();}});
  this.suspendPending=pending;return pending;
 }
 private resume():Promise<boolean>{
  if(this.resumePending)return this.resumePending;const c=this.context;if(!c||this.disposed)return Promise.resolve(false);if(c.state==='running'&&!this.suspendPending)return Promise.resolve(true);
  const pending:Promise<boolean>=(async()=>{
   if(this.suspendPending)await this.suspendPending;if(this.context!==c||!this.audible())return false;
   if(c.state!=='running')await c.resume();
   if(this.context!==c||!this.audible()){if(c.state==='running')await this.suspend(c);return false;}
   return c.state==='running';
  })().catch(()=>false).finally(()=>{if(this.resumePending===pending)this.resumePending=null;});this.resumePending=pending;return pending;
 }
 private sync(){
  const c=this.context;if(!c||!this.output||!this.buses)return;const audible=this.audible();
  this.output.gain.setTargetAtTime(audible?this.settings.volume*.65:0,c.currentTime,.025);
  for(const group of ['music','ambient','sfx'] as const)this.buses[group].gain.setTargetAtTime(this.groupAllowed(group)?this.settings[`${group==='ambient'?'ambient':group}Volume` as 'musicVolume'|'ambientVolume'|'sfxVolume']:0,c.currentTime,.04);
  this.stopVoices(voice=>!this.groupAllowed(voice.group)||!this.categoryAllowed(voice.category));
  if(!audible){this.stopScheduler();this.stopVoices();void this.suspend(c);return;}
  if(c.state!=='running'||this.suspendPending){void this.resume().then(running=>{if(running&&!this.disposed)this.sync();});return;}
  if(!this.groupAllowed('music'))this.resetScore();
  if(!this.groupAllowed('music')&&!this.groupAllowed('ambient'))this.stopScheduler();else this.startScheduler();
 }
 private mayAllocate(group:Group,category:SoundCategory){
  if(!this.context||!this.buses||this.context.state!=='running'||!this.groupAllowed(group)||!this.categoryAllowed(category))return false;
  const count=[...this.voices].filter(voice=>voice.group===group).length;if(group==='music'&&count>=DEEP_CLAIM_AUDIO_BUDGET.maxMusicVoices||group==='ambient'&&count>=DEEP_CLAIM_AUDIO_BUDGET.maxAmbientVoices)return false;
  if(this.voices.size>=DEEP_CLAIM_AUDIO_BUDGET.maxVoices){
   // A short explicit cue can replace the oldest quiet musical note, never an
   // unbounded allocation or a pending economic animation.
   const replace=group==='sfx'?[...this.voices].find(voice=>voice.group==='music'):undefined;if(replace)this.stopVoice(replace);else return false;
  }
  return true;
 }
 private register(voice:Voice){this.voices.add(voice);voice.source.onended=()=>this.disconnect(voice);return voice;}
 private disconnect(voice:Voice){this.voices.delete(voice);voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();voice.filter?.disconnect();}
 private stopVoice(voice:Voice){try{voice.source.stop();}catch{/* A completed/scheduled source may already have stopped. */}this.disconnect(voice);}
 private stopVoices(predicate?:(voice:Voice)=>boolean){for(const voice of [...this.voices])if(!predicate||predicate(voice))this.stopVoice(voice);}
 private tone(frequency:number,duration:number,peak:number,type:OscillatorType='triangle',delay=0,group:Group='sfx',category:SoundCategory='ui'):Voice|null{
  if(!this.mayAllocate(group,category))return null;const c=this.context!,source=c.createOscillator(),gain=c.createGain(),at=c.currentTime+Math.max(0,delay);
  source.type=type;source.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),at+Math.min(.045,duration*.15));gain.gain.exponentialRampToValueAtTime(.0001,at+duration);source.connect(gain);gain.connect(this.buses![group]);
  const voice=this.register({source,gain,group,category});source.start(at);source.stop(at+duration+.02);return voice;
 }
 private noiseBuffer(){
  const c=this.context!;if(!this.noise){this.noise=c.createBuffer(1,Math.ceil(c.sampleRate*DEEP_CLAIM_AUDIO_BUDGET.noiseSeconds),c.sampleRate);const channel=this.noise.getChannelData(0);let state=0x46d3,last=0;for(let i=0;i<channel.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;const white=state/0xffffffff*2-1;last=(last+white*.12)/1.12;channel[i]=last*2;}}
  return this.noise;
 }
 private noiseVoice(peak:number,duration:number,cutoff:number,group:Group,category:SoundCategory,loop=false):Voice|null{
  if(!this.mayAllocate(group,category))return null;const c=this.context!,source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();source.buffer=this.noiseBuffer();source.loop=loop;filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,c.currentTime);filter.Q.setValueAtTime(.5,c.currentTime);
  gain.gain.setValueAtTime(loop?0:peak,c.currentTime);if(loop)gain.gain.setTargetAtTime(peak,c.currentTime,.3);else gain.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);
  source.connect(filter);filter.connect(gain);gain.connect(this.buses![group]);const voice=this.register({source,gain,filter,group,category,...(loop?{ambientRole:'wind' as const}:{})});source.start(c.currentTime);source.stop(c.currentTime+duration+.02);return voice;
 }
 private ambientProfile(){return this.region==='surface'?{drone:82.41,cutoff:800,noise:.012}:this.formation==='wet_cavern'?{drone:55,cutoff:340,noise:.013}:this.region==='crystal'||this.formation==='crystal_cavern'?{drone:73.42,cutoff:1100,noise:.007}:this.region==='forgotten'?{drone:36.71,cutoff:130,noise:.009}:{drone:55,cutoff:220,noise:.01};}
 private retuneAmbience(){const c=this.context;if(!c)return;const profile=this.ambientProfile();for(const voice of this.voices)if(voice.group==='ambient'){if(voice.ambientRole==='drone'&&(voice.source as OscillatorNode).frequency)(voice.source as OscillatorNode).frequency.setTargetAtTime(profile.drone,c.currentTime,.35);if(voice.ambientRole==='wind'){voice.filter?.frequency.setTargetAtTime(profile.cutoff,c.currentTime,.35);voice.gain.gain.setTargetAtTime(profile.noise,c.currentTime,.35);}}}
 private ensureAmbience(){
  if(!this.groupAllowed('ambient'))return;const c=this.context!,profile=this.ambientProfile();
  if(![...this.voices].some(v=>v.ambientRole==='wind'))this.noiseVoice(profile.noise,3600,profile.cutoff,'ambient','ambient',true);
  if(![...this.voices].some(v=>v.ambientRole==='drone')&&this.mayAllocate('ambient','ambient')){
   const source=c.createOscillator(),gain=c.createGain();source.type='sine';source.frequency.setValueAtTime(profile.drone,c.currentTime);gain.gain.setValueAtTime(0,c.currentTime);gain.gain.setTargetAtTime(.008,c.currentTime,.4);source.connect(gain);gain.connect(this.buses!.ambient);this.register({source,gain,group:'ambient',category:'ambient',ambientRole:'drone'});source.start();source.stop(c.currentTime+3600);
  }
  if(c.currentTime>=this.nextTextureAt){this.nextTextureAt=c.currentTime+7+(this.textureIndex++%3)*2;
   if(this.formation==='wet_cavern')this.tone(659.25,.25,.009,'sine',0,'ambient','ambient');
   else if(this.region==='surface')this.tone(this.textureIndex%2?1318.51:1567.98,.12,.004,'sine',0,'ambient','ambient');
  }
 }
 play=(cue:DeepClaimAudioCue,distanceTiles=0,material?:string)=>{
  const c=this.context;if(!c||!this.groupAllowed('sfx')||c.state!=='running'||!Number.isFinite(distanceTiles)||distanceTiles<0||distanceTiles>85)return;
  const category:SoundCategory=cue==='pickaxe'||cue==='haul'?'combat':cue==='deposit'||cue==='complete'||cue==='upgrade'?'rewards':'ui';if(!this.categoryAllowed(category))return;
  const previous=this.cueTimes.get(cue)??-Infinity;if(c.currentTime-previous<(category==='combat'?.18:.09))return;this.cueTimes.set(cue,c.currentTime);const gain=.095/(1+distanceTiles*.07);
  if(cue==='pickaxe'){const timbre=deepClaimMaterialTimbre(material);this.noiseVoice(gain*timbre.noise,.085,timbre.kind==='earth'?550:2400,'sfx',category);this.tone(timbre.fundamental,timbre.ring,gain*.65,'triangle',0,'sfx',category);this.tone(timbre.overtone,timbre.ring*1.2,gain*.25,'sine',.012,'sfx',category);}
  else if(cue==='haul'){this.noiseVoice(gain*.2,.075,550,'sfx',category);this.tone(110,.1,gain*.3,'triangle',0,'sfx',category);}
  else if(cue==='error'){this.tone(164.81,.14,gain*.5,'triangle',0,'sfx',category);this.tone(146.83,.18,gain*.4,'triangle',.12,'sfx',category);}
  else if(cue==='building'){this.tone(293.66,.14,gain*.5,'triangle',0,'sfx',category);this.tone(440,.2,gain*.4,'sine',.075,'sfx',category);}
  else {const notes=cue==='complete'||cue==='upgrade'?[293.66,392,440,587.33]:cue==='dispatch'?[220,293.66,392]:[392,440,587.33];notes.forEach((frequency,index)=>this.tone(frequency,.28,gain*.55,'triangle',index*.085,'sfx',category));}
 };
 private resetScore(){this.scoreStarted=false;this.scoreIndex=0;this.scoreLoop=0;}
 private schedule=()=>{
  const c=this.context;if(!c||c.state!=='running'||!this.audible()||this.backgroundPaused)return;
  if(this.groupAllowed('ambient'))this.ensureAmbience();
  if(!this.groupAllowed('music'))return;const score=DEEP_CLAIM_COMPOSITIONS[this.region],beatSeconds=60/score.tempo;
  if(!this.scoreStarted){this.scoreStarted=true;this.scoreOrigin=c.currentTime+.12;this.scoreIndex=0;this.scoreLoop=0;}
  const nextBeat=this.scoreLoop*score.beats+score.events[this.scoreIndex].beat;
  if(this.scoreOrigin+nextBeat*beatSeconds<c.currentTime-8){this.stopVoices(voice=>voice.group==='music');this.scoreOrigin=c.currentTime+.12;this.scoreIndex=0;this.scoreLoop=0;}
  let budget=32;
  while(budget-->0){const event=score.events[this.scoreIndex],at=this.scoreOrigin+(this.scoreLoop*score.beats+event.beat)*beatSeconds;if(at>c.currentTime+DEEP_CLAIM_AUDIO_BUDGET.lookaheadSeconds)break;
   if(at>=c.currentTime-.05){const type=event.instrument==='bass'||event.instrument==='pad'||event.instrument==='bell'?'sine':'triangle';this.tone(deepClaimMidiHz(event.midi),Math.min(3,event.beats*beatSeconds),event.gain,type,Math.max(0,at-c.currentTime),'music','ambient');}
   this.scoreIndex++;if(this.scoreIndex===score.events.length){this.scoreIndex=0;this.scoreLoop++;}
  }
 };
 private startScheduler(){
  const milliseconds=this.groupAllowed('music')?DEEP_CLAIM_AUDIO_BUDGET.schedulerMilliseconds:DEEP_CLAIM_AUDIO_BUDGET.ambientSchedulerMilliseconds;
  if(this.timer&&this.timerMilliseconds!==milliseconds)this.stopScheduler();this.schedule();
  if(!this.timer){this.timerMilliseconds=milliseconds;this.timer=setInterval(this.schedule,milliseconds);}
 }
 private stopScheduler(){if(this.timer)clearInterval(this.timer);this.timer=null;this.timerMilliseconds=0;this.resetScore();}
 private onVisibility=()=>this.sync();
 private onContextState=()=>{if(this.disposed)return;if(this.context?.state==='closed'){this.stopScheduler();this.stopVoices();this.unlocked=false;return;}this.sync();};
 private onStorage=(event:StorageEvent)=>{if(event.key===null||event.key===this.key||event.key?.startsWith('dh-club-sound')){if(event.key===null||event.key===this.key){this.settings=read(this.key);this.listeners.forEach(listener=>listener());}this.sync();}};
 dispose=()=>{
  if(this.disposed)return;this.disposed=true;this.stopScheduler();this.stopVoices();this.listeners.clear();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',this.onVisibility);if(typeof window!=='undefined')window.removeEventListener('storage',this.onStorage);
  if(this.context){this.context.onstatechange=null;if(this.context.state!=='closed')void this.context.close().catch(()=>{});}this.context=null;this.output=null;this.buses=null;this.noise=null;
 };
}
export function createDeepClaimAudio(userId:string){return new DeepClaimAudio(userId);}
