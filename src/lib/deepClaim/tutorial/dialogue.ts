import {TUTORIAL_LESSONS} from './chapters';
import {hasVerifiedSale,tutorialSnapshot} from './completion';
import type {DialogueLine,DialogueScene,TutorialContext,TutorialExpression,TutorialLessonId,TutorialSpeakerId} from './types';
interface Draft {speaker:TutorialSpeakerId;expression?:TutorialExpression;text:string;condition?:DialogueLine['condition'];camera_focus?:DialogueLine['camera_focus'];animation?:DialogueLine['animation'];audio_cue?:DialogueLine['audio_cue']}
function scene(id:string,title:string,drafts:Draft[],lesson_id?:TutorialLessonId):DialogueScene{
 const lines=drafts.map((draft,index)=>({...draft,id:`${id}.${String(index+1).padStart(2,'0')}`,text_key:`dc.dialogue.${id}.${String(index+1).padStart(2,'0')}`,expression:draft.expression??'neutral',next:index+1<drafts.length?`${id}.${String(index+2).padStart(2,'0')}`:null}));
 return {id,title,lines,...(lesson_id?{lesson_id}:{}),estimated_read_seconds:Math.ceil(lines.reduce((sum,line)=>sum+line.text.split(/\s+/).length,0)/220*60)};
}
const openingDeed=scene('opening.deed','Gus’s Last Shift',[
 {speaker:'gus',expression:'amused',text:"You must be the new owner. I’m Gus Calloway. Everyone here calls me Gravel.",camera_focus:'office',animation:'lantern'},
 {speaker:'gus',expression:'neutral',text:"I’ve looked after this claim for forty-two years. I’m retiring, so it’s yours to run."},
 {speaker:'gus',expression:'skeptical',text:"There’s good ground here. We’ll start small and see what your crew brings back."},
 {speaker:'gus',text:"You’ll choose the work and look after the business. The crew handles the mining."},
 {speaker:'gus',expression:'concerned',text:"Keep a little money for wages. We’ll look at upgrades once you’ve got a shift running."},
 {speaker:'gus',expression:'amused',text:"First, give the company a name. It’s going on the office door."},
 {speaker:'gus',expression:'neutral',text:"Then check the deed and sign when you’re happy with it.",animation:'deed'},
 {speaker:'gus',expression:'excited',text:"Take your time. I’ll introduce you to the crew once that’s done."},
],'beginner.claim');
const openingCrew=scene('opening.crew','The People Who Make It Work',[
 {speaker:'gus',expression:'proud',text:"All signed. Welcome aboard. These three know the mine better than anyone.",condition:'company_exists',camera_focus:'crew',animation:'crew_arrival'},
 {speaker:'mara',expression:'neutral',text:"Mara Flint. I’ll lead the digging. Show me where we’re working and who’s coming.",condition:'company_exists'},
 {speaker:'ivo',expression:'excited',text:"I’m Ivo Vale, the geologist. I’ll help you find promising ground as we explore.",condition:'company_exists'},
 {speaker:'tessa',expression:'amused',text:"Tessa Pike. I handle the hauling. I’ll help you keep the warehouse clear for the next load.",condition:'company_exists'},
 {speaker:'gus',expression:'amused',text:"You’ve got a good crew. I’ll be around if you need a hand getting settled.",condition:'company_exists'},
],'beginner.crew');
const beginnerIntros:Record<string,Draft[]>={
 'beginner.claim':[{speaker:'gus',expression:'skeptical',text:"A company name and your signature. That’s all we need to get started."}],
 'beginner.camp':[{speaker:'gus',text:"This is your camp. The office, shaft, warehouse and Tool Station are where you’ll start."},{speaker:'tessa',expression:'amused',text:"You can open any building to see what it does. Looking won’t cost you anything."}],
 'beginner.crew':[{speaker:'gus',expression:'proud',text:"Let’s meet the crew. Their skills will help you decide who to send."},{speaker:'mara',text:"We each have a specialty. Open our files and I’ll show you what to look for."}],
 'beginner.mine':[{speaker:'ivo',expression:'excited',text:"The mine map fills in as we explore. For now, have a look at the ground we already know."},{speaker:'gus',expression:'amused',text:"Use the worksite list if that’s easier than moving around the map."}],
 'beginner.worksite':[{speaker:'mara',text:"Need coal? Choose Mine a deposit. Use Expand tunnels when you want us to open a new route."}],
 'beginner.plan':[{speaker:'tessa',text:"Pick the crew, then check the wages and energy before you send them."}],
 'beginner.descent':[{speaker:'gus',expression:'skeptical',text:"The plan’s ready. Choose Dispatch crew when you’re happy with the cost."}],
 'beginner.waiting':[{speaker:'ivo',text:"We’ll travel down, set up, work the site and bring the load back."},{speaker:'gus',expression:'amused',text:"You can look around camp or close the game. The crew will carry on."}],
 'beginner.haul':[{speaker:'tessa',expression:'proud',text:"The crew’s back. Let’s collect the haul into the warehouse."}],
 'beginner.sale':[{speaker:'tessa',text:"You can sell some of the haul for working money. Choose an amount and check the total."},{speaker:'gus',expression:'amused',text:"You can keep materials for later, too. There’s no rush to sell everything."}],
 'beginner.upgrade':[{speaker:'gus',expression:'proud',text:"Have a look at an upgrade. Check what it adds and what you’d have left after paying for it."}],
 'beginner.graduate':[{speaker:'gus',expression:'proud',text:"That’s the basic routine. Send a crew, collect the haul, then decide what the company needs next."}],
};
export const DIALOGUE_SCENES:DialogueScene[]=[openingDeed,openingCrew,...TUTORIAL_LESSONS.map(lesson=>scene(lesson.intro_scene_id,lesson.title,beginnerIntros[lesson.id]??[{speaker:lesson.speaker,text:lesson.summary}],lesson.id)),
 scene('graduation.sale','The First Descent Complete',[
  {speaker:'gus',expression:'proud',text:"You’ve made a sale and brought some money in. That’s a good start.",condition:'sale_confirmed'},
  {speaker:'gus',expression:'amused',text:"There’s plenty more to learn. For now, take a look around and decide what you want to work on.",condition:'sale_confirmed'},
  {speaker:'gus',expression:'proud',text:"It’s your claim now. I’m looking forward to seeing what you do with it.",condition:'sale_confirmed'},
 ],'beginner.graduate'),
 scene('graduation.review','The First Descent Reviewed',[
  {speaker:'gus',expression:'proud',text:"You can keep useful materials for the workshop. Selling can wait."},
  {speaker:'gus',expression:'amused',text:"Have a look at the upgrades, then decide what the company needs next."},
  {speaker:'gus',expression:'proud',text:"I’ll be around if you need a hand. There’s no rush to learn everything today."},
 ],'beginner.graduate'),
 scene('gus.office','Ask Gus',[{speaker:'gus',expression:'amused',text:"What do you want a hand with? We can look at the camp, your crew or the next shift."}]),
];
export const DIALOGUE_SCENE_BY_ID=Object.fromEntries(DIALOGUE_SCENES.map(scene=>[scene.id,scene]));
export const DIALOGUE_LINE_IDS=DIALOGUE_SCENES.flatMap(scene=>scene.lines.map(line=>line.id));
export const OPENING_READ_SECONDS=openingDeed.estimated_read_seconds+openingCrew.estimated_read_seconds;
const saleProof=(context?:TutorialContext)=>!!context&&hasVerifiedSale(context);
export function getDialogueScene(id:string,context?:TutorialContext):DialogueScene|null{
 const selected=id==='graduation.sale'&&!saleProof(context)?DIALOGUE_SCENE_BY_ID['graduation.review']:DIALOGUE_SCENE_BY_ID[id];if(!selected)return null;
 const lines=selected.lines.filter(line=>!line.condition||line.condition==='company_exists'&&!!context&&!!tutorialSnapshot(context)||line.condition==='company_missing'&&(!context||!tutorialSnapshot(context))||line.condition==='sale_confirmed'&&saleProof(context));
 return {...selected,lines:lines.map((line,index)=>({...line,next:lines[index+1]?.id??null}))};
}
export function getDialogueHistory(ids:readonly string[]):DialogueLine[]{const known=new Map(DIALOGUE_SCENES.flatMap(scene=>scene.lines).map(line=>[line.id,line]));return [...new Set(ids)].flatMap(id=>known.has(id)?[known.get(id)!]:[]);}
