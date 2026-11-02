import {TUTORIAL_LESSONS} from './chapters';
import {hasVerifiedSale,tutorialSnapshot} from './completion';
import type {DialogueLine,DialogueScene,TutorialContext,TutorialExpression,TutorialLessonId,TutorialSpeakerId} from './types';
interface Draft {speaker:TutorialSpeakerId;expression?:TutorialExpression;text:string;condition?:DialogueLine['condition'];camera_focus?:DialogueLine['camera_focus'];animation?:DialogueLine['animation'];audio_cue?:DialogueLine['audio_cue']}
function scene(id:string,title:string,drafts:Draft[],lesson_id?:TutorialLessonId):DialogueScene{
 const lines=drafts.map((draft,index)=>({...draft,id:`${id}.${String(index+1).padStart(2,'0')}`,text_key:`dc.dialogue.${id}.${String(index+1).padStart(2,'0')}`,expression:draft.expression??'neutral',next:index+1<drafts.length?`${id}.${String(index+2).padStart(2,'0')}`:null}));
 return {id,title,lines,...(lesson_id?{lesson_id}:{}),estimated_read_seconds:Math.ceil(lines.reduce((sum,line)=>sum+line.text.split(/\s+/).length,0)/220*60)};
}
const openingDeed=scene('opening.deed','Gus’s Last Shift',[
 {speaker:'gus',expression:'amused',text:'There you are. Gus Calloway. Most folks say Gravel. The office door says Manager, but the door has always been generous.',camera_focus:'office',animation:'lantern'},
 {speaker:'gus',expression:'neutral',text:'Forty-two years I’ve run this claim. Today I’m retiring. Tomorrow I intend to sit somewhere that doesn’t require a roof inspection.'},
 {speaker:'gus',expression:'skeptical',text:'You’ve bought the right to build something here. Not a mountain of guaranteed gold. If anyone promised that, check what else they sold you.'},
 {speaker:'gus',text:'The ground keeps what you haven’t found. Your company keeps what you actually bring home. Learn that difference and we’ll get along.'},
 {speaker:'gus',expression:'concerned',text:'There are wages, worn tools and a warehouse with walls. Leave a little working money. Pride is a poor substitute for a paid crew.'},
 {speaker:'gus',expression:'amused',text:'First, give the company a name. Make it yours. I named my first cart after a mule; both of them ignored directions.'},
 {speaker:'gus',expression:'neutral',text:'Read the deed, review the founding action, then sign when you’re ready. We wait for the real company record before handing over the keys.',animation:'deed'},
 {speaker:'gus',expression:'excited',text:'No hurry on the signature. There’s a capable crew waiting, and I’d prefer they met an owner who reads the paperwork.'},
],'beginner.claim');
const openingCrew=scene('opening.crew','The People Who Make It Work',[
 {speaker:'gus',expression:'proud',text:'The deed is recorded. Your company, your decisions. Before I forget where I put my hat, meet the people who’ll make those decisions work.',condition:'company_exists',camera_focus:'crew',animation:'crew_arrival'},
 {speaker:'mara',expression:'neutral',text:'Mara Flint. I handle the digging. Pick a real worksite, pay the shift, and we’ll show you what the ground can give back.',condition:'company_exists'},
 {speaker:'ivo',expression:'excited',text:'Ivo Vale. Geology. I prefer a useful question to a confident guess. We’ll reveal the mine properly, one known passage at a time.',condition:'company_exists'},
 {speaker:'tessa',expression:'amused',text:'Tessa Pike. I get things home. Ore sitting underground isn’t stock, and stock blocking the doorway isn’t much better. We’ll mind the space.',condition:'company_exists'},
 {speaker:'gus',expression:'amused',text:'Good people. Listen to them. I’ll stay around the office if you need advice. Retirement leaves room for a little unsolicited wisdom.',condition:'company_exists'},
],'beginner.crew');
const beginnerIntros:Record<string,Draft[]>={
 'beginner.claim':[{speaker:'gus',expression:'skeptical',text:'A name and a confirmed deed. Let’s start with those before anyone orders a brass plaque.'}],
 'beginner.camp':[{speaker:'gus',text:'That’s the camp. Four useful buildings and several things I keep meaning to straighten.'},{speaker:'tessa',expression:'amused',text:'We’ll begin with the useful buildings. They have actual costs and actual jobs.'}],
 'beginner.crew':[{speaker:'gus',expression:'proud',text:'You don’t manage a mine alone. Learn what each person does well before spending their energy.'},{speaker:'mara',text:'Start with the figures in our files. A specialty is a strength, not permission to ignore the rest.'}],
 'beginner.mine':[{speaker:'ivo',expression:'excited',text:'Known rock, unknown ground, and passages we’ve genuinely opened. The map keeps those distinctions for a reason.'},{speaker:'gus',expression:'amused',text:'And the buttons work if you’d rather not wrestle the camera. I consider that progress.'}],
 'beginner.worksite':[{speaker:'mara',text:'Explore finds a way forward. Extract works what we already know. Open a real plan and we’ll see what’s possible.'}],
 'beginner.plan':[{speaker:'tessa',text:'Count the workers, the energy and the wages. Then read the actual quote. It’s cheaper than discovering a missing detail halfway down.'}],
 'beginner.descent':[{speaker:'gus',expression:'skeptical',text:'A sensible plan. Now confirm it once, and wait for the company record. Repeated button pressing is not a mining technique.'}],
 'beginner.waiting':[{speaker:'ivo',text:'Travel, setup, work, haul, return. We can inspect the rest of camp while those real stages run.'},{speaker:'gus',expression:'amused',text:'Excellent. Watching the clock harder never made my crew faster either.'}],
 'beginner.haul':[{speaker:'tessa',expression:'proud',text:'A return is good news. Collection is the part where it becomes warehouse stock. Let’s check the space before moving it.'}],
 'beginner.sale':[{speaker:'tessa',text:'You can sell a little, save it, or put it through industry later. Read the value and make the choice deliberately.'},{speaker:'gus',expression:'amused',text:'You’re allowed to keep useful materials. I won’t mistake restraint for a broken sell button.'}],
 'beginner.upgrade':[{speaker:'gus',expression:'proud',text:'Now read an investment like an owner: what changes, what it costs, and what you won’t be able to buy afterward.'}],
 'beginner.graduate':[{speaker:'gus',expression:'proud',text:'You’ve seen how the claim fits together. The next decision belongs to you. I’ll be in the office if you want a second opinion.'}],
};
export const DIALOGUE_SCENES:DialogueScene[]=[openingDeed,openingCrew,...TUTORIAL_LESSONS.map(lesson=>scene(lesson.intro_scene_id,lesson.title,beginnerIntros[lesson.id]??[{speaker:lesson.speaker,text:lesson.summary}],lesson.id)),
 scene('graduation.sale','The First Descent Complete',[
  {speaker:'gus',expression:'proud',text:"Well, look at that. You’ve got workers, you’ve got a mine, and you’ve even managed to turn a profit.",condition:'sale_confirmed'},
  {speaker:'gus',expression:'amused',text:'Took me three years to get that far. Course, I spent the first two arguing with a mule.',condition:'sale_confirmed'},
  {speaker:'gus',expression:'proud',text:"She’s your mine now, kid. Take good care of her.",condition:'sale_confirmed'},
 ],'beginner.graduate'),
 scene('graduation.review','The First Descent Reviewed',[
  {speaker:'gus',expression:'proud',text:'You know the crew, the mine, and the decisions waiting for you. Reviewing a choice doesn’t spend the company’s money.'},
  {speaker:'gus',expression:'amused',text:'A little patience at the paperwork beats a long argument with an empty warehouse.'},
  {speaker:'gus',expression:'proud',text:"She’s your mine now, kid. Take good care of her. Come find me when you want to put a lesson into practice."},
 ],'beginner.graduate'),
 scene('gus.office','Ask Gus',[{speaker:'gus',expression:'amused',text:'Advice, the Training Journal, or a quiet look at the figures? I can provide the first two. The figures have been here longer than me.'}]),
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
