/**
 * Deep Claim: original source-composed score, pack v1.
 * Five released miniatures and one Ancient Deep add-on share the claim motif. Each has
 * a written melody, eight-bar harmonic progression, bass, and sparse answer.
 * Synthesized live with Web Audio; no recordings, borrowed tunes, or samples.
 */
export type DeepClaimAudioRegion='surface'|'shallow'|'ironworks'|'crystal'|'forgotten'|'ancient_deep';
export interface DeepClaimScoreEvent {beat:number;midi:number;beats:number;gain:number;instrument:'plucked'|'bell'|'bass'|'pad'}
export interface DeepClaimComposition {key:DeepClaimAudioRegion;name:string;tempo:number;beats:64;events:readonly DeepClaimScoreEvent[]}
interface WrittenTheme {key:DeepClaimAudioRegion;name:string;tempo:number;roots:readonly number[];melody:readonly (readonly number[])[];answer:readonly number[];bell?:boolean}
// Written notes are MIDI pitches. Zero marks an intentional rest. The second
// eight-bar phrase changes the cadence/answer rather than transposing at random.
const THEMES:readonly WrittenTheme[]=[
 {key:'surface',name:'Lanterns at the Claim',tempo:84,roots:[38,43,41,45,38,46,43,45],melody:[[62,69,65,64],[67,62,70,69],[65,72,69,67],[64,69,73,0],[62,65,69,74],[70,65,72,69],[67,70,74,72],[73,69,64,62]],answer:[74,77,76,81,77,74,79,74]},
 {key:'shallow',name:'Footfalls Under Clay',tempo:72,roots:[38,41,43,38,46,43,45,38],melody:[[62,65,69,0],[65,64,72,69],[67,70,69,65],[62,57,65,0],[70,69,65,62],[67,62,70,69],[64,61,69,0],[65,64,62,57]],answer:[77,74,79,77,81,77,76,74]},
 {key:'ironworks',name:'The Copper Counterweight',tempo:78,roots:[33,38,36,40,33,41,38,40],melody:[[57,64,60,59],[62,65,64,60],[60,67,64,62],[59,64,68,0],[57,60,64,69],[65,64,60,57],[62,60,65,64],[68,64,59,57]],answer:[76,72,79,76,77,76,74,72]},
 {key:'crystal',name:'A Prism Keeps the Light',tempo:68,roots:[38,46,41,43,38,41,43,45],melody:[[74,77,81,0],[82,77,74,81],[77,84,81,79],[79,74,82,77],[74,81,86,84],[81,77,84,0],[79,82,86,81],[85,81,76,74]],answer:[86,89,88,91,89,86,88,86],bell:true},
 {key:'forgotten',name:'The Archive Below',tempo:64,roots:[31,38,34,36,31,39,36,38],melody:[[55,62,58,0],[62,65,64,58],[58,65,62,60],[60,55,63,62],[55,58,62,67],[63,58,65,62],[60,63,67,0],[66,62,57,55]],answer:[74,70,77,74,75,74,72,67]},
 {key:'ancient_deep',name:'A Lantern in the Ancient Deep',tempo:64,roots:[28,35,31,33,28,36,33,35],melody:[[52,59,62,55],[59,64,60,55],[55,62,59,0],[57,52,60,59],[52,55,64,62],[60,55,62,59],[57,60,64,0],[63,59,54,52]],answer:[71,67,74,71,72,71,69,64]},
];
function arrange(theme:WrittenTheme):DeepClaimComposition{
 const events:DeepClaimScoreEvent[]=[];
 for(let bar=0;bar<16;bar++){
  const phrase=bar%8,root=theme.roots[phrase],start=bar*4;
  events.push({beat:start,midi:root,beats:2.4,gain:.014,instrument:'bass'});
  if(bar%2===0)events.push({beat:start+2.5,midi:root+7,beats:1,gain:.009,instrument:'bass'});
  // One quiet fifth every other bar leaves space for mine texture and cues.
  if(bar%2===1)events.push({beat:start+.5,midi:root+19,beats:2.5,gain:.008,instrument:'pad'});
  theme.melody[phrase].forEach((midi,index)=>{if(!midi)return;const cadence=bar===15&&index>=2?midi-12:midi;events.push({beat:start+index*(bar%4===3?.875:1),midi:cadence,beats:index===3?1.15:.72,gain:bar<8?.025:.021,instrument:theme.bell?'bell':'plucked'});});
  if(bar>=8&&bar%2===0)events.push({beat:start+2.5,midi:theme.answer[phrase],beats:.7,gain:.012,instrument:'bell'});
 }
 return {key:theme.key,name:theme.name,tempo:theme.tempo,beats:64,events:events.sort((a,b)=>a.beat-b.beat)};
}
export const DEEP_CLAIM_COMPOSITIONS:Readonly<Record<DeepClaimAudioRegion,DeepClaimComposition>>=Object.fromEntries(THEMES.map(theme=>[theme.key,arrange(theme)])) as Record<DeepClaimAudioRegion,DeepClaimComposition>;
export const deepClaimMidiHz=(midi:number)=>440*2**((midi-69)/12);
export function deepClaimAudioRegion(view:'surface'|'mine',depth:number):DeepClaimAudioRegion{
 return view==='surface'?'surface':depth<50?'shallow':depth<160?'ironworks':depth<320?'crystal':depth>=600&&depth<=999?'ancient_deep':'forgotten';
}
export const DEEP_CLAIM_AUDIO_BUDGET={maxVoices:14,maxMusicVoices:8,maxAmbientVoices:3,lookaheadSeconds:.65,schedulerMilliseconds:250,ambientSchedulerMilliseconds:1000,noiseSeconds:1,scoreBars:16} as const;
export interface DeepClaimMaterialTimbre {kind:'stone'|'earth'|'carbon'|'metal'|'crystal';fundamental:number;overtone:number;ring:number;noise:number}
export function deepClaimMaterialTimbre(material?:string):DeepClaimMaterialTimbre{
 if(material==='clay')return {kind:'earth',fundamental:155,overtone:280,ring:.075,noise:.7};
 if(material==='coal')return {kind:'carbon',fundamental:230,overtone:460,ring:.09,noise:.52};
 if(material==='sulfur')return {kind:'earth',fundamental:174.61,overtone:349.23,ring:.09,noise:.65};
 if(material==='nickel_ore'||material==='nickel_alloy')return {kind:'metal',fundamental:698.46,overtone:1174.66,ring:.2,noise:.26};
 if(['quartz','amethyst','polished_quartz','cut_amethyst'].includes(material??''))return {kind:'crystal',fundamental:1046.5,overtone:1567.98,ring:.3,noise:.12};
 if(['copper_ore','tin_ore','iron_ore','silver_ore','gold_ore','copper_bar','tin_bar','iron_bar','silver_bar','bronze_bar','steel_bar','gold_bar'].includes(material??''))return {kind:'metal',fundamental:740,overtone:1318.51,ring:.22,noise:.24};
 return {kind:'stone',fundamental:510,overtone:910,ring:.12,noise:.5};
}
