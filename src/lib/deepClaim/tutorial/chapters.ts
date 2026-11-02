import type {TutorialLesson,TutorialLessonId,TutorialOpenAction,TutorialPredicate,TutorialSectionId,TutorialSpeakerId,TutorialStep,TutorialTargetId} from './types';
export const TUTORIAL_SECTION_INFO:Record<TutorialSectionId,{title:string;description:string}>={
 beginner:{title:'The First Descent',description:'Twelve chapters from signing the deed to running your own claim.'},
 workforce:{title:'Workforce Management',description:'Hire, understand, train and equip a dependable crew.'},
 industry:{title:'Resources & Industry',description:'Move finite ore through storage, refining and useful equipment.'},
 field:{title:'Underground Operations',description:'Explore, prepare and understand the ground you actually know.'},
 business:{title:'Business Development',description:'Turn company decisions into lasting capabilities.'},
 club:{title:'DH Club',description:'Optional public accomplishments and carefully reviewed cooperation.'},
 settings:{title:'Settings & Game Management',description:'Make the game comfortable and leave work safely in progress.'},
};
const ui=(type:Parameters<typeof event>[0],detail?:Parameters<typeof event>[1])=>event(type,detail);
function event(type:import('./types').TutorialEventType,detail?:import('./types').TutorialEventDetail):TutorialPredicate{return {kind:'event',type,...(detail?{detail}:{})};}
const fact=(value:Extract<TutorialPredicate,{kind:'snapshot'}>['fact']):TutorialPredicate=>({kind:'snapshot',fact:value});
const ack:TutorialPredicate={kind:'acknowledge'};
const tab=(value:'surface'|'mine'|'crew'|'stores'|'log'|'settings',view?:string):TutorialOpenAction=>({type:'tab',tab:value,...(view?{view}:{})});
const office=(view:'company'|'research'|'contracts'|'records'|'club',club_view?:'projects'|'standings'|'showcase'):TutorialOpenAction=>({type:'office',view,...(club_view?{club_view}:{})});
interface StepDraft{key:string;title:string;instruction:string;target:TutorialTargetId|null;open:TutorialOpenAction|null;predicate:TutorialPredicate;more?:string[];optional_practice?:boolean;fallback_targets?:TutorialTargetId[]}
/** Future controls are reached through these authored, currently available controls. */
const FUTURE_CONTROL_FALLBACKS:Partial<Record<TutorialTargetId,TutorialTargetId[]>>={
 'dispatch-quote':['dispatch-review'],'dispatch-confirm':['dispatch-review'],'jobs-ready':['jobs-active','haul-collect'],
 'sale-review':['stores-stock'],'haul-collect':['jobs-ready'],
 'buildings-list':['building-review'],'map-viewport':['field-operations','dispatch-plan','discovery-review'],
 'production-recipes':['production-recipe','production-review'],'field-finds':['discovery-review'],
 'club-projects':['club-project-review'],'club-showcase':['club-privacy'],
};
function lesson(id:TutorialLessonId,order:number,title:string,objective:string,speaker:TutorialSpeakerId,reference:string[],drafts:StepDraft[],practice?:TutorialPredicate,requires:TutorialLesson['live_requires']='company'):TutorialLesson{
 return {id,version:1,section:id.split('.')[0] as TutorialSectionId,order,title,objective,speaker,summary:reference[0],reference,steps:drafts.map(step=>({...step,id:`${id}.${step.key}`,more:step.more??reference,optional_practice:step.optional_practice??false,...(step.fallback_targets||step.target&&FUTURE_CONTROL_FALLBACKS[step.target]?{fallback_targets:[...(step.fallback_targets??FUTURE_CONTROL_FALLBACKS[step.target!]!)]}:{})})),intro_scene_id:`chapter.${id}`,practice_id:`practice.${id}`,...(practice?{practice_predicate:practice}:{}),live_requires:requires};
}
const step=(key:string,title:string,instruction:string,target:TutorialTargetId|null,open:TutorialOpenAction|null,predicate:TutorialPredicate):StepDraft=>({key,title,instruction,target,open,predicate});
export const TUTORIAL_LESSONS:TutorialLesson[]=[
 lesson('beginner.claim',1,'The Claim','Name and verify your real company.','gus',[
  'One company belongs to you in each club. Its workers, mine, stock and paid jobs persist together.',
  'Naming and signing the deed uses the existing confirmed founding action. Continue never creates a company.',
  'An existing save can replay this lesson safely; a second company or reset is not part of New Game.',
 ],[step('deed','Read the deed','Choose a company name before reviewing the real founding action.','company-name',{type:'found_company'},ack),step('founded','Sign and verify','Confirm the founding action, then wait for your company to appear in the synchronized game.','company-found',{type:'found_company'},{kind:'company_exists'})],{kind:'company_exists'},undefined),
 lesson('beginner.camp',2,'Welcome to Camp','Inspect a building and find the mine entrance.','gus',[
  'Surface is your management camp; Mine is the same company viewed underground.',
  'The Mine Office coordinates crews, the shaft supports access, the warehouse stores collected goods, and the Tool Station improves work.',
  'Company credits pay real costs. Inspecting a building never purchases an upgrade.',
 ],[step('surface','Survey the camp','Open Surface and look over your starting settlement.','nav-surface',tab('surface'),ui('tab_opened',{tab:'surface'})),step('building','Inspect a building','Open one camp building to compare its current level, next cost and benefit.','buildings-list',tab('surface','buildings'),ui('building_inspected')),step('mine','Find the entrance','Open Mine. Both views share the same persistent company.','nav-mine',tab('mine'),ui('tab_opened',{tab:'mine'}))]),
 lesson('beginner.crew',3,'Meet Your Workforce','Meet Mara, Ivo and Tessa and read their strengths.','mara',[
  'Mara Flint specializes in practical mining, Ivo Vale in geology, and Tessa Pike in hauling logistics.',
  'Mining affects recovery; Geology helps exploration; Logistics affects travel and carrying. Traits add both useful strengths and trade-offs.',
  'Workers have six daily energy. A shift takes one to three available workers and commits its wages and energy at dispatch.',
 ],[step('crew','Open the roster','Open Crew to see your actual employees and energy.','nav-crew',tab('crew'),ui('tab_opened',{tab:'crew'})),step('mara','Meet Mara','Inspect Mara Flint and her Mining statistic.','worker-stat-mining',{type:'worker',name:'Mara Flint'},ui('stat_inspected',{worker_name:'Mara Flint',stat:'mining'})),step('ivo','Read the ground','Inspect Ivo Vale and his Geology statistic.','worker-stat-geology',{type:'worker',name:'Ivo Vale'},ui('stat_inspected',{worker_name:'Ivo Vale',stat:'geology'})),step('tessa','Bring it home','Inspect Tessa Pike and her Logistics statistic.','worker-stat-logistics',{type:'worker',name:'Tessa Pike'},ui('stat_inspected',{worker_name:'Tessa Pike',stat:'logistics'})),step('conditions','Read traits and energy','Notice the strengths, drawbacks, energy and upfront wages in an employee file.','worker-energy',tab('crew'),ack)]),
 lesson('beginner.mine',4,'Beneath the Surface','Use an accessible map control and inspect known ground.','ivo',[
  'Unknown ground hides real geological information. The illustration never supplies a hidden ore answer.',
  'Deposits are finite and excavation persists. Work needs a connected route through known excavated ground and supported depth.',
  'Pan, zoom, focus buttons, keyboard controls and the worksite list provide alternative ways to inspect the mine.',
 ],[step('enter','Go underground','Open your actual mine map.','nav-mine',tab('mine'),ui('tab_opened',{tab:'mine'})),step('control','Move your view','Pan, zoom, focus or use keyboard map controls. No gesture is mandatory.','map-controls',tab('mine'),ui('map_interacted')),step('inspect','Inspect known ground','Select a known site or use the accessible worksite list.','map-viewport',tab('mine'),ui('worksite_inspected'))]),
 lesson('beginner.worksite',5,'Choose Your First Worksite','Open the real expedition planner.','mara',[
  'Explore opens a frontier and reveals finite ground; Extract works a deposit that you already know.',
  'The original coal seam at 47,1 supports the one-time induction only while the actual company says it remains available.',
  'If that seam or induction is already used, use a current legitimate site or the clearly marked read-only demonstration.',
 ],[step('difference','Choose the task','Read the Explore and Extract distinction in the operation plan.','dispatch-mode',{type:'dispatch',mode:'extract'},ack),step('planner','Open a real plan','Open the actual planner for a valid current worksite.','dispatch-plan',{type:'dispatch',mode:'extract'},ui('dispatch_opened'))]),
 lesson('beginner.plan',6,'Assemble the Crew','Review actual crew availability and the server quote.','tessa',[
  'Quick takes 20 minutes and one energy; Standard takes 60 minutes and two; Deep takes 180 minutes and three, per worker.',
  'Only the existing one-time introductory shift is accelerated to about 30 seconds. No tutorial changes normal clocks.',
  'The server quote explains wages, route, energy, capacity and reasons a plan is blocked. Reading a blocked quote is useful; it is not approval.',
 ],[step('selection','Choose available workers','Inspect the selected crew, energy and upfront wages.','dispatch-crew',{type:'dispatch'},ui('crew_selected')),step('quote','Read the quote','Request and review the real server preview, including any blocking reason.','dispatch-quote',{type:'dispatch'},ui('quote_reviewed'))]),
 lesson('beginner.descent',7,'The First Descent','Dispatch one real, confirmed expedition.','gus',[
  'A confirmed expedition spends the displayed wages and energy once and freezes the crew, route and work plan.',
  'Travel, Setup, Work, Haul and Return are real stages. Animation only depicts the synchronized job.',
  'A retry must recover the same paid action. A button press or uncertain request alone does not prove a dispatch.',
 ],[step('confirmed','Send the crew','Review and confirm the real expedition, then wait for the synchronized job record.','dispatch-confirm',{type:'dispatch'},fact('expedition_exists'))],fact('expedition_exists')),
 lesson('beginner.waiting',8,'While the Crew Works','Follow a real shift through its return.','ivo',[
  'The server timestamps keep your work moving while you inspect another tab or leave the app.',
  'A browser countdown cannot create ore or mark a job returned. Refreshing synchronizes the actual elapsed stages.',
  'Returned ore is staged cargo until you collect it; it is not yet spendable warehouse inventory.',
 ],[step('stages','Watch the stages','Find the active job or its genuine returned record.','jobs-active',tab('surface'),fact('expedition_exists')),step('returned','Wait for the return','Let the real introductory shift finish; you may inspect other views meanwhile.','jobs-ready',tab('surface'),fact('return_ready'))],fact('return_ready')),
 lesson('beginner.haul',9,'Bring Home the Haul','Collect a genuine full or partial transfer.','tessa',[
  'Review the actual returned cargo before collecting. Collection moves only confirmed goods into warehouse stock.',
  'If storage fills, a legitimate partial transfer leaves the rest safely staged. Nothing is silently discarded.',
  'An empty exploration report is not an ore transfer. Review the demonstration if no collectable haul is available.',
 ],[step('cargo','Inspect the return','Find the returned expedition and its actual cargo.','jobs-ready',tab('surface','returns'),fact('return_ready')),step('collected','Secure the haul','Collect cargo and wait for a confirmed positive warehouse transfer.','haul-collect',tab('surface','returns'),fact('cargo_collected'))],fact('cargo_collected')),
 lesson('beginner.sale',10,'Turn Stone into Money','Review stock values and optionally confirm an actual sale.','tessa',[
  'Collected material can be sold, processed, crafted or saved for later obligations.',
  'A sale removes the chosen owned quantity and adds the server-calculated credits. You do not need to sell everything.',
  'If stock is unavailable or you prefer to keep it, the read-only example completes a review without claiming that money was earned.',
 ],[step('stock','Open Stock','Inspect your actual stored materials and their values.','stores-stock',tab('stores','stock'),ui('stock_inspected')),step('sale','Make your decision','Choose a quantity you can spare, confirm the sale and wait for the server result, or use the non-spending review.','sale-review',tab('stores','stock'),fact('sale_confirmed'))],fact('sale_confirmed')),
 lesson('beginner.upgrade',11,'Invest in Your Company','Compare a permanent upgrade without being forced to buy it.','gus',[
  'Mine Office adds simultaneous crews, Shaft extends supported depth, Warehouse expands storage, and Tool Station improves extraction and crafting.',
  'Read the real current level, next price and benefit. Keep the operating reserve and choose the investment your company needs.',
  'Reviewing is enough to learn this chapter. A server-confirmed purchase earns the separate practical mark.',
 ],[step('review','Review an investment','Inspect one actual building and its next upgrade. No purchase is required.','building-review',tab('surface'),ui('building_inspected'))],fact('upgrade_confirmed')),
 lesson('beginner.graduate',12,'Your Company, Your Decisions','Finish the first campaign and choose your next step.','gus',[
  'Explore finite ground, assign rested employees, choose an appropriate shift and collect the real return.',
  'Storage, selling, equipment and permanent investments remain your decisions. Ordinary work takes real elapsed time.',
  'Graduation awards no credits, resources, workers, equipment, terrain or DH Score. Your actual company is the reward for your decisions.',
 ],[step('ready','Take the reins','Continue mining, open the advanced academy or revisit this Field Guide whenever useful.','training-journal',{type:'journal'},ack)]),
 lesson('workforce.hiring',1,'Hiring Employees','Review a daily candidate, wage and housing requirement.','gus',[
  'The Hiring Office offers persistent daily candidates across seven specialties. Hiring pays a real one-time cost and adds that person to this company.',
  'Starting housing holds three employees; Workers’ Quarters raises capacity. More workers still need energy, wages and a free crew slot.',
  'Inspect a candidate even if funds or housing are insufficient. Preview practice never hires or spends.',
 ],[step('office','Open Hiring','Review candidates, specialties, hire costs and wages.','hire-office',tab('crew','hire'),ui('tab_opened',{tab:'crew'})),step('capacity','Check housing','Compare current workforce capacity with the next Quarters benefit.','hire-office',tab('crew','hire'),ack)],fact('has_hire'),'schema2'),
 lesson('workforce.stats',2,'Employee Statistics','Understand all seven real effective attributes.','mara',[
  'Mining improves recovery; Geology improves exploration; Engineering improves setup, structures and deep heat protection.',
  'Logistics affects travel and carrying; Safety supports productive work and bounded-delay mitigation; Endurance helps longer shifts; Leadership helps coordinated crews.',
  'Effective attributes include base training, experience levels, working gear and completed research, capped at 100. A higher displayed stat is not an extra multiplier to apply again.',
 ],[step('file','Open a worker file','Inspect an actual employee and the seven attribute descriptions.','worker-stats',tab('crew'),ui('worker_inspected')),step('meaning','Read an attribute','Inspect one current attribute and how it changes work.','worker-stats',tab('crew'),ui('stat_inspected'))],undefined,'schema2'),
 lesson('workforce.training',3,'Training','Review an idle employee’s daily paid course.','mara',[
  'Training costs 30 credits and improves one base attribute by up to three points, capped at 100.',
  'The worker must be idle and can train once per company operating day. Training does not refill energy or repeat on refresh.',
  'Read a course before deciding; do not spend merely to mark the explanation reviewed.',
 ],[step('course','Inspect a course','Open a worker file and review training availability, cost and gain.','worker-training',{type:'worker',view:'training'},ui('worker_inspected',{view:'training'})),step('limits','Understand the limit','Compare base and effective values and the actual daily/idle restriction.','worker-training',tab('crew'),ack)],fact('has_training'),'schema2'),
 lesson('workforce.equipment',4,'Equipment','Understand tool, head and utility assignments.','mara',[
  'Each worker can use one tool, one head item and one utility item. An owned item belongs to one worker at a time.',
  'Working bonuses contribute to effective attributes. Different gear can support mining, hauling, surveying or deep thermal protection.',
  'The Nickel Heat Shield’s real protection is averaged over the selected crew; an unassigned or broken shield contributes nothing.',
 ],[step('slots','Inspect a loadout','Review the three slots and your owned gear.','worker-gear',{type:'worker',view:'gear'},ui('worker_inspected',{view:'gear'})),step('tradeoff','Choose deliberately','Read an item’s bonuses, condition and assignment restrictions before changing a loadout.','worker-gear',tab('crew'),ack)],fact('has_equipment'),'schema2'),
 lesson('workforce.repairs',5,'Durability and Repairs','Review condition, repair inputs and safe retirement.','tessa',[
  'Committed jobs freeze equipment identities and ordinary wear. Returning work reduces condition; broken items stop supplying bonuses to future work.',
  'A repair pays the actual displayed credits and materials and restores condition. Workers affected by equipment changes must be idle.',
  'Unassigned gear can be permanently retired without refunds to free the finite 48-item owned-plus-pending capacity. Practice never damages or retires anything.',
 ],[step('condition','Read item condition','Inspect owned gear and its actual repair requirements.','worker-gear',{type:'worker',view:'gear'},ui('worker_inspected',{view:'gear'})),step('repair','Review maintenance','Compare repair, unequip and retirement choices without committing one.','worker-gear',tab('crew'),ack)],fact('has_repair'),'schema2'),
 lesson('industry.ore',1,'Understanding Ore','Connect the current material catalogue to real uses.','ivo',[
  'Raw stone, clay, coal, copper, tin, iron, quartz, silver, amethyst and gold each have current mining or industrial uses.',
  'The Ancient Deep adds finite nickel ore and sulfur in eligible new generation-four ground; nickel alloy is processed stock, never terrain.',
  'Coal remains useful fuel. Sale value alone does not describe a material’s opportunity cost in recipes, gear, projects or research.',
 ],[step('catalog','Inspect Stock','Use actual material filters and select a resource to review its value.','stores-resource',tab('stores','stock'),ui('stock_inspected')),step('uses','Follow the material','Compare a raw ingredient with a real recipe that needs it.','production-recipes',tab('stores','workshop'),ui('recipe_inspected'))],undefined,'company'),
 lesson('industry.warehouse',2,'Warehouse Management','Distinguish owned stock from staged returns.','tessa',[
  'Warehouse capacity limits collected materials. A ready haul or finished order can remain staged safely when space is tight.',
  'Only collected stock can be sold, processed, delivered or contributed. A pending reward is not warehouse inventory.',
  'Collection accepts a legitimate partial transfer and retains the remainder. Sell or consume intentionally; the game does not discard overflow.',
 ],[step('capacity','Read storage','Inspect current owned units and actual capacity.','stores-capacity',tab('stores','stock'),ui('stock_inspected')),step('staging','Review staged output','Compare ready output with owned stock before collecting.','production-queue',tab('stores','workshop'),ack)],fact('cargo_collected')),
 lesson('industry.smeltery',3,'The Smeltery','Read real metal inputs, fuel, cost and output.','mara',[
  'The Smeltery converts finite collected ore and coal into refined bars through paid timed orders.',
  'Bronze, steel and gold recipes add research requirements. Nickel alloy uses three nickel ore, one iron bar, two coal and 10 credits for one alloy.',
  'The alloy recipe needs station level three and existing Processing 2 plus Deep Operations 2. No tutorial unlocks or supplies it.',
 ],[step('station','Open metalwork','Inspect a Smeltery recipe and its real station requirement.','production-recipes',{type:'tab',tab:'stores',view:'workshop',station:'smeltery'},ui('recipe_inspected',{view:'smeltery'})),step('inputs','Read the order','Review the exact input, fuel, cash, timer and output before starting.','production-review',{type:'tab',tab:'stores',view:'workshop',station:'smeltery'},ack)],{kind:'production',station:'smeltery',state:'started'},'schema2'),
 lesson('industry.gems',4,'Gem Workshop','Understand the actual quartz and amethyst finishing chain.','ivo',[
  'The Gem Workshop polishes quartz and cuts amethyst using the current finite ingredients, fees and server timers.',
  'Finished crystals are distinct inventory goods. They can support research, equipment or existing delivery orders.',
  'No other planned gemstone is implied to be obtainable. Inspect the current recipe and station level.',
 ],[step('gems','Review a crystal recipe','Select actual gem finishing and read its current requirements.','production-recipes',{type:'tab',tab:'stores',view:'workshop',station:'gem_workshop'},ui('recipe_inspected',{view:'gem_workshop'})),step('finish','Follow the output','Notice where finished goods remain staged until collected.','production-review',{type:'tab',tab:'stores',view:'workshop',station:'gem_workshop'},ack)],{kind:'production',station:'gem_workshop',state:'collected'},'schema2'),
 lesson('industry.crafting',5,'The Tool Station','Turn a real recipe into owned, assignable equipment.','mara',[
  'Equipment crafting consumes finite goods and cash when the order starts. The result becomes owned only after collection.',
  'Tool Station level and existing research gate advanced gear. A Nickel Heat Shield needs two nickel alloy, two polished quartz, two sulfur and 80 credits.',
  'Collected gear still needs a deliberate idle-worker assignment. Crafting and equipping are separate actions.',
 ],[step('craft','Read an equipment recipe','Inspect a craft recipe and its station/research requirement.','production-recipes',{type:'tab',tab:'stores',view:'workshop',station:'tool_station'},ui('recipe_inspected',{view:'tool_station'})),step('assign','Plan a loadout','Review collection and worker assignment as separate steps.','worker-gear',{type:'worker',view:'gear'},ui('worker_inspected',{view:'gear'}))],{kind:'production',station:'tool_station',state:'collected',equipment_output:true},'schema2'),
 lesson('industry.queues',6,'Production Queues','Understand station lanes, batches and ready output.','tessa',[
  'Each station has a serialized production lane. An order may be queued with a future start time behind work already paid for.',
  'Batches are one to ten, with at most three uncollected orders company-wide. Owned and pending crafted equipment share the 48-item cap.',
  'Station upgrades and completed Processing research affect future orders. Existing orders retain their frozen recipe, paid inputs and time.',
 ],[step('queue','Inspect production','Read active, queued or ready orders in the real workshop.','production-queue',tab('stores','workshop'),ui('production_inspected')),step('limits','Read batch limits','Review a recipe’s batch selector, lane and output staging.','production-review',tab('stores','workshop'),ack)],fact('production_collected'),'schema2'),
 lesson('field.exploration',1,'Geological Exploration','Reveal finite ground through a legitimate connected frontier.','ivo',[
  'Explore works from a connected route and commits a bounded private plan; terrain appears only at due server work milestones.',
  'Revealed empty natural chambers can become walkable only after they are known and connected. Air does not mint rubble or a guaranteed ore haul.',
  'Generation versions preserve existing chunks and unseen contents. New generation-four nickel/sulfur can appear only in eligible absent chunks from 608m.',
 ],[step('frontier','Open Explore','Inspect the actual frontier operation and route.','dispatch-mode',{type:'dispatch',mode:'explore'},ui('dispatch_opened',{mode:'explore'})),step('finite','Read what is known','Review finite quantities, unknown ground and possible empty exploration returns.','field-operations',tab('mine'),ack)],event('expedition_confirmed',{mode:'explore'})),
 lesson('field.survey',2,'Surveying','Reveal a bounded area without extracting it.','ivo',[
  'Survey starts at revealed, depleted ground connected to the shaft. Preset grade, Geology and Ore Eye influence its bounded diamond.',
  'It spends real wages and energy, reveals on elapsed work milestones, and produces no ore cargo.',
  'The returned survey settles directly with a field report. It does not require an empty collection click.',
 ],[step('survey','Review Survey','Open the actual survey mode at known eligible ground.','dispatch-mode',{type:'dispatch',mode:'survey'},ui('dispatch_opened',{mode:'survey'})),step('quote','Inspect coverage','Read actual radius, tile limit, route and cost before deciding.','dispatch-quote',{type:'dispatch',mode:'survey'},ui('quote_reviewed'))],fact('survey_completed'),'schema3'),
 lesson('field.infrastructure',3,'Underground Infrastructure','Review a real permanent project and coverage.','mara',[
  'Supports reduce instability delays; ventilation reduces gas and deep heat; pumps reduce water delays; rail improves covered route travel.',
  'An installation requires known depleted connected ground, a crew, paid materials and project fees. Presets choose grade; Engineering affects radius and strength.',
  'Only installed records help. Strongest applicable protection does not stack. Rail uses covered known route points, not a blanket route discount.',
 ],[step('project','Inspect construction','Choose an actual infrastructure project and read placement restrictions.','field-infrastructure',{type:'dispatch',mode:'infrastructure'},ui('dispatch_opened',{mode:'infrastructure'})),step('cost','Review permanence','Inspect the full project fee, inputs, grade, radius and strength.','dispatch-quote',{type:'dispatch',mode:'infrastructure'},ui('quote_reviewed'))],fact('infrastructure_installed'),'schema3'),
 lesson('field.hazards',4,'Operational Hazards','Read bounded delay risks and Ancient Deep productive heat.','gus',[
  'Rockfall, gas and water can add a bounded setup delay. They do not kill staff, destroy cargo or consume energy twice.',
  'At 600–999m, deterministic heat reduces useful mining/exploration work, not the elapsed stage. Effective Engineering, installed ventilation and working assigned heat shields mitigate it.',
  'Shaft six requires existing Deep Operations 2 and 24,000 credits. Its lift discounts only actual known constructed vertical edges through 956m; branching travel is not teleported.',
 ],[step('conditions','Inspect actual conditions','Review a real preview’s risk, mitigation and any heat or lift modifier.','dispatch-conditions',{type:'dispatch'},ui('quote_reviewed')),step('safety','Keep the distinction clear','Separate a bounded random setup delay from the deterministic productive heat percentage.','dispatch-conditions',{type:'dispatch'},ack)],undefined,'schema3'),
 lesson('field.reports',5,'Expedition Reports','Find actual work, surveys, installations and incidents.','ivo',[
  'Field Log and Reports show records that have actually become due and synchronized.',
  'Incident detail appears after setup, while survey/construction reports arrive on return. A predicted outcome is not a report.',
  'Visible history is bounded for readability; company statistics derive from permanent records, not just these latest rows.',
 ],[step('log','Open the Field Log','Inspect actual recent reports or the honest empty state.','field-log',tab('log','reports'),ui('tab_opened',{tab:'log'})),step('report','Read a report','Review what a completed report confirms, without inventing a pending incident.','field-reports',tab('log','reports'),ack)],undefined,'schema3'),
 lesson('field.discoveries',6,'Rare Discoveries','Review permanent keep, sell and salvage decisions.','ivo',[
  'Actual mining can recover Banded Geode, Fern Fossil, Survey Journal, Rail Relic, Crystal Cluster or Meteorite Fragment after fully depleting eligible ground and returning.',
  'Quality is common, fine, exceptional or flawless. A find is finite and private until recovered; surveying unknown cells is not collecting a specimen.',
  'Keep retains it, Sell pays the frozen value, and Salvage consumes it for the displayed goods only if the entire salvage fits. The guide never chooses for you.',
 ],[step('finds','Inspect your discoveries','Open actual recovered finds or read the clear no-finds state.','field-finds',tab('log','finds'),ui('tab_opened',{tab:'log'})),step('choice','Review the three decisions','Compare permanent choices before using the real confirmation.','discovery-review',tab('log','finds'),ack)],fact('discovery_decided'),'schema3'),
 lesson('business.office',1,'The Company Office','Find Company, Research, Contracts, Records and optional Club views.','gus',[
  'The Office organizes the same company; it is not a second save or separate economy.',
  'Company gives an overview and useful shortcuts. Research, Contracts and Records have distinct paid actions or source-backed achievements.',
  'Club systems are optional and retain separate public-consent rules.',
 ],[step('office','Enter the Office','Open the company overview from camp or its accessible shortcut.','office-company',office('company'),ui('tab_opened',{view:'company'})),step('sections','Read the sections','Choose the section matching the decision you actually want to make.','office-company',office('company'),ack)],undefined,'schema4'),
 lesson('business.research',2,'Research','Understand fourteen paid nodes and future-only benefits.','gus',[
  'Seven branches each contain two authored research nodes. Read prerequisites, Research Office tier, cash, inputs and timer.',
  'Only one project is active. Completion happens on the server without an extra claim; paid effects benefit new work, not already frozen jobs.',
  'Processing totals up to 15% faster future production. Existing Deep Operations 2 also enables the real shaft-six technology and nickel industry.',
 ],[step('tree','Inspect the tree','Open Research and review an actual node and its prerequisites.','office-research',office('research'),ui('research_inspected')),step('cost','Review the project','Compare its permanent benefit with its exact paid requirements.','research-review',office('research'),ack)],fact('research_completed'),'schema4'),
 lesson('business.contracts',3,'Trading Contracts','Review a complete finite delivery without auto-spending stock.','tessa',[
  'Twelve authored orders have Trading Post tiers and prerequisites. They do not expire or reroll each day.',
  'A delivery consumes its complete collected input once and pays the frozen credits. Staged output cannot fulfill the order.',
  'A reviewed order stays unspent until you deliberately confirm fulfillment; a retry cannot pay a completed order again.',
 ],[step('orders','Inspect an order','Open Contracts and review an actual requirement and payout.','office-contracts',office('contracts'),ui('contract_inspected')),step('whole','Read the shortfall','Compare complete required stock, current shortfall and one-time status.','contract-review',office('contracts'),ack)],fact('contract_completed'),'schema4'),
 lesson('business.milestones',4,'Milestones and Records','Separate durable progress, eligibility and claimed credit awards.','gus',[
  'Eight company milestones use permanent records such as returned work, collected production, research or deliveries.',
  'Eligible is not claimed. A deliberate successful claim pays its existing finite company-credit reward once.',
  'Company milestones and DH Score Feats are different systems. Reading either guide awards neither.',
 ],[step('records','Open Records','Inspect a source-backed record and milestone status.','office-records',office('records'),ui('milestone_inspected')),step('claim','Read eligibility','Notice the difference between progress, claimable and already claimed.','milestone-review',office('records'),ack)],fact('milestone_claimed'),'schema4'),
 lesson('business.strategy',5,'Business Strategy','Compare opportunity costs without promising profit.','gus',[
  'A hire expands the rested roster; a building may add crews, capacity, supported depth or a real production capability.',
  'Selling provides liquidity now. Processing consumes finite inputs and time; research trades current cash and stock for permanent future benefits.',
  'Depth investments also need viable routes and prepared crews. No guide can guarantee a hidden deposit or a fixed profit schedule.',
 ],[step('overview','Read your situation','Review current company funds, available workers and actual commitments.','office-company',office('company'),ui('tab_opened',{view:'company'})),step('tradeoff','Make a comparison','Compare one benefit with what its cost prevents you doing next.','office-company',office('company'),ack)],undefined,'schema4'),
 lesson('club.projects',1,'Club Projects','Understand a permanent contribution and bounded claim.','tessa',[
  'Six finite projects consume explicitly chosen collected materials. Per-resource personal caps depend on the frozen eligible club size and can rise if the club shrinks.',
  'Contributions are permanent, not refundable trades. A failed or excessive request spends nothing; keep the operating reserve.',
  'After completion, a current eligible member with at least 5% of frozen project value may claim a proportional floor of the finite credit pool once. Reading this lesson contributes nothing.',
 ],[step('project','Inspect a shared project','Open Projects and read actual progress, required stock and your limits.','club-projects',office('club','projects'),ui('club_view_opened',{view:'projects'})),step('review','Read the commitment','Review a contribution before deciding whether to make one.','club-project-review',office('club','projects'),ack)],event('club_contribution_confirmed'),'club'),
 lesson('club.standings',2,'Standings','Understand three separate opt-in comparisons.','gus',[
  'Weekly Mining Value uses original recorded returned haul in the club-local Monday week, not remaining stock after a sale.',
  'Operational Depth is deepest completed mining/exploration; Best Find is highest recovered frozen specimen value.',
  'These are separate records with true tied ranks, not one combined gamer score. Other crews appear after their own company synchronizes.',
 ],[step('board','Inspect a board','Read the selected metric, local week and true ranks.','club-standings',office('club','standings'),ui('club_view_opened',{view:'standings'})),step('meaning','Read consent','Notice that publishing identity and company records is optional.','club-standings',office('club','standings'),ack)],undefined,'club'),
 lesson('club.showcase',3,'Company Showcases','Review a deliberately curated public case.','ivo',[
  'Showcase sharing begins disabled. Up to three explicitly chosen owned kept specimens can appear with your public identity and company label.',
  'The public case excludes your private map, workforce, balance, inventory and specimen coordinates.',
  'Older featured finds stay retainable even beyond the recent private list. The guide never publishes, replaces or resolves a find for you.',
 ],[step('case','Open Showcase','Inspect the current public case or honest empty state.','club-showcase',office('club','showcase'),ui('club_view_opened',{view:'showcase'})),step('curate','Review publication','Read the selection and consent controls without toggling them automatically.','club-privacy',office('club','showcase'),ack)],event('preferences_confirmed',{view:'showcase_published'}),'club'),
 lesson('club.privacy',4,'Privacy','Make independent standings and showcase consent decisions.','gus',[
  'Both sharing switches begin false and are independent. Browsing projects or contributing does not force a public listing.',
  'Disabling sharing hides it on subsequent server reads without deleting your private company, earned awards or historical contributions.',
  'Only current eligible club members can access shared operations. This lesson and its practice never change consent.',
 ],[step('consent','Review the switches','Read the two independent consent options and data they publish.','club-privacy',office('club','showcase'),ui('privacy_reviewed')),step('choice','Keep control','Choose whether to change anything in the actual reviewed settings. Leaving both off is valid.','club-privacy',office('club','showcase'),ack)],undefined,'club'),
 lesson('club.updates',5,'DH Achievements and Updates','Find existing Feats and opt-in in-app updates.','gus',[
  'Meaningful Deep Claim activity feeds the existing permanent DH Feats ledger. Tutorial reading and raw UI clicks do not award score.',
  'Company credits cannot be spent as DH Score, and a club project pool is not a second points system.',
  'Deep Claim in-app updates use the shared inbox and notification preference. They arise on actual synchronization, not an unattended push/cron promise.',
 ],[step('updates','Inspect update settings','Read the existing Deep Claim notification preference and Feats guidance.','settings-updates',tab('settings','updates'),ui('settings_opened',{view:'updates'})),step('score','Read the distinction','Use the actual Feats entry when you want to review earned account awards.','settings-updates',office('company'),ack)],undefined,'company'),
 lesson('settings.sound',1,'Sound and Visual Settings','Make the game comfortable without enabling sound automatically.','tessa',[
  'Game master sound begins off and requires your gesture. Music, ambience and effects have independent levels and respect app-wide category mutes.',
  'Reduced motion and graphics are separate comfort choices. They do not change authoritative work or resource results.',
  'Hidden pages and exited games stop local rendering/audio; real expeditions continue on server timestamps.',
 ],[step('settings','Open Settings','Inspect Sound, Visuals and Updates without automatically changing a preference.','settings-sound',tab('settings'),ui('settings_opened')),step('comfort','Choose your comfort','Read the controls and decide whether any change would help you.','settings-visuals',tab('settings','visuals'),ack)]),
 lesson('settings.main_menu',2,'Returning to the Main Menu','Leave the company view without replacing the save.','gus',[
  'Return to Main Menu opens Deep Claim’s front door while preserving every paid job and owned resource.',
  'Continue reopens your actual current-club company. It never bootstraps or resets it.',
  'A cached save is labeled stale; fresh economic actions still require a verified server response.',
 ],[step('menu','Find the title route','Use Return to Main Menu and inspect Continue.','settings-main-menu',tab('settings','sound'),ui('main_menu_opened'))]),
 lesson('settings.exit',3,'Leaving the Game','Understand safe exit while legitimate work continues.','tessa',[
  'Return to DH Club exits to the existing Compete area. It does not cancel a paid expedition or production order.',
  'When you return, synchronization reconciles the actual elapsed server work before economic decisions.',
  'If a request is uncertain, retain its recoverable identity and retry. Leaving the guide never confirms or repeats the transaction.',
 ],[step('exit','Review a safe exit','Read the exit action; you can finish this review without navigating away.','game-exit',{type:'return_to_club'},ack)]),
];
export const BEGINNER_LESSONS=TUTORIAL_LESSONS.filter(lesson=>lesson.section==='beginner');
export const ACADEMY_LESSONS=TUTORIAL_LESSONS.filter(lesson=>lesson.section!=='beginner');
export const TUTORIAL_LESSON_BY_ID=Object.fromEntries(TUTORIAL_LESSONS.map(lesson=>[lesson.id,lesson])) as Record<TutorialLessonId,TutorialLesson>;
export const TUTORIAL_STEP_IDS=TUTORIAL_LESSONS.flatMap(lesson=>lesson.steps.map(step=>step.id));
export function getTutorialLesson(id:string):TutorialLesson|null{return TUTORIAL_LESSON_BY_ID[id as TutorialLessonId]??null;}
export function getTutorialStep(id:string):TutorialStep|null{return TUTORIAL_LESSONS.flatMap(lesson=>lesson.steps).find(step=>step.id===id)??null;}
